import type {
  EventCommandContext,
  EventEnvelope,
  StageTemplate,
  SubmissionProjection,
  TimerProjection,
  TransitionRule,
} from "../../src/openclaw/platform/contracts";
import type { ProjectionState } from "./support";

interface RuntimeLoopContext {
  getProjection: () => ProjectionState;
  setProjection: (projection: ProjectionState) => void;
  appendEventRecord: (event: EventEnvelope) => void;
  writeProjection: (projection: ProjectionState) => void;
  applyEventToProjection: (
    current: ProjectionState,
    event: EventEnvelope,
  ) => ProjectionState;
  computeRemainingMs: (timer: TimerProjection, now?: number) => number;
  findStage: (stageId: string) => StageTemplate | undefined;
  isSubmissionReadyForScoring: (
    submission: SubmissionProjection,
  ) => boolean;
  broadcastEvent: (event: EventEnvelope) => void;
  now?: () => number;
  scheduleTimeout?: (
    callback: () => void,
    delay: number,
  ) => ReturnType<typeof setTimeout>;
  clearScheduledTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
}

const readRuleStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const normalized = entry.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return [...deduped];
};

const listStageSubmissions = ({
  projection,
  stageId,
  schemaIds,
}: {
  projection: ProjectionState;
  stageId: string;
  schemaIds: string[];
}): SubmissionProjection[] => {
  const schemaIdSet = new Set(schemaIds);
  return projection.submissions.filter(
    (submission) =>
      submission.stageId === stageId &&
      (schemaIdSet.size === 0 || schemaIdSet.has(submission.schemaId)),
  );
};

const findTransitionRulesForStage = (
  stageId: string | null,
  findStage: RuntimeLoopContext["findStage"],
): TransitionRule[] => {
  if (!stageId) {
    return [];
  }
  return findStage(stageId)?.transitionRules ?? [];
};

