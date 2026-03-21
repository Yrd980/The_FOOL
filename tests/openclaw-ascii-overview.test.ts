import { describe, expect, test } from "bun:test";
import { buildOpenClawAsciiOverview } from "../src/openclaw/asciiOverview";
import type {
  OrchestratorEventPage,
  OrchestratorSnapshotResponse,
} from "../src/openclaw/orchestratorQueryClient";

const snapshotResponse: OrchestratorSnapshotResponse = {
  ok: true,
  snapshot: {
    snapshotId: "snapshot-12",
    activityRun: {
      id: "activity-run-01",
      templateId: "the-fool-v1",
      status: "running",
      currentStageId: "act-8-awards",
    },
    world: {
      rooms: [
        { id: "main-stage", label: "Main Stage" },
        { id: "team-room-1", label: "Team Room 1" },
        { id: "team-room-2", label: "Team Room 2" },
        { id: "team-room-3", label: "Team Room 3" },
      ],
      teams: [
        { id: "team-1", memberIds: ["contestant-01", "contestant-02"], roomId: "team-room-1" },
        { id: "team-2", memberIds: ["contestant-03", "contestant-04"], roomId: "team-room-2" },
        { id: "team-3", memberIds: ["contestant-05", "contestant-06"], roomId: "team-room-3" },
      ],
      entities: [
        { id: "contestant-01", kind: "agent", roomId: "team-room-1" },
        { id: "contestant-02", kind: "agent", roomId: "team-room-1" },
        { id: "contestant-03", kind: "agent", roomId: "team-room-2" },
        { id: "contestant-04", kind: "agent", roomId: "team-room-2" },
        { id: "contestant-05", kind: "agent", roomId: "main-stage" },
        { id: "contestant-06", kind: "agent", roomId: "main-stage" },
        { id: "host-01", kind: "host", roomId: "main-stage" },
      ],
    },
    timers: [
      {
        id: "timer-act-4",
        stageId: "act-4-discussion",
        remainingMs: 0,
        state: "ended",
      },
    ],
    submissions: [
      {
        id: "submission-1",
        schemaId: "team-project-v1",
        teamId: "team-1",
        stageId: "act-5-submission",
        locked: true,
        version: 2,
        openedAt: 1_742_520_060_000,
        updatedAt: 1_742_520_180_000,
        lockedAt: 1_742_520_240_000,
      },
      {
        id: "submission-2",
        schemaId: "team-project-v1",
        teamId: "team-2",
        stageId: "act-5-submission",
        locked: true,
        version: 1,
        openedAt: 1_742_520_060_000,
        updatedAt: 1_742_520_160_000,
        lockedAt: 1_742_520_260_000,
      },
    ],
    scores: [],
    scoreSummary: [
      {
        targetType: "submission",
        targetId: "submission-1",
        submissionId: "submission-1",
        teamId: "team-1",
        judgeCount: 3,
        totalScore: 26,
        averageScore: 8.67,
        lastSubmittedAt: 1_742_520_420_000,
      },
    ],
    awards: [
      {
        awardId: "most-absurd",
        label: "Most Absurd",
        entityId: "contestant-03",
        reason: "Unexpectedly coherent chaos",
        grantedAt: 1_742_520_480_000,
      },
    ],
    lastSequence: 12,
    health: {
      ts: 1_742_520_500_000,
      agents: [],
    },
  },
  stageTemplates: [
    { id: "act-1-intro", name: "自我介绍", allowedActions: ["talk", "query"] },
    { id: "act-4-discussion", name: "队内讨论", allowedActions: ["move", "talk", "broadcast", "query"] },
    {
      id: "act-5-submission",
      name: "项目提交",
      allowedActions: ["submit", "update_submission", "open_submission", "lock_submission", "query"],
    },
    { id: "act-7-ai-judging", name: "AI 评委评审", allowedActions: ["submit_score", "query"] },
    { id: "act-8-awards", name: "颁奖", allowedActions: ["broadcast", "grant_award", "query"] },
    { id: "act-9-co-creation", name: "全体共创艺术品", allowedActions: ["draw", "submit", "query"] },
  ],
};

