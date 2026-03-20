import type {
  ProjectionState,
  SessionProjection,
  ScoreQueryResult,
} from "./support";

export const buildHealthAgents = (
  sessions: Map<string, SessionProjection>,
) =>
  Array.from(sessions.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((session) => ({
      agentId: session.agentId,
      sessions: {
        recent: [
          {
            key: session.key,
            updatedAt: session.updatedAt,
          },
        ],
      },
    }));

export const buildSnapshotEnvelope = ({
  projection,
  sessions,
  now = Date.now(),
  computeRemainingMs,
  buildScoreSummary,
}: {
  projection: ProjectionState;
  sessions: Map<string, SessionProjection>;
  now?: number;
  computeRemainingMs: (timer: ProjectionState["timers"][number], now?: number) => number;
  buildScoreSummary: (scores: ProjectionState["scores"]) => ScoreQueryResult["scoreSummary"];
}) => ({
  snapshotId: projection.snapshotId,
  activityRun: projection.activityRun,
  world: projection.world,
  timers: projection.timers.map((timer) => ({
    id: timer.id,
    stageId: timer.stageId,
    remainingMs: computeRemainingMs(timer, now),
    state: timer.state,
  })),
  skills: projection.skills,
  submissions: projection.submissions.map((submission) => ({
    id: submission.id,
    activityRunId: submission.activityRunId,
    submitterId: submission.submitterId,
    schemaId: submission.schemaId,
    data: submission.data,
    version: submission.version,
    versions: submission.versions,
    locked: submission.locked,
    teamId: submission.teamId,
    stageId: submission.stageId,
    openedAt: submission.openedAt,
    updatedAt: submission.updatedAt,
    lockedAt: submission.lockedAt,
  })),
  scores: projection.scores.map((score) => ({
    id: score.id,
    activityRunId: score.activityRunId,
    stageId: score.stageId,
    judgeId: score.judgeId,
    judgeRole: score.judgeRole,
    targetType: score.targetType,
    targetId: score.targetId,
    submissionId: score.submissionId,
    teamId: score.teamId,
    score: score.score,
    reason: score.reason,
    annotations: score.annotations,
    submittedAt: score.submittedAt,
  })),
  scoreSummary: buildScoreSummary(projection.scores),
  awards: projection.awards.map((award) => ({
    awardId: award.awardId,
    label: award.label,
    entityId: award.entityId,
    reason: award.reason,
    grantedAt: award.grantedAt,
  })),
  lastSequence: projection.lastSequence,
  health: {
    agents: buildHealthAgents(sessions),
    ts: now,
  },
});

