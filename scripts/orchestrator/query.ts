import type {
  EventEnvelope,
  ScoreProjection,
} from "../../src/openclaw/platform/contracts";
import {
  OrchestratorError,
  type AuditQueryResult,
  type AuditRecord,
  type EventQueryResult,
  type ProjectionState,
  type ScoreQueryResult,
} from "./support";

export interface OrchestratorEventQueryArgs {
  activityRunId?: string;
  afterSequence?: number;
  fromSequence?: number;
  toSequence?: number;
  limit: number;
}

export const parsePositiveInt = (
  rawValue: string | null,
  field: string,
): number | undefined => {
  if (rawValue === null || rawValue.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new OrchestratorError({
      code: "INVALID_QUERY",
      message: `${field} must be a non-negative integer.`,
      status: 400,
      handledAt: Date.now(),
    });
  }

  return parsed;
};

export const parseLimit = (
  rawValue: string | null,
  defaultValue: number,
): number => {
  const parsed = parsePositiveInt(rawValue, "limit");
  return Math.max(1, Math.min(200, parsed ?? defaultValue));
};

export const resolveRequestedActivityRunId = ({
  activityRunId,
  currentActivityRunId,
}: {
  activityRunId: string | undefined;
  currentActivityRunId: string;
}): string => {
  if (!activityRunId) {
    return currentActivityRunId;
  }

  if (activityRunId !== currentActivityRunId) {
    throw new OrchestratorError({
      code: "UNKNOWN_ACTIVITY_RUN",
      message: `Unknown activity run ${activityRunId}. Expected ${currentActivityRunId}.`,
      status: 404,
      handledAt: Date.now(),
    });
  }

  return activityRunId;
};

const queryEventPage = ({
  projection,
  readEventLog,
  activityRunId,
  afterSequence,
  fromSequence,
  toSequence,
  limit,
  eventType,
}: OrchestratorEventQueryArgs & {
  projection: ProjectionState;
  readEventLog: () => EventEnvelope[];
  eventType?: string;
}): EventQueryResult => {
  if (
    typeof afterSequence === "number" &&
    typeof fromSequence === "number"
  ) {
    throw new OrchestratorError({
      code: "INVALID_QUERY",
      message: "Use afterSequence or fromSequence, not both.",
      status: 400,
      handledAt: Date.now(),
    });
  }

  const resolvedActivityRunId = resolveRequestedActivityRunId({
    activityRunId,
    currentActivityRunId: projection.activityRun.id,
  });

  const log = readEventLog().filter((event) => {
    const sameActivityRun =
      (event.activityRunId ?? projection.activityRun.id) === resolvedActivityRunId;
    const matchesType = !eventType || event.type === eventType;
    return sameActivityRun && matchesType;
  });

  const requestedFromSequence =
    typeof fromSequence === "number"
      ? fromSequence
      : typeof afterSequence === "number"
        ? afterSequence + 1
        : undefined;

  const ranged = log.filter((event) => {
    if (
      typeof requestedFromSequence === "number" &&
      event.sequence < requestedFromSequence
    ) {
      return false;
    }

    if (typeof toSequence === "number" && event.sequence > toSequence) {
      return false;
    }

    return true;
  });

  const page =
    typeof requestedFromSequence === "number"
      ? ranged.slice(0, limit)
      : ranged.slice(-limit);

  return {
    activityRunId: resolvedActivityRunId,
    fromSequence: page[0]?.sequence ?? requestedFromSequence ?? null,
    toSequence:
      page.length > 0
        ? page[page.length - 1].sequence
        : typeof toSequence === "number"
          ? toSequence
          : null,
    lastSequence: projection.lastSequence,
    hasMore: ranged.length > page.length,
    events: page,
  };
};

export const queryEvents = ({
  projection,
  readEventLog,
  ...args
}: OrchestratorEventQueryArgs & {
  projection: ProjectionState;
  readEventLog: () => EventEnvelope[];
}): EventQueryResult =>
  queryEventPage({
    projection,
    readEventLog,
    ...args,
  });

export const queryScoreEvents = ({
  projection,
  readEventLog,
  ...args
}: OrchestratorEventQueryArgs & {
  projection: ProjectionState;
  readEventLog: () => EventEnvelope[];
}): EventQueryResult =>
  queryEventPage({
    projection,
    readEventLog,
    eventType: "judge.score_submitted",
    ...args,
  });

export const queryScores = ({
  projection,
  readEventLog,
  buildScoreSummary,
  ...args
}: OrchestratorEventQueryArgs & {
  projection: ProjectionState;
  readEventLog: () => EventEnvelope[];
  buildScoreSummary: (scores: ScoreProjection[]) => ScoreQueryResult["scoreSummary"];
}): ScoreQueryResult => {
  const eventPage = queryScoreEvents({
    projection,
    readEventLog,
    ...args,
  });

  const resolvedScores = projection.scores
    .filter(
      (score) =>
        (score.activityRunId ?? projection.activityRun.id) ===
        eventPage.activityRunId,
    )
    .sort((left, right) => {
      if (right.submittedAt !== left.submittedAt) {
        return right.submittedAt - left.submittedAt;
      }
      return left.id.localeCompare(right.id);
    });

  return {
    activityRunId: eventPage.activityRunId,
    currentStageId: projection.activityRun.currentStageId,
    scoreCount: resolvedScores.length,
    scores: resolvedScores,
    scoreSummary: buildScoreSummary(resolvedScores),
    fromSequence: eventPage.fromSequence,
    toSequence: eventPage.toSequence,
    lastSequence: eventPage.lastSequence,
    hasMore: eventPage.hasMore,
    events: eventPage.events,
  };
};

export const queryAudit = ({
  projection,
  readAuditLog,
  activityRunId,
  limit,
}: {
  projection: ProjectionState;
  readAuditLog: () => AuditRecord[];
  activityRunId?: string;
  limit: number;
}): AuditQueryResult => {
  const resolvedActivityRunId = resolveRequestedActivityRunId({
    activityRunId,
    currentActivityRunId: projection.activityRun.id,
  });

  const records = readAuditLog().filter(
    (record) =>
      (record.activityRunId ?? projection.activityRun.id) ===
      resolvedActivityRunId,
  );
  const page = records.slice(-limit);

  return {
    activityRunId: resolvedActivityRunId,
    count: page.length,
    hasMore: records.length > page.length,
    records: page,
  };
};
