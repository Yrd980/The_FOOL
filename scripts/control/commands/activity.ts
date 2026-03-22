import {
  buildAssignTeamEnvelope,
  buildCommandEnvelope,
  buildFinishActivityEnvelope,
  buildGrantAwardEnvelope,
  buildLockSubmissionEnvelope,
  buildMoveEntityEnvelope,
  buildOpenSubmissionEnvelope,
  buildStartTimerEnvelope,
  buildSubmitEnvelope,
  buildSubmitScoreEnvelope,
  buildTransitionStageEnvelope,
  buildUpdateSubmissionEnvelope,
} from "../../../src/openclaw/control";
import { dispatchOrPreview } from "../dispatch";
import {
  parseAssignTeamArgs,
  parseDrawArgs,
  parseFinishArgs,
  parseGrantAwardArgs,
  parseLongOptions,
  parseMoveEntityArgs,
  parsePayloadJson,
  parseStartTimerArgs,
  parseSubmissionCommandArgs,
  parseSubmitScoreArgs,
  readCommandConfirmationOption,
} from "../parse";
import { resolveActorId, resolveActorRole, fail, USAGE } from "../support";

export const handleStage = async (args: string[]): Promise<void> => {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId, targetStageId] = positional;
  if (!activityRunId || !targetStageId) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildTransitionStageEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      targetStageId,
      idempotencyKey: `stage-${activityRunId}-${targetStageId}-${Date.now()}`,
      confirmation: readCommandConfirmationOption(options),
    }),
    summary: `transition_stage ${activityRunId} -> ${targetStageId}`,
  });
};

export const handleFinish = async (args: string[]): Promise<void> => {
  const finish = parseFinishArgs(args);
  await dispatchOrPreview({
    envelope: buildFinishActivityEnvelope({
      actorId: resolveActorId(),
      activityRunId: finish.activityRunId,
      settlementMode: finish.settlementMode,
      winningTargetType: finish.winningTargetType,
      winningTargetId: finish.winningTargetId,
      note: finish.note,
      idempotencyKey: `finish-${finish.activityRunId}-${Date.now()}`,
      confirmation: finish.confirmation,
    }),
    summary:
      finish.settlementMode === "push"
        ? `finish ${finish.activityRunId} / push`
        : `finish ${finish.activityRunId} / ${finish.winningTargetType}:${finish.winningTargetId}`,
  });
};

export const handleStartTimer = async (args: string[]): Promise<void> => {
  const timer = parseStartTimerArgs(args);
  await dispatchOrPreview({
    envelope: buildStartTimerEnvelope({
      actorId: resolveActorId(),
      activityRunId: timer.activityRunId,
      stageId: timer.stageId,
      durationSec: timer.durationSec,
      idempotencyKey: `timer-${timer.activityRunId}-${timer.stageId}-${Date.now()}`,
    }),
    summary: `start_timer ${timer.activityRunId} / ${timer.stageId} (${timer.durationSec}s)`,
  });
};

export const handleOpenSubmission = async (args: string[]): Promise<void> => {
  const [activityRunId, submissionId] = args;
  if (!activityRunId || !submissionId) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildOpenSubmissionEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      submissionId,
      idempotencyKey: `open-${activityRunId}-${submissionId}-${Date.now()}`,
    }),
    summary: `open_submission ${activityRunId} / ${submissionId}`,
  });
};

export const handleSubmit = async (args: string[]): Promise<void> => {
  const submission = parseSubmissionCommandArgs(args);
  await dispatchOrPreview({
    envelope: buildSubmitEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: submission.activityRunId,
      submissionId: submission.submissionId,
      data: submission.data,
      idempotencyKey: `submit-${submission.activityRunId}-${submission.submissionId}-${Date.now()}`,
    }),
    summary: `submit ${submission.activityRunId} / ${submission.submissionId}`,
  });
};

export const handleUpdateSubmission = async (args: string[]): Promise<void> => {
  const submission = parseSubmissionCommandArgs(args);
  await dispatchOrPreview({
    envelope: buildUpdateSubmissionEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: submission.activityRunId,
      submissionId: submission.submissionId,
      data: submission.data,
      idempotencyKey: `update-submission-${submission.activityRunId}-${submission.submissionId}-${Date.now()}`,
    }),
    summary: `update_submission ${submission.activityRunId} / ${submission.submissionId}`,
  });
};

