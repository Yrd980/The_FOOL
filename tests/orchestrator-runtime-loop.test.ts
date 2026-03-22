import { describe, expect, test } from "bun:test";
import type {
  EventEnvelope,
  SubmissionProjection,
} from "../src/openclaw/platform/contracts";
import {
  applyEventToProjection,
  computeRemainingMs,
} from "../scripts/orchestrator/projection";
import { createRuntimeLoop } from "../scripts/orchestrator/runtimeLoop";
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
  stageTemplates: [],
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

describe("orchestrator runtime loop", () => {
  test("schedules timer expiry, commits timer.ended, and broadcasts it", () => {
    let projection: ProjectionState = {
      ...createBaseProjection(),
      lastSequence: 7,
      timers: [
        {
          id: "timer-1",
          stageId: "act-1-intro",
          durationSec: 5,
          remainingMs: 5_000,
          state: "running",
          kind: "countdown",
          startedAt: 1_000,
          endsAt: 1_005,
        },
      ],
    };
    let currentNow = 1_000;
    const appendedEvents: EventEnvelope[] = [];
    const broadcastEvents: EventEnvelope[] = [];
    const scheduled: Array<{ delay: number; callback: () => void }> = [];
    const loop = createRuntimeLoop({
      getProjection: () => projection,
      setProjection: (nextProjection) => {
        projection = nextProjection;
      },
      appendEventRecord: (event) => {
        appendedEvents.push(event);
      },
      writeProjection: () => {},
      applyEventToProjection,
      computeRemainingMs,
      findStage: () => undefined,
      isSubmissionReadyForScoring: () => false,
      broadcastEvent: (event) => {
        broadcastEvents.push(event);
      },
      now: () => currentNow,
      scheduleTimeout: (callback, delay) => {
        scheduled.push({ callback, delay });
        return { delay } as ReturnType<typeof setTimeout>;
      },
      clearScheduledTimeout: () => {},
    });

    loop.syncTimerSchedules();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.delay).toBe(5);

    currentNow = 1_005;
    scheduled[0]?.callback();

    expect(appendedEvents.map((event) => event.type)).toEqual(["timer.ended"]);
    expect(appendedEvents[0]?.sequence).toBe(8);
    expect(broadcastEvents.map((event) => event.type)).toEqual(["timer.ended"]);
    expect(projection.timers[0]).toMatchObject({
      id: "timer-1",
      state: "ended",
      remainingMs: 0,
      endedAt: 1_005,
    });
  });

  test("pauses active timers before auto-transitioning once all required submissions are locked", () => {
    let projection: ProjectionState = {
      ...createBaseProjection(),
      activityRun: {
        ...createBaseProjection().activityRun,
        currentStageId: "act-5-submission",
      },
      stageTemplates: [
        {
          id: "act-5-submission",
          name: "Submission",
          allowedActions: [],
          submissionSchemaIds: ["team-project-v1"],
          transitionRules: [
            {
              id: "rule-1",
              sourceStageId: "act-5-submission",
              targetStageId: "act-6-human-review",
              type: "all_required_submissions_locked",
              config: {
                requiredTeamIds: ["team-1", "team-2"],
              },
            },
          ],
        },
        {
          id: "act-6-human-review",
          name: "Human Review",
          allowedActions: [],
        },
      ],
      timers: [
        {
          id: "timer-1",
          stageId: "act-5-submission",
          durationSec: 30,
          remainingMs: 10_000,
          state: "running",
          kind: "countdown",
          startedAt: 1_000,
          endsAt: 11_000,
        },
      ],
      submissions: [
        {
          id: "submission-1",
          activityRunId: "activity-run-01",
          submitterId: "team-1",
          schemaId: "team-project-v1",
          data: { pitch: "one" },
          version: 1,
          versions: [
            {
              version: 1,
              updatedAt: 1_100,
              actorId: "agent-1",
              actorRole: "agent",
              data: { pitch: "one" },
            },
          ],
          locked: true,
          teamId: "team-1",
          stageId: "act-5-submission",
          updatedAt: 1_100,
        },
        {
          id: "submission-2",
          activityRunId: "activity-run-01",
          submitterId: "team-2",
          schemaId: "team-project-v1",
          data: { pitch: "two" },
          version: 1,
          versions: [
            {
              version: 1,
              updatedAt: 1_200,
              actorId: "agent-2",
              actorRole: "agent",
              data: { pitch: "two" },
            },
          ],
          locked: true,
          teamId: "team-2",
          stageId: "act-5-submission",
          updatedAt: 1_200,
        },
      ],
      lastSequence: 10,
    };
    const loop = createRuntimeLoop({
      getProjection: () => projection,
      setProjection: (nextProjection) => {
        projection = nextProjection;
      },
      appendEventRecord: () => {},
      writeProjection: () => {},
      applyEventToProjection,
      computeRemainingMs,
      findStage: (stageId) =>
        projection.stageTemplates.find((stage) => stage.id === stageId),
      isSubmissionReadyForScoring: () => true,
      broadcastEvent: () => {},
      now: () => 2_000,
    });

    const autoEvents = loop.applyTransitionRuleAfterEvent("submission.locked");
    expect(autoEvents.map((event) => event.type)).toEqual([
      "timer.paused",
      "stage.changed",
    ]);
    expect(autoEvents.map((event) => event.sequence)).toEqual([11, 12]);

    loop.commitEvents(autoEvents);
    expect(projection.timers[0]?.state).toBe("paused");
    expect(projection.activityRun.currentStageId).toBe("act-6-human-review");
  });

  test("waits for every required submission to receive all judge scores before auto-transitioning", () => {
    const readySubmission = (id: string, teamId: string): SubmissionProjection => ({
      id,
      activityRunId: "activity-run-01",
      submitterId: teamId,
      schemaId: "team-project-v1",
      data: { pitch: id },
      version: 1,
      versions: [
        {
          version: 1,
          updatedAt: 1_100,
          actorId: "agent-1",
          actorRole: "agent",
          data: { pitch: id },
        },
      ],
      locked: true,
      teamId,
      stageId: "act-7-ai-judging",
      updatedAt: 1_100,
    });

    let projection: ProjectionState = {
      ...createBaseProjection(),
      activityRun: {
        ...createBaseProjection().activityRun,
        currentStageId: "act-7-ai-judging",
      },
      stageTemplates: [
        {
          id: "act-7-ai-judging",
          name: "AI Judging",
          allowedActions: [],
          transitionRules: [
            {
              id: "rule-7",
              sourceStageId: "act-7-ai-judging",
              targetStageId: "act-8-awards",
              type: "scores_completed",
              config: {
                expectedJudgeCount: 2,
                requiredTeamIds: ["team-1", "team-2"],
                submissionSchemaIds: ["team-project-v1"],
              },
            },
          ],
        },
        {
          id: "act-8-awards",
          name: "Awards",
          allowedActions: [],
        },
      ],
      submissions: [
        readySubmission("submission-1", "team-1"),
        readySubmission("submission-2", "team-2"),
      ],
      scores: [
        {
          id: "score-1",
          activityRunId: "activity-run-01",
          stageId: "act-7-ai-judging",
          judgeId: "judge-1",
          judgeRole: "judge",
          targetType: "submission",
          targetId: "submission-1",
          submissionId: "submission-1",
          score: 8,
          reason: "good",
          annotations: {},
          submittedAt: 1_300,
        },
        {
          id: "score-2",
          activityRunId: "activity-run-01",
          stageId: "act-7-ai-judging",
          judgeId: "judge-2",
          judgeRole: "judge",
          targetType: "submission",
          targetId: "submission-1",
          submissionId: "submission-1",
          score: 9,
          reason: "great",
          annotations: {},
          submittedAt: 1_301,
        },
        {
          id: "score-3",
          activityRunId: "activity-run-01",
          stageId: "act-7-ai-judging",
          judgeId: "judge-1",
          judgeRole: "judge",
          targetType: "submission",
          targetId: "submission-2",
          submissionId: "submission-2",
          score: 8,
          reason: "good",
          annotations: {},
          submittedAt: 1_302,
        },
      ],
      lastSequence: 20,
    };
    const loop = createRuntimeLoop({
      getProjection: () => projection,
      setProjection: (nextProjection) => {
        projection = nextProjection;
      },
      appendEventRecord: () => {},
      writeProjection: () => {},
      applyEventToProjection,
      computeRemainingMs,
      findStage: (stageId) =>
        projection.stageTemplates.find((stage) => stage.id === stageId),
      isSubmissionReadyForScoring: (submission) => submission.version > 0,
      broadcastEvent: () => {},
      now: () => 2_000,
    });

    expect(loop.applyTransitionRuleAfterEvent("judge.score_submitted")).toEqual([]);

    projection = {
      ...projection,
      scores: [
        ...projection.scores,
        {
          id: "score-4",
          activityRunId: "activity-run-01",
          stageId: "act-7-ai-judging",
          judgeId: "judge-2",
          judgeRole: "judge",
          targetType: "submission",
          targetId: "submission-2",
          submissionId: "submission-2",
          score: 9,
          reason: "great",
          annotations: {},
          submittedAt: 1_303,
        },
      ],
    };

    const autoEvents = loop.applyTransitionRuleAfterEvent("judge.score_submitted");
    expect(autoEvents.map((event) => event.type)).toEqual(["stage.changed"]);
    expect(autoEvents[0]?.sequence).toBe(21);
    expect(autoEvents[0]?.payload).toMatchObject({
      fromStageId: "act-7-ai-judging",
      toStageId: "act-8-awards",
      transitionRuleType: "scores_completed",
    });
  });
});
