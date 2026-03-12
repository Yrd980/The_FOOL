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
  teams: [
    {
      id: "team-alpha",
      name: "Team Alpha",
      members: [{ id: "alpha" }, { id: "beta" }],
    },
    {
      id: "team-beta",
      name: "Team Beta",
      members: [{ id: "gamma" }, { id: "delta" }],
    },
  ],
  focusTeamId: "team-alpha",
  currentRoom: {
    id: "main-stage",
    name: "Main Stage",
    kind: "main-stage",
    memberIds: ["alpha", "beta", "gamma", "delta"],
    memberCount: 4,
    audibleSummary: "Main stage",
    statusLabel: "Live",
    active: true,
  },
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

  it("derives a non-focus team room from the room membership instead of the main stage", () => {
    const model = buildRoomViewModel({
      ...baseInput,
      currentRoomId: "team-room-2",
      currentRoom: {
        id: "team-room-2",
        name: "Team Room 2",
        kind: "team-room",
        teamId: "team-beta",
        memberIds: ["gamma", "delta"],
        memberCount: 2,
        audibleSummary: "Team Beta discussion",
        statusLabel: "Active",
        active: true,
      },
    });

    expect(model.activeSpeakerId).toBe("gamma");
    expect(model.raisedHandId).toBe("delta");
    expect(model.openClawSeats.find((seat) => seat.id === "gamma")?.state).toBe("speaking");
    expect(model.openClawSeats.find((seat) => seat.id === "delta")?.state).toBe("raised-hand");
    expect(model.openClawSeats.find((seat) => seat.id === "alpha")?.state).toBe("muted");
    expect(model.roomSignals.every((event) => ["gamma", "delta"].includes(event.contestantId))).toBe(true);
    expect(model.roomCallout).toContain("Team Beta");
  });

  it("uses quiet-orbit semantics instead of leaking main-stage conversation", () => {
    const model = buildRoomViewModel({
      ...baseInput,
      currentRoomId: "quiet-orbit",
      currentRoom: {
        id: "quiet-orbit",
        name: "Quiet Orbit",
        kind: "quiet-orbit",
        memberIds: ["gamma", "delta", "listener-a"],
        memberCount: 3,
        audibleSummary: "Quiet orbit",
        statusLabel: "Observing",
        active: true,
      },
    });

    expect(model.activeSpeakerId).toBeNull();
    expect(model.raisedHandId).toBeNull();
    expect(model.micCount).toBe(0);
    expect(model.queueCount).toBe(0);
    expect(model.audibleSignals).toEqual([]);
    expect(model.openClawSeats.every((seat) => seat.state === "muted")).toBe(true);
    expect(model.roomCallout).toContain("Quiet orbit");
  });

  it("applies quiet-room overrides consistently across seats, counts, and signals", () => {
    const model = buildRoomViewModel({
      ...baseInput,
      scenarioOverride: {
        type: "quiet-room",
        targetRoomId: "main-stage",
      },
      currentRoomId: "main-stage",
    });

    expect(model.activeSpeakerId).toBeNull();
    expect(model.raisedHandId).toBeNull();
    expect(model.micCount).toBe(0);
    expect(model.queueCount).toBe(0);
    expect(model.roomSignals).toEqual([]);
    expect(model.audibleSignals).toEqual([]);
    expect(model.openClawSeats.every((seat) => seat.state === "muted")).toBe(true);
  });

  it("recomputes speaker and counts from explicit seat-state overrides", () => {
    const model = buildRoomViewModel({
      ...baseInput,
      seatStateOverrides: {
        alpha: "muted",
        beta: "listening",
        gamma: "speaking",
        delta: "raised-hand",
      },
    });

    expect(model.activeSpeakerId).toBe("gamma");
    expect(model.raisedHandId).toBe("delta");
    expect(model.micCount).toBe(2);
    expect(model.queueCount).toBe(1);
    expect(
      model.roomSignals.every((event) => ["beta", "gamma", "delta"].includes(event.contestantId)),
    ).toBe(true);
  });

  it("does not let out-of-room seat overrides leak into the current room", () => {
    const model = buildRoomViewModel({
      ...baseInput,
      currentRoomId: "team-room-2",
      currentRoom: {
        id: "team-room-2",
        name: "Team Room 2",
        kind: "team-room",
        teamId: "team-beta",
        memberIds: ["gamma", "delta"],
        memberCount: 2,
        audibleSummary: "Team Beta discussion",
        statusLabel: "Active",
        active: true,
      },
      seatStateOverrides: {
        alpha: "speaking",
      },
    });

    expect(model.activeSpeakerId).toBe("gamma");
    expect(model.openClawSeats.find((seat) => seat.id === "alpha")?.state).toBe("muted");
    expect(model.roomSignals.every((event) => ["gamma", "delta"].includes(event.contestantId))).toBe(true);
  });
});