export const createRuntimeLoop = ({
  getProjection,
  setProjection,
  appendEventRecord,
  writeProjection,
  applyEventToProjection,
  computeRemainingMs,
  findStage,
  isSubmissionReadyForScoring,
  broadcastEvent,
  now = () => Date.now(),
  scheduleTimeout = setTimeout,
  clearScheduledTimeout = clearTimeout,
}: RuntimeLoopContext) => {
  const timerHandles = new Map<string, ReturnType<typeof setTimeout>>();

  const createQueuedEventBuilder = (
    context: EventCommandContext = {},
  ) => {
    const projection = getProjection();
    let sequence = projection.lastSequence;

    return <TPayload extends Record<string, unknown>>(
      type: string,
      payload: TPayload,
      issuedAt = now(),
    ): EventEnvelope<TPayload> => {
      sequence += 1;
      return {
        id: `evt-${sequence}`,
        sequence,
        type,
        activityRunId: projection.activityRun.id,
        commandId: context.commandId,
        idempotencyKey: context.idempotencyKey,
        actorId: context.actorId,
        actorRole: context.actorRole,
        timestamp: issuedAt,
        payload,
      };
    };
  };

  const commitEvents = (events: EventEnvelope[]): void => {
    let projection = getProjection();
    for (const event of events) {
      projection = applyEventToProjection(projection, event);
      appendEventRecord(event);
    }
    setProjection(projection);
    writeProjection(projection);
  };

  const clearTimerHandle = (timerId: string): void => {
    const handle = timerHandles.get(timerId);
    if (!handle) {
      return;
    }

    clearScheduledTimeout(handle);
    timerHandles.delete(timerId);
  };

  const allRequiredSubmissionsLocked = (
    config: Record<string, unknown>,
  ): boolean => {
    const projection = getProjection();
    const currentStageId = projection.activityRun.currentStageId;
    if (!currentStageId) {
      return false;
    }

    const stage = findStage(currentStageId);
    if (!stage) {
      return false;
    }

    const schemaIds = stage.submissionSchemaIds ?? [];
    if (schemaIds.length === 0) {
      return false;
    }

    const stageSubmissions = listStageSubmissions({
      projection,
      stageId: currentStageId,
      schemaIds,
    });
    if (stageSubmissions.length === 0) {
      return false;
    }

    if (!stageSubmissions.every((submission) => submission.locked)) {
      return false;
    }

    const requiredTeamIds = readRuleStringList(config.requiredTeamIds);
    if (requiredTeamIds.length === 0) {
      return true;
    }

    return requiredTeamIds.every((teamId) =>
      stageSubmissions.some((submission) => submission.teamId === teamId),
    );
  };

  const allScoresCompleted = (config: Record<string, unknown>): boolean => {
    const expectedJudgeCount =
      typeof config.expectedJudgeCount === "number"
        ? config.expectedJudgeCount
        : 0;
    if (expectedJudgeCount <= 0) {
      return false;
    }

    const projection = getProjection();
    const currentStageId = projection.activityRun.currentStageId;
    if (!currentStageId) {
      return false;
    }

    const submissionSchemaIds = readRuleStringList(config.submissionSchemaIds);
    const requiredTeamIds = readRuleStringList(config.requiredTeamIds);
    const scoreableLockedSubmissions = projection.submissions.filter((submission) => {
      if (!submission.locked || !isSubmissionReadyForScoring(submission)) {
        return false;
      }

      if (
        submissionSchemaIds.length > 0 &&
        !submissionSchemaIds.includes(submission.schemaId)
      ) {
        return false;
      }

      if (
        requiredTeamIds.length > 0 &&
        (!submission.teamId || !requiredTeamIds.includes(submission.teamId))
      ) {
        return false;
      }

      return true;
    });
    if (scoreableLockedSubmissions.length === 0) {
      return false;
    }

    const judgesBySubmissionId = new Map<string, Set<string>>();
    for (const score of projection.scores) {
      if (score.stageId !== currentStageId || !score.submissionId) {
        continue;
      }

      const judges = judgesBySubmissionId.get(score.submissionId) ?? new Set<string>();
      judges.add(score.judgeId);
      judgesBySubmissionId.set(score.submissionId, judges);
    }

    return scoreableLockedSubmissions.every(
      (submission) =>
        (judgesBySubmissionId.get(submission.id)?.size ?? 0) >= expectedJudgeCount,
    );
  };

  const evaluateTransitionRules = (
    triggerEventType: string,
  ): { issuedAt: number; payload: Record<string, unknown> } | null => {
    const projection = getProjection();
    const currentStageId = projection.activityRun.currentStageId;
    const rules = findTransitionRulesForStage(currentStageId, findStage);
    if (rules.length === 0) {
      return null;
    }

    for (const rule of rules) {
      let shouldTransition = false;

      if (rule.type === "timer_expired" && triggerEventType === "timer.ended") {
        shouldTransition = true;
      }

      if (
        rule.type === "all_required_submissions_locked" &&
        triggerEventType === "submission.locked"
      ) {
        shouldTransition = allRequiredSubmissionsLocked(rule.config);
      }

      if (
        rule.type === "scores_completed" &&
        triggerEventType === "judge.score_submitted"
      ) {
        shouldTransition = allScoresCompleted(rule.config);
      }

      if (shouldTransition && rule.targetStageId && findStage(rule.targetStageId)) {
        return {
          issuedAt: now(),
          payload: {
            activityRunId: projection.activityRun.id,
            fromStageId: currentStageId,
            toStageId: rule.targetStageId,
            stageId: rule.targetStageId,
            changedBy: "transition-rule-evaluator",
            transitionRuleId: rule.id,
            transitionRuleType: rule.type,
          },
        };
      }
    }

    return null;
  };

  const applyTransitionRuleAfterEvent = (
    triggerEventType: string,
  ): EventEnvelope[] => {
    const transition = evaluateTransitionRules(triggerEventType);
    if (!transition) {
      return [];
    }

    const projection = getProjection();
    const queueEvent = createQueuedEventBuilder();
    const pauseEvents: EventEnvelope[] = [];
    const activeTimers = projection.timers.filter((timer) => timer.state === "running");
    for (const timer of activeTimers) {
      const pausedAt = now();
      pauseEvents.push(
        queueEvent(
          "timer.paused",
          {
            stageId: timer.stageId,
            reason: "auto_stage_transition",
            timer: {
              ...timer,
              remainingMs: computeRemainingMs(timer, pausedAt),
              state: "paused",
              pausedAt,
            },
          },
          pausedAt,
        ),
      );
    }

    const autoTransitionEvent = queueEvent(
      "stage.changed",
      transition.payload,
      transition.issuedAt,
    );
    return [...pauseEvents, autoTransitionEvent];
  };

  const scheduleTimerEnd = (timer: TimerProjection): void => {
    clearTimerHandle(timer.id);
    if (timer.state !== "running" || typeof timer.endsAt !== "number") {
      return;
    }

    const delay = Math.max(0, timer.endsAt - now());
    const handle = scheduleTimeout(() => {
      const projection = getProjection();
      const latestTimer = projection.timers.find((entry) => entry.id === timer.id);
      if (!latestTimer || latestTimer.state !== "running") {
        return;
      }

      const endedAt = now();
      const queueEvent = createQueuedEventBuilder(latestTimer.commandContext ?? {});
      const timerEndedEvent = queueEvent(
        "timer.ended",
        {
          stageId: latestTimer.stageId,
          timer: {
            ...latestTimer,
            remainingMs: 0,
            state: "ended",
            endedAt,
            endsAt: latestTimer.endsAt,
          },
        },
        endedAt,
      );
      commitEvents([timerEndedEvent]);
      clearTimerHandle(latestTimer.id);
      broadcastEvent(timerEndedEvent);

      const autoEvents = applyTransitionRuleAfterEvent("timer.ended");
      if (autoEvents.length > 0) {
        commitEvents(autoEvents);
        syncTimerSchedules();
        for (const autoEvent of autoEvents) {
          broadcastEvent(autoEvent);
        }
      }
    }, delay);

    timerHandles.set(timer.id, handle);
  };

  const syncTimerSchedules = (): void => {
    for (const timer of getProjection().timers) {
      if (timer.state === "running") {
        scheduleTimerEnd(timer);
      } else {
        clearTimerHandle(timer.id);
      }
    }
  };

  return {
    applyTransitionRuleAfterEvent,
    commitEvents,
    syncTimerSchedules,
  };
};
