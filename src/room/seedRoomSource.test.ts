import { describe, expect, it } from "vitest";

import { appendSeedInteraction, reduceRoomAction } from "./seedRoomSource";
import { createSeedRoomSnapshot } from "./testFixtures";
import type { AudienceInteraction } from "../types";

const contestants = [
  { id: "alpha", name: "Alpha" },
  { id: "beta", name: "Beta" },
  { id: "gamma", name: "Gamma" },
];

const audienceHandles = ["观众 01", "押注池", "弹幕 03"];
const danmuTemplates = ["{name} 太强了！", "{name} 看起来要赢。"];

const seedInteractions: AudienceInteraction[] = [
  { id: "evt-1", contestantId: "alpha", type: "danmaku", source: "观众 01", content: "Alpha 好强", amount: 1, timestampLabel: "20:08" },
  { id: "evt-2", contestantId: "beta", type: "bet", source: "押注池", content: "Beta 加注", amount: 12, timestampLabel: "20:09" },
];

describe("appendSeedInteraction", () => {
  it("adds one deterministic audience event using the current rotation rules", () => {
    const next = appendSeedInteraction({
      current: seedInteractions,
      contestants,
      audienceHandles,
      danmuTemplates,
    });

    expect(next).toHaveLength(seedInteractions.length + 1);
    expect(next.at(-1)?.id).toMatch(/^evt-live-/);
  });

  it("rotates through contestants deterministically", () => {
    let current = seedInteractions;

    for (let i = 0; i < 6; i++) {
      current = appendSeedInteraction({ current, contestants, audienceHandles, danmuTemplates });
    }

    const ids = current.slice(seedInteractions.length).map((event) => event.contestantId);

    expect(ids).toEqual([
      contestants[2 % 3].id,
      contestants[3 % 3].id,
      contestants[4 % 3].id,
      contestants[5 % 3].id,
      contestants[6 % 3].id,
      contestants[7 % 3].id,
    ]);
  });

  it("cycles through event types in the fixed pattern", () => {
    let current: AudienceInteraction[] = [];

    for (let i = 0; i < 6; i++) {
      current = appendSeedInteraction({ current, contestants, audienceHandles, danmuTemplates });
    }

    const types = current.map((event) => event.type);

    expect(types).toEqual(["bet", "like", "danmaku", "like", "boo", "danmaku"]);
  });

  it("calculates bet amounts deterministically", () => {
    const next = appendSeedInteraction({
      current: [],
      contestants,
      audienceHandles,
      danmuTemplates,
    });

    const event = next[0];

    expect(event.type).toBe("bet");
    expect(event.amount).toBe(8 + ((0 * 3) % 19));
  });
});

describe("reduceRoomAction", () => {
  it("switches rooms without changing speaker state", () => {
    const state = createSeedRoomSnapshot();
    const next = reduceRoomAction(state, { type: "switch-room", roomId: "team-room-1" });
    expect(next.currentRoomId).toBe("team-room-1");
    expect(next.priorityContestantId).toBeNull();
  });

  it("keeps join/leave idempotent", () => {
    const state = createSeedRoomSnapshot();
    const joined = reduceRoomAction(state, { type: "join-conversation" });
    expect(joined.currentUserMode).toBe("listening");
    expect(reduceRoomAction(joined, { type: "join-conversation" }).currentUserMode).toBe("listening");
    expect(reduceRoomAction(joined, { type: "leave-conversation" }).currentUserMode).toBe("perimeter");
  });

  it("supports audio-mode, pause, scenario, and reset", () => {
    const state = createSeedRoomSnapshot();
    const focused = reduceRoomAction(state, { type: "set-audio-mode", mode: "focus" });
    expect(focused.audioMode).toBe("focus");
    expect(reduceRoomAction(focused, { type: "toggle-feed-paused" }).feedPaused).toBe(true);

    const withScenario = reduceRoomAction(state, {
      type: "inject-scenario",
      scenario: "quiet-room",
      targetRoomId: "team-room-1",
    });
    expect(withScenario.scenarioOverride).toMatchObject({ type: "quiet-room", targetRoomId: "team-room-1" });

    const reset = reduceRoomAction(withScenario, { type: "reset-demo" });
    expect(reset.currentRoomId).toBe("main-stage");
    expect(reset.audioMode).toBe("nearby");
    expect(reset.feedPaused).toBe(false);
  });

  it("reset-demo preserves activeStageId", () => {
    const state = createSeedRoomSnapshot({ activeStageId: "act-5", currentRoomId: "team-room-1", feedPaused: true });
    const reset = reduceRoomAction(state, { type: "reset-demo" });
    expect(reset.activeStageId).toBe("act-5");
    expect(reset.currentRoomId).toBe("main-stage");
    expect(reset.feedPaused).toBe(false);
  });

  it("falls back to main-stage for unknown room", () => {
    const state = createSeedRoomSnapshot();
    expect(reduceRoomAction(state, { type: "switch-room", roomId: "missing" }).currentRoomId).toBe("main-stage");
  });

  it("wave-over requires main-stage and selectedContestantId", () => {
    const state = createSeedRoomSnapshot({ selectedContestantId: "glass-sea" });
    const result = reduceRoomAction(state, {
      type: "inject-scenario",
      scenario: "wave-over",
      targetRoomId: "main-stage",
    });
    expect(result.scenarioOverride).toMatchObject({
      type: "wave-over",
      targetRoomId: "main-stage",
      targetContestantId: "glass-sea",
    });
  });

  it("wave-over is no-op without selectedContestantId", () => {
    const state = createSeedRoomSnapshot();
    const result = reduceRoomAction(state, {
      type: "inject-scenario",
      scenario: "wave-over",
      targetRoomId: "main-stage",
    });
    expect(result.scenarioOverride).toMatchObject({ type: "none" });
  });

  it("wave-over is no-op when targetRoomId is not main-stage", () => {
    const state = createSeedRoomSnapshot({ selectedContestantId: "glass-sea" });
    const result = reduceRoomAction(state, {
      type: "inject-scenario",
      scenario: "wave-over",
      targetRoomId: "team-room-1",
    });
    expect(result.scenarioOverride).toMatchObject({ type: "none" });
  });

  it("inject-scenario none clears override", () => {
    const state = createSeedRoomSnapshot({
      scenarioOverride: { type: "quiet-room", targetRoomId: "team-room-1" },
    });
    const result = reduceRoomAction(state, { type: "inject-scenario", scenario: "none" });
    expect(result.scenarioOverride).toMatchObject({ type: "none" });
  });
});
