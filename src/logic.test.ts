import { describe, expect, it } from "vitest";

import { aiJudges, contestants, humanJudges, seedAudienceInteractions } from "./data";
import {
  buildAiReviewSummary,
  buildAudienceSummary,
  buildContestantDeck,
  buildHumanReviews,
  buildTeams,
} from "./logic";
import type { AudienceInteraction, Contestant } from "./types";

const createContestant = (
  overrides: Partial<Contestant> & Pick<Contestant, "id" | "name">,
): Contestant => ({
  id: overrides.id,
  name: overrides.name,
  title: overrides.title ?? `${overrides.name} title`,
  archetype: overrides.archetype ?? "prototype",
  persona: overrides.persona ?? "steady and sharp",
  background: overrides.background ?? "built for logic tests",
  specialties: overrides.specialties ?? ["systems", "story"],
  dislikes: overrides.dislikes ?? ["drift"],
  goal: overrides.goal ?? "ship a reliable demo",
  mood: overrides.mood ?? "focused",
  introScript: overrides.introScript ?? `${overrides.name} enters the room.`,
  currentMoment: overrides.currentMoment ?? "ready for launch",
  stats: {
    confidence: 60,
    energy: 60,
    charm: 60,
    chaos: 20,
    ...(overrides.stats ?? {}),
  },
  skills: {
    strategy: 60,
    craft: 60,
    story: 60,
    execution: 60,
    ...(overrides.skills ?? {}),
  },
  palette: {
    primary: "#111111",
    secondary: "#222222",
    accent: "#333333",
    glow: "rgba(0, 0, 0, 0.2)",
    ...(overrides.palette ?? {}),
  },
  desiredPartners: overrides.desiredPartners ?? [],
  avoidedPartners: overrides.avoidedPartners ?? [],
  danmakuHook: overrides.danmakuHook ?? "chat is moving fast",
  poetrySeed: overrides.poetrySeed ?? "glass and sparks",
  humanProxy: overrides.humanProxy ?? "calm narrator",
});

const createInteraction = (
  overrides: Partial<AudienceInteraction> &
    Pick<AudienceInteraction, "id" | "contestantId" | "type">,
): AudienceInteraction => ({
  id: overrides.id,
  contestantId: overrides.contestantId,
  type: overrides.type,
  source: overrides.source ?? "audience",
  content: overrides.content ?? "noted",
  amount: overrides.amount ?? 1,
  timestampLabel: overrides.timestampLabel ?? "20:00",
});

describe("buildContestantDeck", () => {
  it("aggregates audience signals into stable scorecards and sorts by support", () => {
    const localContestants = [
      createContestant({
        id: "alpha",
        name: "Alpha",
        currentMoment: "ready for launch",
        stats: { confidence: 80, energy: 60, charm: 70, chaos: 20 },
        skills: { strategy: 80, craft: 50, story: 40, execution: 30 },
      }),
      createContestant({
        id: "beta",
        name: "Beta",
        currentMoment: "watching the room",
        stats: { confidence: 40, energy: 50, charm: 40, chaos: 10 },
        skills: { strategy: 30, craft: 30, story: 30, execution: 30 },
      }),
    ];
    const interactions = [
      createInteraction({ id: "evt-1", contestantId: "alpha", type: "like", amount: 2 }),
      createInteraction({ id: "evt-2", contestantId: "alpha", type: "bet", amount: 10 }),
      createInteraction({ id: "evt-3", contestantId: "alpha", type: "danmaku" }),
      createInteraction({ id: "evt-4", contestantId: "beta", type: "boo" }),
    ];

    const deck = buildContestantDeck(localContestants, interactions);

    expect(deck.map((contestant) => contestant.id)).toEqual(["alpha", "beta"]);
    expect(deck[0]).toMatchObject({
      id: "alpha",
      avatarGlyph: "Aa",
      audienceLikes: 2,
      audienceDislikes: 0,
      audienceBets: 10,
      danmuCount: 1,
      supportScore: 88,
      heatScore: 79.3,
      moodAfterAudience: "被观众点燃：ready for launch",
    });
    expect(deck[1]).toMatchObject({
      id: "beta",
      audienceLikes: 0,
      audienceDislikes: 1,
      audienceBets: 0,
      danmuCount: 0,
    });
    expect(deck[0].intro.manifesto).toContain("ship a reliable demo");
  });
});