const replayPage: OrchestratorEventPage = {
  ok: true,
  activityRunId: "activity-run-01",
  fromSequence: 1,
  toSequence: 12,
  lastSequence: 12,
  hasMore: false,
  events: [
    {
      id: "evt-1",
      sequence: 1,
      type: "activity.started",
      activityRunId: "activity-run-01",
      actorId: "host-01",
      actorRole: "host",
      timestamp: 1_742_520_000_000,
      payload: {
        activityRunId: "activity-run-01",
        stageId: "act-1-intro",
      },
    },
    {
      id: "evt-2",
      sequence: 2,
      type: "stage.changed",
      activityRunId: "activity-run-01",
      actorId: "host-01",
      actorRole: "host",
      timestamp: 1_742_520_030_000,
      payload: {
        fromStageId: "act-1-intro",
        toStageId: "act-4-discussion",
        stageId: "act-4-discussion",
      },
    },
    {
      id: "evt-3",
      sequence: 3,
      type: "timer.ended",
      activityRunId: "activity-run-01",
      actorId: "host-01",
      actorRole: "host",
      timestamp: 1_742_520_050_000,
      payload: {
        stageId: "act-4-discussion",
        timer: {
          id: "timer-act-4",
          stageId: "act-4-discussion",
        },
      },
    },
    {
      id: "evt-4",
      sequence: 4,
      type: "stage.changed",
      activityRunId: "activity-run-01",
      actorId: "host-01",
      actorRole: "host",
      timestamp: 1_742_520_055_000,
      payload: {
        fromStageId: "act-4-discussion",
        toStageId: "act-5-submission",
        stageId: "act-5-submission",
      },
    },
    {
      id: "evt-5",
      sequence: 5,
      type: "submission.opened",
      activityRunId: "activity-run-01",
      actorId: "host-01",
      actorRole: "host",
      timestamp: 1_742_520_060_000,
      payload: {
        submission: {
          id: "submission-1",
          schemaId: "team-project-v1",
          teamId: "team-1",
          stageId: "act-5-submission",
          locked: false,
        },
      },
    },
    {
      id: "evt-6",
      sequence: 6,
      type: "submission.updated",
      activityRunId: "activity-run-01",
      actorId: "contestant-01",
      actorRole: "agent",
      timestamp: 1_742_520_180_000,
      payload: {
        submission: {
          id: "submission-1",
          schemaId: "team-project-v1",
          teamId: "team-1",
          stageId: "act-5-submission",
          version: 2,
          locked: false,
        },
      },
    },
    {
      id: "evt-7",
      sequence: 7,
      type: "submission.locked",
      activityRunId: "activity-run-01",
      actorId: "host-01",
      actorRole: "host",
      timestamp: 1_742_520_240_000,
      payload: {
        submission: {
          id: "submission-1",
          schemaId: "team-project-v1",
          teamId: "team-1",
          stageId: "act-5-submission",
          version: 2,
          locked: true,
        },
      },
    },
    {
      id: "evt-8",
      sequence: 8,
      type: "stage.changed",
      activityRunId: "activity-run-01",
      actorId: "host-01",
      actorRole: "host",
      timestamp: 1_742_520_300_000,
      payload: {
        fromStageId: "act-5-submission",
        toStageId: "act-7-ai-judging",
        stageId: "act-7-ai-judging",
      },
    },
    {
      id: "evt-9",
      sequence: 9,
      type: "judge.score_submitted",
      activityRunId: "activity-run-01",
      actorId: "judge-01",
      actorRole: "judge",
      timestamp: 1_742_520_420_000,
      payload: {
        judgeScore: {
          submissionId: "submission-1",
          teamId: "team-1",
          stageId: "act-7-ai-judging",
          score: 9,
        },
      },
    },
    {
      id: "evt-10",
      sequence: 10,
      type: "stage.changed",
      activityRunId: "activity-run-01",
      actorId: "host-01",
      actorRole: "host",
      timestamp: 1_742_520_450_000,
      payload: {
        fromStageId: "act-7-ai-judging",
        toStageId: "act-8-awards",
        stageId: "act-8-awards",
      },
    },
  ],
};

