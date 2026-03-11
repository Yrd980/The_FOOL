import { describe, expect, it } from "vitest";

import { deriveConversationState } from "./deriveConversationState";
import type {
  ActDefinition,
  AiTeamSummary,
  AudienceOverview,
  ContestantScorecard,
  TeamSummary,
} from "../types";

const createContestant = (id: string, name: string): ContestantScorecard => ({
  id,
  name,
  title: `${name} title`,
  archetype: `${name} archetype`,
  persona: `${name} persona`,
  background: `${name} background`,
  specialties: [`${name} specialty`],
  dislikes: [`${name} dislike`],
  goal: `${name} goal`,
  mood: `${name} mood`,
  introScript: `${name} intro`,
  currentMoment: `${name} current moment`,
  stats: { confidence: 60, energy: 60, charm: 60, chaos: 20 },
  skills: { strategy: 60, craft: 60, story: 60, execution: 60 },
  palette: {
    primary: "#111111",
    secondary: "#222222",
    accent: "#333333",
    glow: "rgba(0, 0, 0, 0.2)",
  },
  desiredPartners: [],
  avoidedPartners: [],
  danmakuHook: `${name} danmaku`,
  poetrySeed: `${name} poetry`,
  humanProxy: `${name} proxy`,
  avatarGlyph: name.slice(0, 2).toUpperCase(),
  styleTitle: `${name} style`,
  strengths: [`${name} strength`],
  currentEmotion: `${name} emotion`,
  confidence: 60,
  energy: 60,
  preferences: {
    want: [],
    avoid: [],
  },
  audienceLikes: 0,
  audienceDislikes: 0,
  audienceBets: 0,
  danmuCount: 0,
  supportScore: 0,
  heatScore: 0,
  moodAfterAudience: `${name} after audience`,
  intro: {
    tagline: `${name} tagline`,
    manifesto: `${name} manifesto`,
    reveal: `${name} reveal`,
  },
});

const createTeam = (
  id: string,
  name: string,
  members: ContestantScorecard[],
  headline: string,
): TeamSummary => ({
  id,
  name,
  theme: `${name} theme`,
  accent: "#444444",
  members,
  totalSkills: { strategy: 180, craft: 180, story: 180, execution: 180 },
  affinityScore: 80,
  balanceScore: 80,
  audiencePull: 80,
  acceptance: [],
  discussion: [],
  submission: {
    posterLabel: `${headline} poster`,
    posterMood: `${headline} mood`,
    headline,
    problem: `${headline} problem`,
    coreFeatures: [`${headline} feature`],
    route: [`${headline} route`],
    roles: [],
    elevatorPitch: `${headline} pitch`,
    highlights: [`${headline} highlight`],
    risk: `${headline} risk`,
  },
});

const alpha = createContestant("alpha", "Alpha");
const beta = createContestant("beta", "Beta");
const gamma = createContestant("gamma", "Gamma");
const delta = createContestant("delta", "Delta");
const epsilon = createContestant("epsilon", "Epsilon");
const zeta = createContestant("zeta", "Zeta");

const contestantDeck = [alpha, beta, gamma, delta, epsilon, zeta];
const contestantMap = Object.fromEntries(
  contestantDeck.map((contestant) => [contestant.id, contestant]),
) as Record<string, ContestantScorecard>;
const focusTeam = createTeam("team-focus", "Focus Team", [gamma, delta, epsilon], "Focus Headline");
const championTeam = createTeam(
  "team-champion",
  "Champion Team",
  [alpha, beta],
  "Champion Headline",
);
const reserveTeam = createTeam("team-reserve", "Reserve Team", [zeta], "Reserve Headline");
const teams = [focusTeam, championTeam, reserveTeam];
const aiSummaries: AiTeamSummary[] = [
  {
    teamId: championTeam.id,
    averageScore: 96,
    totalScore: 288,
    favoriteHighlights: ["highlight"],
    strongestReason: "strongest reason",
    outrageousMoments: ["outrageous"],
  },
];
const audienceSummary: AudienceOverview = {
  totalLikes: 0,
  totalDislikes: 0,
  totalBetPoints: 0,
  totalDanmu: 0,
  heatIndex: 0,
  leadingContestantId: zeta.id,
  leadingTeamId: focusTeam.id,
};
const baseInput = {
  contestantDeck,
  contestantMap,
  focusTeam,
  teams,
  leadingTeam: focusTeam,
  aiSummaries,
  audienceSummary,
  selectedContestant: epsilon,
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
});
