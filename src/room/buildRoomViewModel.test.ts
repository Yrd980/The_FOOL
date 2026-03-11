import { describe, expect, it } from "vitest";

import { buildRoomViewModel } from "./buildRoomViewModel";
import type { BuildRoomViewModelInput, ConversationState } from "./types";

const contestantIds = ["alpha", "beta", "gamma", "delta"];
const contestantNameById: Record<string, string> = {
  alpha: "Alpha",
  beta: "Beta",
  gamma: "Gamma",
  delta: "Delta",
};

const baseConversation: ConversationState = {
  speakerId: "alpha",
  raisedHandId: "beta",
  listeningIds: ["alpha", "gamma"],
  queuedIds: ["delta"],
  callout: "Alpha 正在主麦。",
};

const interactions = [
  { id: "evt-1", contestantId: "alpha", type: "danmaku" as const, source: "观众 01", content: "Alpha 好强", amount: 1, timestampLabel: "20:08" },
  { id: "evt-2", contestantId: "beta", type: "bet" as const, source: "押注池", content: "Beta 加注", amount: 12, timestampLabel: "20:09" },
  { id: "evt-3", contestantId: "gamma", type: "like" as const, source: "观众 03", content: "Gamma 加油", amount: 1, timestampLabel: "20:10" },
  { id: "evt-4", contestantId: "delta", type: "boo" as const, source: "观众 04", content: "Delta 快冲", amount: 1, timestampLabel: "20:11" },
];

const baseInput: BuildRoomViewModelInput = {
  conversationState: baseConversation,
  orderedContestantIds: contestantIds,
  interactions,
  audioMode: "nearby",
  nearbyHint: "Nearby people may listen in",
  contestantNameById,
};

describe("buildRoomViewModel", () => {
  it("marks speaking, raised-hand, listening, queued, and muted seats correctly", () => {
    const model = buildRoomViewModel(baseInput);

    expect(model.openClawSeats.find((seat) => seat.id === "alpha")?.state).toBe("speaking");
    expect(model.openClawSeats.find((seat) => seat.id === "beta")?.state).toBe("raised-hand");
    expect(model.openClawSeats.find((seat) => seat.id === "gamma")?.state).toBe("listening");
    expect(model.openClawSeats.find((seat) => seat.id === "delta")?.state).toBe("queued");
    expect(model.queueCount).toBeGreaterThan(0);
    expect(model.micCount).toBeGreaterThan(0);
  });

  it("filters room audio when focus mode is active", () => {
    const model = buildRoomViewModel({ ...baseInput, audioMode: "focus" });

    expect(
      model.audibleSignals.every((event) => event.contestantId === model.activeSpeakerId),
    ).toBe(true);
  });

  it("returns no audible signals when muted", () => {
    const model = buildRoomViewModel({ ...baseInput, audioMode: "muted" });

    expect(model.audibleSignals).toHaveLength(0);
  });

  it("returns all room signals in nearby mode", () => {
    const model = buildRoomViewModel({ ...baseInput, audioMode: "nearby" });

    expect(model.audibleSignals.length).toBeGreaterThan(0);
    expect(model.audibleSignals).toEqual(model.roomSignals);
  });

  it("composes the room callout with queued contestant name and audio hint", () => {
    const model = buildRoomViewModel(baseInput);

    expect(model.roomCallout).toContain("Alpha 正在主麦。");
    expect(model.roomCallout).toContain("Beta 也在边上举手等待切入。");
    expect(model.roomCallout).toContain("你当前会听到附近对话。");
  });

  it("uses nearby hint when no speaker is present", () => {
    const model = buildRoomViewModel({
      ...baseInput,
      conversationState: { ...baseConversation, speakerId: null },
    });

    expect(model.roomCallout).toBe("Nearby people may listen in");
  });

  it("falls back to the nearby hint when no raised hand", () => {
    const model = buildRoomViewModel({
      ...baseInput,
      conversationState: { ...baseConversation, raisedHandId: null },
    });

    expect(model.roomCallout).toContain("Nearby people may listen in");
    expect(model.roomCallout).not.toContain("也在边上举手等待切入");
  });
});