const eventsPage: OrchestratorEventPage = {
  ok: true,
  activityRunId: "activity-run-01",
  fromSequence: 8,
  toSequence: 12,
  lastSequence: 12,
  hasMore: false,
  events: [
    ...replayPage.events.slice(-2),
    {
      id: "evt-11",
      sequence: 11,
      type: "entity.moved",
      activityRunId: "activity-run-01",
      actorId: "host-01",
      actorRole: "host",
      timestamp: 1_742_520_470_000,
      entityId: "contestant-05",
      payload: {
        entityId: "contestant-05",
        toRoomId: "main-stage",
      },
    },
    {
      id: "evt-12",
      sequence: 12,
      type: "award.granted",
      activityRunId: "activity-run-01",
      actorId: "host-01",
      actorRole: "host",
      timestamp: 1_742_520_480_000,
      payload: {
        award: {
          awardId: "most-absurd",
          label: "Most Absurd",
          entityId: "contestant-03",
        },
      },
    },
  ],
};

describe("buildOpenClawAsciiOverview", () => {
  test("renders a full authoritative show-control ascii console", () => {
    const output = buildOpenClawAsciiOverview({
      snapshotResponse,
      eventsPage,
      replayPage,
      eventLimit: 6,
      now: 1_742_520_540_000,
    });

    expect(output).toContain("THE FOOL AUTHORITATIVE ASCII WATCH");
    expect(output).toContain("stage    : act-8-awards [broadcast, grant_award, query]");
    expect(output).toContain("STAGE LADDER");
    expect(output).toContain("[x] act-5-submission (项目提交)");
    expect(output).toContain("[>] act-8-awards (颁奖) actions=broadcast,grant_award,query");
    expect(output).toContain("history  : act-1-intro -> act-4-discussion -> act-5-submission -> act-7-ai-judging -> act-8-awards");
    expect(output).toContain("ROOMS");
    expect(output).toContain("|-- main-stage (Main Stage) occupants=3");
    expect(output).toContain("contestant-05, contestant-06, host-01");
    expect(output).toContain("TEAMS");
    expect(output).toContain("|-- Team 1 @ team-room-1");
    expect(output).toContain("|   |-- contestant-01 [team-room-1] last: submit submission-1 v2 @ ");
    expect(output).toContain("|   trail: score submission-1 = 9/10 @ ");
    expect(output).toContain("TIMERS");
    expect(output).toContain("|-- timer-act-4 stage=act-4-discussion state=ended remaining=00:00");
    expect(output).toContain("SUBMISSIONS");
    expect(output).toContain("|-- submission-1 [team-project-v1] team=team-1 stage=act-5-submission state=locked version=v2");
    expect(output).toContain("SCOREBOARD");
    expect(output).toContain("|-- submission-1 team=team-1 judges=3 avg=8.67 total=26");
    expect(output).toContain("AWARDS");
    expect(output).toContain("|-- most-absurd label=Most Absurd entity=contestant-03");
    expect(output).toContain("RECENT AUTHORITATIVE EVENTS");
    expect(output).toContain("#0012 ");
    expect(output).toContain("host-01 :: award Most Absurd -> contestant-03");
  });

  test("renders authoritative social feed from talk, reaction, bet, and broadcast events", () => {
    const output = buildOpenClawAsciiOverview({
      snapshotResponse: {
        ...snapshotResponse,
        snapshot: {
          ...snapshotResponse.snapshot,
          lastSequence: 16,
        },
      },
      replayPage: {
        ...replayPage,
        lastSequence: 16,
        toSequence: 16,
        events: [
          ...replayPage.events,
          {
            id: "evt-13",
            sequence: 13,
            type: "agent.talked",
            activityRunId: "activity-run-01",
            actorId: "contestant-01",
            actorRole: "agent",
            timestamp: 1_742_520_490_000,
            payload: {
              stageId: "act-8-awards",
              roomId: "main-stage",
              message: "Absurdity is a feature, not a bug.",
            },
          },
          {
            id: "evt-14",
            sequence: 14,
            type: "reaction.added",
            activityRunId: "activity-run-01",
            actorId: "contestant-02",
            actorRole: "agent",
            timestamp: 1_742_520_495_000,
            payload: {
              stageId: "act-8-awards",
              reaction: "clap",
              targetEntityId: "contestant-01",
              note: "hard agree",
            },
          },
          {
            id: "evt-15",
            sequence: 15,
            type: "bet.placed",
            activityRunId: "activity-run-01",
            actorId: "contestant-03",
            actorRole: "agent",
            timestamp: 1_742_520_500_000,
            payload: {
              stageId: "act-8-awards",
              targetType: "team",
              targetId: "team-1",
              amount: 3,
              stance: "upset-pick",
            },
          },
          {
            id: "evt-16",
            sequence: 16,
            type: "broadcast.sent",
            activityRunId: "activity-run-01",
            actorId: "host-01",
            actorRole: "host",
            timestamp: 1_742_520_505_000,
            payload: {
              stageId: "act-8-awards",
              audienceScope: "global",
              message: "Awards are now live.",
            },
          },
        ],
      },
      eventsPage: {
        ok: true,
        activityRunId: "activity-run-01",
        fromSequence: 13,
        toSequence: 16,
        lastSequence: 16,
        hasMore: false,
        events: [
          {
            id: "evt-13",
            sequence: 13,
            type: "agent.talked",
            activityRunId: "activity-run-01",
            actorId: "contestant-01",
            actorRole: "agent",
            timestamp: 1_742_520_490_000,
            payload: {
              stageId: "act-8-awards",
              roomId: "main-stage",
              message: "Absurdity is a feature, not a bug.",
            },
          },
          {
            id: "evt-14",
            sequence: 14,
            type: "reaction.added",
            activityRunId: "activity-run-01",
            actorId: "contestant-02",
            actorRole: "agent",
            timestamp: 1_742_520_495_000,
            payload: {
              stageId: "act-8-awards",
              reaction: "clap",
              targetEntityId: "contestant-01",
              note: "hard agree",
            },
          },
          {
            id: "evt-15",
            sequence: 15,
            type: "bet.placed",
            activityRunId: "activity-run-01",
            actorId: "contestant-03",
            actorRole: "agent",
            timestamp: 1_742_520_500_000,
            payload: {
              stageId: "act-8-awards",
              targetType: "team",
              targetId: "team-1",
              amount: 3,
              stance: "upset-pick",
            },
          },
          {
            id: "evt-16",
            sequence: 16,
            type: "broadcast.sent",
            activityRunId: "activity-run-01",
            actorId: "host-01",
            actorRole: "host",
            timestamp: 1_742_520_505_000,
            payload: {
              stageId: "act-8-awards",
              audienceScope: "global",
              message: "Awards are now live.",
            },
          },
        ],
      },
      eventLimit: 8,
      now: 1_742_520_540_000,
    });

    expect(output).toContain("LIVE SOCIAL");
    expect(output).toContain("contestant-01 :: talk @ main-stage: Absurdity is a feature, not a bug.");
    expect(output).toContain("contestant-02 :: react clap -> contestant-01: hard agree");
    expect(output).toContain("contestant-03 :: bet team:team-1 amount=3 stance=upset-pick");
    expect(output).toContain("host-01 :: broadcast global: Awards are now live.");
  });
});