export const handleLockSubmission = async (args: string[]): Promise<void> => {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId, submissionId] = positional;
  if (!activityRunId || !submissionId) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildLockSubmissionEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      submissionId,
      idempotencyKey: `lock-${activityRunId}-${submissionId}-${Date.now()}`,
      confirmation: readCommandConfirmationOption(options),
    }),
    summary: `lock_submission ${activityRunId} / ${submissionId}`,
  });
};

export const handleSubmitScore = async (args: string[]): Promise<void> => {
  const { activityRunId, scorePayload } = parseSubmitScoreArgs(args);
  await dispatchOrPreview({
    envelope: buildSubmitScoreEnvelope({
      actorId: resolveActorId(),
      activityRunId,
      submissionId: scorePayload.submissionId,
      score: scorePayload.score,
      reason: scorePayload.reason,
      annotations: scorePayload.annotations,
      idempotencyKey: `submit-score-${activityRunId}-${scorePayload.submissionId}-${Date.now()}`,
    }),
    summary: `submit_score ${activityRunId} / ${scorePayload.submissionId} (${scorePayload.score}/10)`,
  });
};

export const handleGrantAward = async (args: string[]): Promise<void> => {
  const award = parseGrantAwardArgs(args);
  await dispatchOrPreview({
    envelope: buildGrantAwardEnvelope({
      actorId: resolveActorId(),
      activityRunId: award.activityRunId,
      awardId: award.awardId,
      entityId: award.entityId,
      label: award.label,
      reason: award.reason,
      idempotencyKey: `award-${award.activityRunId}-${award.awardId}-${Date.now()}`,
      confirmation: award.confirmation,
    }),
    summary: `grant_award ${award.activityRunId} / ${award.awardId} -> ${award.entityId}`,
  });
};

export const handleDraw = async (args: string[]): Promise<void> => {
  const draw = parseDrawArgs(args);
  const actorRole = resolveActorRole();
  await dispatchOrPreview({
    envelope: buildCommandEnvelope({
      actorId: resolveActorId(),
      actorRole: actorRole === "host" ? "agent" : actorRole,
      activityRunId: draw.activityRunId,
      type: "draw",
      payload: { entityId: draw.entityId, data: draw.drawData },
      idempotencyKey: `draw-${draw.activityRunId}-${draw.entityId}-${Date.now()}`,
    }),
    summary: `draw ${draw.activityRunId} / ${draw.entityId}`,
  });
};

export const handleMoveEntity = async (args: string[]): Promise<void> => {
  const move = parseMoveEntityArgs(args);
  await dispatchOrPreview({
    envelope: buildMoveEntityEnvelope({
      actorId: resolveActorId(),
      activityRunId: move.activityRunId,
      entityId: move.entityId,
      toRoomId: move.toRoomId,
      kind: move.kind,
      idempotencyKey: `move-entity-${move.activityRunId}-${move.entityId}-${Date.now()}`,
      confirmation: move.confirmation,
    }),
    summary: `move_entity ${move.activityRunId} / ${move.entityId} -> ${move.toRoomId}`,
  });
};

export const handleAssignTeam = async (args: string[]): Promise<void> => {
  const assignment = parseAssignTeamArgs(args);
  await dispatchOrPreview({
    envelope: buildAssignTeamEnvelope({
      actorId: resolveActorId(),
      activityRunId: assignment.activityRunId,
      teamId: assignment.teamId,
      memberIds: assignment.memberIds,
      roomId: assignment.roomId,
      idempotencyKey: `assign-team-${assignment.activityRunId}-${assignment.teamId}-${Date.now()}`,
      confirmation: assignment.confirmation,
    }),
    summary: `assign_team ${assignment.activityRunId} / ${assignment.teamId}${assignment.memberIds ? ` (${assignment.memberIds.length} members)` : ""}`,
  });
};

export const handleRawCommand = async (args: string[]): Promise<void> => {
  const { positional, options } = parseLongOptions(args);
  const [activityRunId, commandType, payloadJson] = positional;
  if (!activityRunId || !commandType || !payloadJson) {
    fail(USAGE);
  }

  await dispatchOrPreview({
    envelope: buildCommandEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId,
      type: commandType,
      payload: parsePayloadJson(payloadJson),
      idempotencyKey: `cmd-${commandType}-${Date.now()}`,
      confirmation: readCommandConfirmationOption(options),
    }),
    summary: `${commandType} ${activityRunId}`,
  });
};
