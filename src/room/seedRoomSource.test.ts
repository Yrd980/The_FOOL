import { describe, expect, it } from "vitest";

import { appendSeedInteraction } from "./seedRoomSource";
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
