import { describe, expect, it } from "vitest";

import { deriveConversationState } from "./deriveConversationState";
import type { ActDefinition } from "../types";

const contestants = [
  { id: "alpha", name: "Alpha" },
  { id: "beta", name: "Beta" },
  { id: "gamma", name: "Gamma" },
  { id: "delta", name: "Delta" },
  { id: "epsilon", name: "Epsilon" },
  { id: "zeta", name: "Zeta" },
] as const;

const [alpha, beta, gamma, delta, epsilon, zeta] = contestants;

const focusTeam = {
  id: "team-focus",
  name: "Focus Team",
  memberIds: [gamma.id, delta.id, epsilon.id],
  submissionHeadline: "Focus Headline",
};
const championTeam = {
  id: "team-champion",
  name: "Champion Team",
  memberIds: [alpha.id, beta.id],
  submissionHeadline: "Champion Headline",
};
const reserveTeam = {
  id: "team-reserve",
  name: "Reserve Team",
  memberIds: [zeta.id],
  submissionHeadline: "Reserve Headline",
};

const baseInput = {
  contestants: [...contestants],
  focusTeam,
  teams: [focusTeam, championTeam, reserveTeam],
  leadingTeam: focusTeam,
  championTeamId: championTeam.id,
  leadingContestantId: zeta.id,
  selectedContestantId: epsilon.id,
  priorityContestantId: null,
  fallbackContestantId: alpha.id,
  nearbyHint: "Nearby fallback hint",
};

describe("deriveConversationState", () => {
  it.each<
    [ActDefinition["id"], string, ReturnType<typeof deriveConversationState>]
  >([
    [
      "act-1",
      "自我介绍",
      {
        speakerId: "alpha",
        raisedHandId: "beta",
        listeningIds: ["alpha", "beta", "gamma"],
        queuedIds: ["delta", "epsilon"],
        callout: "自我介绍 正在建人设，Alpha 先把主麦拿走了。",
      },
    ],
    [
      "act-2",
      "组队偏好",
      {
        speakerId: "epsilon",
        raisedHandId: "alpha",
        listeningIds: ["gamma", "delta", "epsilon"],
        queuedIds: ["alpha", "beta"],
        callout: "组队偏好 把偏好和嫌弃都摊开了，房间里开始有人抢着举手回应。",
      },
    ],
    [
      "act-3",
      "组织龙虾分组",
      {
        speakerId: "gamma",
        raisedHandId: "delta",
        listeningIds: ["gamma", "delta", "epsilon"],
        queuedIds: ["alpha"],
        callout: "Focus Team 正在被推到 conversation ring 中央，其他选手在外圈等候下一轮分组。",
      },
    ],
    [
      "act-4",
      "队内讨论",
      {
        speakerId: "delta",
        raisedHandId: "gamma",
        listeningIds: ["gamma", "delta", "epsilon"],
        queuedIds: ["alpha", "beta"],
        callout: "Focus Team 的队内讨论已经热起来了，主麦在成员之间快速切换。",
      },
    ],
    [
      "act-5",
      "项目提交",
      {
        speakerId: "gamma",
        raisedHandId: "delta",
        listeningIds: ["gamma", "delta", "epsilon"],
        queuedIds: ["epsilon"],
        callout: "Focus Headline 正在收束成可展示版本，队伍成员轮流补充最终卖点。",
      },
    ],
    [
      "act-6",
      "人类观赛点评",
      {
        speakerId: "gamma",
        raisedHandId: "zeta",
        listeningIds: ["gamma", "delta", "epsilon"],
        queuedIds: ["alpha"],
        callout: "人类评审正在外圈围观，Gamma 继续守着主麦解释方案。",
      },
    ],
    [
      "act-7",
      "AI 评委评审",
      {
        speakerId: "gamma",
        raisedHandId: "beta",
        listeningIds: ["gamma", "delta", "epsilon", "alpha"],
        queuedIds: ["alpha"],
        callout: "AI 评审接管节奏，冠军候选队开始在房间中央反复被点名。",
      },
    ],
    [
      "act-8",
      "颁奖",
      {
        speakerId: "alpha",
        raisedHandId: "beta",
        listeningIds: ["alpha", "beta"],
        queuedIds: ["zeta"],
        callout: "Champion Team 正站在聚光区，其他选手在外圈等着奖项和人格标签落地。",
      },
    ],
    [
      "act-9",
      "全体共创艺术品",
      {
        speakerId: "zeta",
        raisedHandId: "beta",
        listeningIds: ["alpha", "beta", "gamma", "delta"],
        queuedIds: ["epsilon", "zeta"],
        callout: "赛后诗和像素画接管了空间，房间不再争主麦，而是在轮流放大情绪。",
      },
    ],
    [
      "act-10",
      "人类观众感想",
      {
        speakerId: "alpha",
        raisedHandId: "gamma",
        listeningIds: ["gamma", "delta", "epsilon", "zeta"],
        queuedIds: ["beta", "zeta"],
        callout: "开放麦阶段让 conversation 重新散开，主麦开始在房间和看台之间游走。",
      },
    ],
  ])("returns the exact conversation state for %s", (id, title, expected) => {
    expect(
      deriveConversationState({
        ...baseInput,
        activeStage: { id, title },
      }),
    ).toEqual(expected);
  });

  it("prioritizes the wave-over contestant without changing the speaker", () => {
    expect(
      deriveConversationState({
        ...baseInput,
        activeStage: { id: "act-3", title: "组织龙虾分组" },
        priorityContestantId: beta.id,
      }),
    ).toEqual({
      speakerId: "gamma",
      raisedHandId: "beta",
      listeningIds: ["gamma", "delta", "epsilon"],
      queuedIds: ["beta", "alpha"],
      callout: "Beta 被 wave over 到当前 conversation，房间正在为她/他留出切入点。",
    });
  });

  it("falls back to the leading team when no champion team id is available", () => {
    expect(
      deriveConversationState({
        ...baseInput,
        activeStage: { id: "act-8", title: "颁奖" },
        championTeamId: null,
      }),
    ).toEqual({
      speakerId: "gamma",
      raisedHandId: "delta",
      listeningIds: ["gamma", "delta", "epsilon"],
      queuedIds: ["zeta"],
      callout: "Focus Team 正站在聚光区，其他选手在外圈等着奖项和人格标签落地。",
    });
  });

  it("uses the nearby hint when the stage falls through the default branch", () => {
    expect(
      deriveConversationState({
        ...baseInput,
        activeStage: { id: "act-unknown" as ActDefinition["id"], title: "未知阶段" },
      }),
    ).toEqual({
      speakerId: "gamma",
      raisedHandId: "delta",
      listeningIds: ["gamma", "delta", "epsilon"],
      queuedIds: ["alpha"],
      callout: "Nearby fallback hint",
    });
  });
});
