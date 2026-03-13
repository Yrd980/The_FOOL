import { describe, expect, it } from "vitest";

import {
  buildPresenceContestantMap,
  classifyInteractionType,
  deriveContestantStateFromSession,
  mapGatewayMessage,
  mapSessionsToContestantStates,
  resolveGatewayContestantId,
} from "./gatewayAdapter";
import type { GatewayPresenceEntry, GatewaySessionEntry } from "./types";
import type { AgentRegistry } from "./agentRegistry";

const makeSession = (overrides: Partial<GatewaySessionEntry> = {}): GatewaySessionEntry => ({
  agentId: "contestant-01",
  key: "agent:contestant-01:main",
  kind: "direct",
  updatedAt: Date.now(),
  abortedLastRun: false,
  inputTokens: 3,
  outputTokens: 5,
  totalTokens: 12000,
  model: "claude-opus-4-6",
  modelProvider: "anthropic",
  contextTokens: 200000,
  ...overrides,
});

const makePresence = (overrides: Partial<GatewayPresenceEntry> = {}): GatewayPresenceEntry => ({
  ts: Date.now(),
  mode: "agent",
  ...overrides,
});

describe("deriveContestantStateFromSession", () => {
  it("undefined session → muted", () => {
    expect(deriveContestantStateFromSession(undefined)).toBe("muted");
  });

  it("< 10s idle → speaking", () => {
    const session = makeSession({ updatedAt: Date.now() - 5_000 });
    expect(deriveContestantStateFromSession(session)).toBe("speaking");
  });

  it("10-30s idle → raised-hand", () => {
    const session = makeSession({ updatedAt: Date.now() - 15_000 });
    expect(deriveContestantStateFromSession(session)).toBe("raised-hand");
  });

  it("30-120s idle → listening", () => {
    const session = makeSession({ updatedAt: Date.now() - 60_000 });
    expect(deriveContestantStateFromSession(session)).toBe("listening");
  });

  it("120s+ idle → muted", () => {
    const session = makeSession({ updatedAt: Date.now() - 300_000 });
    expect(deriveContestantStateFromSession(session)).toBe("muted");
  });

  it("abortedLastRun + very recent (< 10s) → raised-hand (not speaking)", () => {
    const session = makeSession({ abortedLastRun: true, updatedAt: Date.now() - 5_000 });
    expect(deriveContestantStateFromSession(session)).toBe("raised-hand");
  });

  it("abortedLastRun + recent (< 30s) → raised-hand", () => {
    const session = makeSession({ abortedLastRun: true, updatedAt: Date.now() - 15_000 });
    expect(deriveContestantStateFromSession(session)).toBe("raised-hand");
  });

  it("abortedLastRun + stale (>= 30s) → muted", () => {
    const session = makeSession({ abortedLastRun: true, updatedAt: Date.now() - 60_000 });
    expect(deriveContestantStateFromSession(session)).toBe("muted");
  });

  it("boundary: exactly 10s → raised-hand", () => {
    const session = makeSession({ updatedAt: Date.now() - 10_000 });
    expect(deriveContestantStateFromSession(session)).toBe("raised-hand");
  });

  it("boundary: exactly 30s → listening", () => {
    const session = makeSession({ updatedAt: Date.now() - 30_000 });
    expect(deriveContestantStateFromSession(session)).toBe("listening");
  });

  it("boundary: exactly 120s → muted", () => {
    const session = makeSession({ updatedAt: Date.now() - 120_000 });
    expect(deriveContestantStateFromSession(session)).toBe("muted");
  });
});

describe("mapSessionsToContestantStates", () => {
  const registry: AgentRegistry = [
    { agentId: "contestant-01", contestantId: "c-1", displayName: "Alpha", slot: 1 },
    { agentId: "contestant-02", contestantId: "c-2", displayName: "Beta", slot: 2 },
    { agentId: "contestant-03", contestantId: "c-3", displayName: "Gamma", slot: 3 },
  ];
  const contestantIds = ["c-1", "c-2", "c-3"];

  it("maps sessions to contestant states via registry", () => {
    const sessions = [
      makeSession({ agentId: "contestant-01", updatedAt: Date.now() - 5_000 }),
      makeSession({ agentId: "contestant-02", updatedAt: Date.now() - 60_000 }),
    ];

    const result = mapSessionsToContestantStates(sessions, registry, contestantIds);

    expect(result.get("c-1")).toBe("speaking");
    expect(result.get("c-2")).toBe("listening");
    expect(result.get("c-3")).toBe("muted");
  });

  it("ignores sessions not in registry", () => {
    const sessions = [
      makeSession({ agentId: "unknown-agent", updatedAt: Date.now() }),
    ];

    const result = mapSessionsToContestantStates(sessions, registry, contestantIds);

    expect(result.get("c-1")).toBe("muted");
    expect(result.get("c-2")).toBe("muted");
    expect(result.get("c-3")).toBe("muted");
  });

  it("defaults all contestants to muted with empty sessions", () => {
    const result = mapSessionsToContestantStates([], registry, contestantIds);

    for (const id of contestantIds) {
      expect(result.get(id)).toBe("muted");
    }
  });
});

describe("buildPresenceContestantMap", () => {
  it("reuses the same contestant assignment identities for instance ids and device ids", () => {
    const result = buildPresenceContestantMap(
      [
        makePresence({ instanceId: "agent-alpha", deviceId: "device-alpha", ts: 100 }),
        makePresence({ instanceId: "agent-beta", deviceId: "device-beta", ts: 200 }),
      ],
      ["c-1", "c-2", "c-3"],
      {},
    );

    expect(result.get("agent-alpha")).toBe("c-1");
    expect(result.get("device-alpha")).toBe("c-1");
    expect(result.get("agent-beta")).toBe("c-2");
  });
});

describe("resolveGatewayContestantId", () => {
  it("resolves a sender through the shared presence mapping", () => {
    const mapping = new Map<string, string>([
      ["agent-alpha", "c-1"],
      ["alpha name", "c-1"],
      ["c-2", "c-2"],
    ]);

    expect(
      resolveGatewayContestantId(
        {
          id: "msg-1",
          senderId: "agent-alpha",
          senderName: "Alpha Name",
          content: "hello",
          ts: 1710000000000,
        },
        mapping,
        ["c-1", "c-2"],
      ),
    ).toBe("c-1");
    expect(
      resolveGatewayContestantId(
        {
          id: "msg-2",
          senderId: "session:c-2:main",
          senderName: null,
          content: "hello",
          ts: 1710000000000,
        },
        mapping,
        ["c-1", "c-2"],
      ),
    ).toBe("c-2");
  });

  it("returns null when the sender cannot be matched safely", () => {
    expect(
      resolveGatewayContestantId(
        {
          id: "msg-3",
          senderId: "mystery-user",
          senderName: "Mystery User",
          content: "hello",
          ts: 1710000000000,
        },
        new Map(),
        ["c-1", "c-2"],
      ),
    ).toBeNull();
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