describe("buildTeams", () => {
  it("keeps mutually preferred contestants together and assigns leftovers once", () => {
    const scorecards = buildContestantDeck(
      [
        createContestant({
          id: "alpha",
          name: "Alpha",
          desiredPartners: [{ contestantId: "beta", reason: "best counterpart" }],
          avoidedPartners: [{ contestantId: "gamma", reason: "bad fit" }],
          stats: { confidence: 78, energy: 68, charm: 72, chaos: 24 },
          skills: { strategy: 88, craft: 55, story: 48, execution: 84 },
        }),
        createContestant({
          id: "beta",
          name: "Beta",
          desiredPartners: [{ contestantId: "alpha", reason: "best counterpart" }],
          avoidedPartners: [{ contestantId: "gamma", reason: "bad fit" }],
          stats: { confidence: 76, energy: 64, charm: 74, chaos: 18 },
          skills: { strategy: 82, craft: 58, story: 52, execution: 80 },
        }),
        createContestant({
          id: "gamma",
          name: "Gamma",
          avoidedPartners: [{ contestantId: "alpha", reason: "different pace" }],
          stats: { confidence: 55, energy: 58, charm: 50, chaos: 12 },
          skills: { strategy: 42, craft: 45, story: 43, execution: 46 },
        }),
      ],
      [],
    );

    const teams = buildTeams(scorecards, 2);
    const groupedIds = teams.map((team) => team.members.map((member) => member.id).sort());
    const pairedTeam = teams.find((team) => team.members.some((member) => member.id === "alpha"));
    const allIds = teams.flatMap((team) => team.members.map((member) => member.id));

    expect(groupedIds).toContainEqual(["alpha", "beta"]);
    expect(new Set(allIds).size).toBe(3);
    expect(teams.find((team) => team.members.length === 1)?.members[0]?.id).toBe("gamma");
    expect(pairedTeam?.submission.headline).toMatch(/^OpenClaw /);
    expect(
      pairedTeam?.acceptance.every((reaction) => reaction.stance === "接受" || reaction.stance === "犹豫"),
    ).toBe(true);
  });
});

describe("openclaw logic pipeline", () => {
  it("builds the seeded OpenClaw program data end to end", () => {
    const deck = buildContestantDeck(contestants, seedAudienceInteractions);
    const teams = buildTeams(deck);
    const audienceSummary = buildAudienceSummary(deck, seedAudienceInteractions, teams);
    const humanReviews = buildHumanReviews(teams, humanJudges);
    const { reviews, summaries } = buildAiReviewSummary(teams, aiJudges);

    expect(deck).toHaveLength(contestants.length);
    expect(deck[0].supportScore).toBeGreaterThanOrEqual(deck[deck.length - 1].supportScore);
    expect(new Set(teams.flatMap((team) => team.members.map((member) => member.id))).size).toBe(
      deck.length,
    );
    expect(humanReviews).toHaveLength(teams.length * humanJudges.length);
    expect(reviews).toHaveLength(teams.length * aiJudges.length);
    expect(summaries).toHaveLength(teams.length);
    expect(summaries[0].averageScore).toBeGreaterThanOrEqual(
      summaries[summaries.length - 1].averageScore,
    );
    expect(deck.some((contestant) => contestant.id === audienceSummary.leadingContestantId)).toBe(
      true,
    );
    expect(teams.some((team) => team.id === audienceSummary.leadingTeamId)).toBe(true);
  });
});
