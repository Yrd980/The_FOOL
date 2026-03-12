import { describe, expect, it } from "vitest";

import {
  classifyInteractionType,
  deriveContestantState,
  mapGatewayMessage,
  mapPresenceToContestantStates,
} from "./gatewayAdapter";
import type { GatewayPresenceEntry, AgentPresenceMap } from "./types";

const makePresence = (overrides: Partial<GatewayPresenceEntry> = {}): GatewayPresenceEntry => ({
  instanceId: "inst-1",
  deviceId: "dev-1",
  host: "localhost",
  version: "2026.3.8",
  deviceFamily: "cli",
  mode: "agent",
  lastInputSeconds: 5,
  text: "Node: localhost (127.0.0.1) · app 2026.3.8 · last input 5s ago · mode agent · reason heartbeat",
  ts: Date.now(),
  ...overrides,
});

describe("deriveContestantState", () => {
  it("0-10s → speaking", () => {
    expect(deriveContestantState(5)).toBe("speaking");
  });

  it("10-30s → raised-hand", () => {
    expect(deriveContestantState(15)).toBe("raised-hand");
  });

  it("30-120s → listening", () => {
    expect(deriveContestantState(60)).toBe("listening");
  });

  it("120s+ → muted", () => {
    expect(deriveContestantState(300)).toBe("muted");
  });

  it("boundary: exactly 10s → raised-hand", () => {
    expect(deriveContestantState(10)).toBe("raised-hand");
  });

  it("boundary: exactly 30s → listening", () => {
    expect(deriveContestantState(30)).toBe("listening");
  });

  it("boundary: exactly 120s → muted", () => {
    expect(deriveContestantState(120)).toBe("muted");
  });
});

describe("mapPresenceToContestantStates", () => {
  const contestantIds = ["c-1", "c-2", "c-3"];

  it("maps agent presences to contestants by ts order", () => {
    const presences = [
      makePresence({ instanceId: "b", ts: 200, lastInputSeconds: 5 }),
      makePresence({ instanceId: "a", ts: 100, lastInputSeconds: 60 }),
    ];

    const result = mapPresenceToContestantStates(presences, contestantIds, {});

    // sorted by ts: a (100) → c-1, b (200) → c-2
    expect(result.get("c-1")).toBe("listening");
    expect(result.get("c-2")).toBe("speaking");
    expect(result.get("c-3")).toBe("muted"); // no presence → muted
  });

  it("uses config map when provided", () => {
    const presences = [makePresence({ instanceId: "x", lastInputSeconds: 5 })];
    const configMap: AgentPresenceMap = {
      x: { contestantId: "c-3", name: "Test", teamIndex: 0 },
    };

    const result = mapPresenceToContestantStates(presences, contestantIds, configMap);

    expect(result.get("c-3")).toBe("speaking");
    expect(result.get("c-1")).toBe("muted"); // unmapped
  });

  it("filters out cli and gateway mode presences", () => {
    const presences = [
      makePresence({ mode: "cli", lastInputSeconds: 5 }),
      makePresence({ instanceId: "gw", mode: "gateway", lastInputSeconds: 0 }),
    ];
    const result = mapPresenceToContestantStates(presences, contestantIds, {});

    // cli and gateway filtered out, all contestants muted
    expect(result.get("c-1")).toBe("muted");
  });

  it("treats operator/node as listeners, not contestants", () => {
    const presences = [makePresence({ mode: "operator", lastInputSeconds: 5 })];
    const result = mapPresenceToContestantStates(presences, contestantIds, {});

    // operator doesn't map to a contestant
    expect(result.get("c-1")).toBe("muted");
  });
});

describe("classifyInteractionType", () => {
  it("classifies bet patterns", () => {
    expect(classifyInteractionType("下注 50 点")).toBe("bet");
    expect(classifyInteractionType("bet 100")).toBe("bet");
  });

  it("classifies positive as like", () => {
    expect(classifyInteractionType("👍")).toBe("like");
    expect(classifyInteractionType("太棒了")).toBe("like");
  });

  it("classifies negative as boo", () => {
    expect(classifyInteractionType("👎")).toBe("boo");
    expect(classifyInteractionType("不行")).toBe("boo");
  });

  it("defaults to danmaku", () => {
    expect(classifyInteractionType("随便说点什么")).toBe("danmaku");
  });
});

describe("mapGatewayMessage", () => {
  it("maps a gateway message to AudienceInteraction", () => {
    const result = mapGatewayMessage(
      { id: "msg-1", senderId: "user-1", senderName: "Alice", content: "好厉害", ts: 1710000000000 },
      "c-1",
    );

    expect(result.id).toBe("gw-msg-1");
    expect(result.contestantId).toBe("c-1");
    expect(result.source).toBe("Alice");
    expect(result.type).toBe("like");
    expect(result.amount).toBe(1);
  });

  it("uses senderId when senderName is null", () => {
    const result = mapGatewayMessage(
      { id: "msg-2", senderId: "user-2", senderName: null, content: "test", ts: 1710000000000 },
      "c-1",
    );

    expect(result.source).toBe("user-2");
  });
});
