import { describe, expect, test } from "bun:test";
import type { EventEnvelope } from "../src/openclaw/platform/contracts";
import { applyEventToProjection } from "../scripts/orchestrator/projection";
import type { ProjectionState } from "../scripts/orchestrator/support";

const createBaseProjection = (): ProjectionState => ({
  version: 7,
  snapshotId: "snapshot-0",
  activityRun: {
    id: "activity-run-01",
    templateId: "the-fool-v1",
    status: "running",
    currentStageId: "act-1-intro",
    startedAt: 1_000,
  },
  stageTemplates: [
    {
      id: "act-1-intro",
      name: "Intro",
      allowedActions: [],
    },
  ],
  submissionSchemas: [
    {
      id: "team-project-v1",
      fields: [{ key: "pitch", type: "text", required: true }],
    },
  ],
  world: {
    rooms: [{ id: "main-stage", label: "Main Stage" }],
    teams: [],
    entities: [],
  },
  skills: [],
  timers: [],
  submissions: [],
  scores: [],
  awards: [],
  talks: [],
  reactions: [],
  bets: [],
  votes: [],
  social: {
    audienceHeat: [],
    betHeat: [],
    reactionTotals: [],
    betSummary: [],
    voteSummary: [],
    betSettlements: [],
  },
  lastSequence: 0,
});

const makeEvent = (
  sequence: number,
  type: string,
  payload: Record<string, unknown>,
  overrides: Partial<EventEnvelope> = {},
): EventEnvelope => ({
  id: `evt-${sequence}`,
  sequence,
  type,
  activityRunId: "activity-run-01",
  timestamp: 1_000 + sequence,
  payload,
  ...overrides,
});

describe("orchestrator projection reducer", () => {
  test("recomputes social aggregates from talk, reaction, bet, and vote events", () => {
    let projection = createBaseProjection();

    projection = applyEventToProjection(
      projection,
      makeEvent(1, "agent.talked", {
        message: "crowd noise",
        roomId: "main-stage",
      }, {
        actorId: "viewer-01",
        actorRole: "viewer",
      }),
    );
    projection = applyEventToProjection(
      projection,
      makeEvent(2, "reaction.added", {
        reaction: "clap",
        targetEntityId: "contestant-01",
      }, {
        actorId: "viewer-01",
        actorRole: "viewer",
      }),
    );
    projection = applyEventToProjection(
      projection,
      makeEvent(3, "bet.placed", {
        targetType: "team",
        targetId: "team-1",
        amount: 3,
      }, {
        actorId: "viewer-02",
        actorRole: "viewer",
      }),
    );
    projection = applyEventToProjection(
      projection,
      makeEvent(4, "vote.cast", {
        targetType: "team",
        targetId: "team-1",
        value: 2,
      }, {
        actorId: "viewer-03",
        actorRole: "viewer",
      }),
    );

    expect(
      projection.social.audienceHeat.find(
        (entry) => entry.scope === "global" && entry.targetId === "global",
      )?.value,
    ).toBe(4);
    expect(
      projection.social.reactionTotals.find(
        (entry) => entry.scope === "entity" && entry.targetId === "contestant-01",
      ),
    ).toEqual({
      scope: "entity",
      targetId: "contestant-01",
      total: 1,
      reactions: { clap: 1 },
      lastUpdatedAt: 1_002,
    });
    expect(
      projection.social.betHeat.find(
        (entry) => entry.scope === "team" && entry.targetId === "team-1",
      )?.value,
    ).toBe(3);
    expect(projection.social.voteSummary).toEqual([
      {
        targetType: "team",
        targetId: "team-1",
        count: 1,
        totalValue: 2,
        averageValue: 2,
        lastSubmittedAt: 1_004,
      },
    ]);
  });

  test("updates timer state and command context from timer events", () => {
    let projection = createBaseProjection();

    projection = applyEventToProjection(
      projection,
      makeEvent(1, "timer.started", {
        timer: {
          id: "timer-1",
          stageId: "act-1-intro",
          durationSec: 30,
          remainingMs: 30_000,
          endsAt: 31_000,
        },
      }, {
        commandId: "cmd-1",
        idempotencyKey: "idem-1",
        actorId: "host-01",
        actorRole: "host",
      }),
    );

    expect(projection.timers[0]).toMatchObject({
      id: "timer-1",
      stageId: "act-1-intro",
      durationSec: 30,
      remainingMs: 30_000,
      state: "running",
      commandContext: {
        commandId: "cmd-1",
        idempotencyKey: "idem-1",
        actorId: "host-01",
        actorRole: "host",
      },
    });

    projection = applyEventToProjection(
      projection,
      makeEvent(2, "timer.ended", {
        timer: {
          id: "timer-1",
          stageId: "act-1-intro",
          durationSec: 30,
          remainingMs: 0,
          state: "ended",
          endedAt: 31_000,
          endsAt: 31_000,
        },
      }),
    );

    expect(projection.timers[0]).toMatchObject({
      id: "timer-1",
      remainingMs: 0,
      state: "ended",
      endedAt: 31_000,
    });
  });

  test("stores authoritative bet settlements when the activity finishes", () => {
    const projection = {
      ...createBaseProjection(),
      bets: [
        {
          id: "evt-bet-1",
          activityRunId: "activity-run-01",
          actorId: "viewer-01",
          actorRole: "viewer" as const,
          targetType: "team" as const,
          targetId: "team-1",
          amount: 5,
          placedAt: 1_010,
        },
      ],
    };

    const next = applyEventToProjection(
      projection,
      makeEvent(2, "activity.finished", {
        endedAt: 2_000,
        betSettlements: [
          {
            betId: "evt-bet-1",
            actorId: "viewer-01",
            actorRole: "viewer",
            targetType: "team",
            targetId: "team-1",
            result: "won",
            payout: 10,
            settledAt: 2_000,
            winningTargetType: "team",
            winningTargetId: "team-1",
          },
        ],
      }),
    );

    expect(next.activityRun.status).toBe("finished");
    expect(next.activityRun.endedAt).toBe(2_000);
    expect(next.social.betSettlements).toEqual([
      {
        betId: "evt-bet-1",
        actorId: "viewer-01",
        actorRole: "viewer",
        targetType: "team",
        targetId: "team-1",
        amount: undefined,
        odds: undefined,
        stance: undefined,
        result: "won",
        payout: 10,
        settledAt: 2_000,
        winningTargetType: "team",
        winningTargetId: "team-1",
      },
    ]);
  });
});
