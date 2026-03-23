import type {
  BetPayload,
  BroadcastPayload,
  CommandConfirmation,
  CommandEnvelope,
  FinishActivityPayload,
  MessageAudienceScope,
  ReactionPayload,
  ScoreAnnotations,
  SubmissionData,
  TalkPayload,
  VotePayload,
  VoteTargetType,
} from "../platform/contracts";
import type {
  ControlActorRole,
  SubmissionCommandPayload,
  SubmitScorePayload,
} from "./types";
import {
  UNAVAILABLE_ROOM_ID,
  UNAVAILABLE_ROOM_LABEL,
} from "./types";
import {
  normalizeAgentId,
  normalizeAudienceScope,
  normalizeOptionalText,
  normalizeRequiredText,
  resolveRoomCatalog,
  type ActivityRoomCatalog,
  type ControlRoomResolutionOptions,
} from "./support";

export const resolveControlRoomId = (
  room: string,
  activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
): string => {
  const roomCatalog = resolveRoomCatalog(activityPackageId, options);
  if (!roomCatalog) {
    throw new Error("No activity room catalog is registered.");
  }
  const resolved = roomCatalog.aliasMap[room.trim().toLowerCase().replace(/[\s_]+/g, "-")];
  if (!resolved) {
    throw new Error(
      `Unknown room alias "${room}". Use ${roomCatalog.roomIds.join(", ")}.`,
    );
  }
  return resolved;
};

export const getGatewayRoomIds = (
  activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
): string[] =>
  resolveRoomCatalog(activityPackageId, options)?.roomIds ?? [];

export const buildGatewaySessionKey = (
  agentId: string,
  room: string,
  activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
): string =>
  `agent:${normalizeAgentId(agentId)}:${resolveControlRoomId(room, activityPackageId, options)}`;

const normalizeSessionRoomId = (
  roomId: string,
  activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
): string =>
  resolveRoomCatalog(activityPackageId, options)?.aliasMap[
    roomId.trim().toLowerCase().replace(/[\s_]+/g, "-")
  ] ?? roomId;

export const resolveSessionRoomId = (
  sessionKey: string | undefined,
  activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
): string => {
  const roomCatalog = resolveRoomCatalog(activityPackageId, options);
  if (!sessionKey) {
    return UNAVAILABLE_ROOM_ID;
  }

  const match = sessionKey.match(/^agent:[^:]+:(.+)$/);
  const roomId = normalizeSessionRoomId(
    match?.[1]?.trim() ?? "",
    activityPackageId,
    options,
  );

  if (!roomCatalog) {
    return UNAVAILABLE_ROOM_ID;
  }

  if (roomCatalog.roomIds.includes(roomId)) {
    return roomId;
  }

  return UNAVAILABLE_ROOM_ID;
};

export const getRoomLabel = (
  roomId: string,
  activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
): string =>
  roomId === UNAVAILABLE_ROOM_ID
    ? UNAVAILABLE_ROOM_LABEL
    : resolveRoomCatalog(activityPackageId, options)?.labels[roomId] ?? roomId;

export const buildMoveMessage = (
  room: string,
  activityPackageId?: string,
  options?: ControlRoomResolutionOptions,
): string => {
  const roomId = resolveControlRoomId(room, activityPackageId, options);
  const label = getRoomLabel(roomId, activityPackageId, options);
  return `Move to ${label}. Reply with one short line only.`;
};

export const buildCommandEnvelope = <TPayload extends Record<string, unknown>>({
  actorId,
  actorRole,
  activityRunId,
  type,
  payload,
  idempotencyKey,
  confirmation,
  issuedAt = Date.now(),
}: {
  actorId: string;
  actorRole: ControlActorRole;
  activityRunId?: string;
  type: string;
  payload: TPayload;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
  issuedAt?: number;
}): CommandEnvelope<TPayload> => ({
  id: idempotencyKey ?? `${type}-${issuedAt}`,
  actorId: normalizeAgentId(actorId),
  actorRole,
  activityRunId,
  type,
  payload,
  issuedAt,
  idempotencyKey,
  ...(confirmation ? { confirmation } : {}),
});

export const buildTransitionStageEnvelope = ({
  actorId,
  activityRunId,
  targetStageId,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  activityRunId: string;
  targetStageId: string;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<{ targetStageId: string }> =>
  buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "transition_stage",
    payload: { targetStageId: targetStageId.trim() },
    idempotencyKey,
    confirmation,
  });

export const buildStartTimerEnvelope = ({
  actorId,
  activityRunId,
  stageId,
  durationSec,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  activityRunId: string;
  stageId: string;
  durationSec: number;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<{ stageId: string; durationSec: number; kind: "countdown" }> =>
  buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "start_timer",
    payload: {
      stageId: stageId.trim(),
      durationSec: Math.max(1, Math.round(durationSec)),
      kind: "countdown",
    },
    idempotencyKey,
    confirmation,
  });

export const buildLockSubmissionEnvelope = ({
  actorId,
  activityRunId,
  submissionId,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  activityRunId: string;
  submissionId: string;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<{ submissionId: string }> =>
  buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "lock_submission",
    payload: { submissionId: submissionId.trim() },
    idempotencyKey,
    confirmation,
  });

export const buildOpenSubmissionEnvelope = ({
  actorId,
  activityRunId,
  submissionId,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  activityRunId: string;
  submissionId: string;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<{ submissionId: string }> =>
  buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "open_submission",
    payload: { submissionId: submissionId.trim() },
    idempotencyKey,
    confirmation,
  });

const buildSubmissionCommandEnvelope = ({
  actorId,
  actorRole = "agent",
  activityRunId,
  submissionId,
  data,
  idempotencyKey,
  confirmation,
  type,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  submissionId: string;
  data: SubmissionData;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
  type: "submit" | "update_submission";
}): CommandEnvelope<SubmissionCommandPayload> => {
  const normalizedSubmissionId = submissionId.trim();
  if (!normalizedSubmissionId) {
    throw new Error("Submission id is required.");
  }

  return buildCommandEnvelope({
    actorId,
    actorRole,
    activityRunId,
    type,
    payload: {
      submissionId: normalizedSubmissionId,
      data: structuredClone(data),
    },
    idempotencyKey,
    confirmation,
  });
};

export const buildSubmitEnvelope = ({
  actorId,
  actorRole = "agent",
  activityRunId,
  submissionId,
  data,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  submissionId: string;
  data: SubmissionData;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<SubmissionCommandPayload> =>
  buildSubmissionCommandEnvelope({
    actorId,
    actorRole,
    activityRunId,
    submissionId,
    data,
    idempotencyKey,
    confirmation,
    type: "submit",
  });

export const buildUpdateSubmissionEnvelope = ({
  actorId,
  actorRole = "agent",
  activityRunId,
  submissionId,
  data,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  submissionId: string;
  data: SubmissionData;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<SubmissionCommandPayload> =>
  buildSubmissionCommandEnvelope({
    actorId,
    actorRole,
    activityRunId,
    submissionId,
    data,
    idempotencyKey,
    confirmation,
    type: "update_submission",
  });

export const buildGrantAwardEnvelope = ({
  actorId,
  activityRunId,
  awardId,
  entityId,
  label,
  reason,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  activityRunId: string;
  awardId: string;
  entityId: string;
  label?: string;
  reason?: string;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<{
  awardId: string;
  entityId: string;
  label?: string;
  reason?: string;
}> =>
  buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "grant_award",
    payload: {
      awardId: awardId.trim(),
      entityId: entityId.trim(),
      ...(label?.trim() ? { label: label.trim() } : {}),
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    },
    idempotencyKey,
    confirmation,
  });

export const buildMoveEntityEnvelope = ({
  actorId,
  activityRunId,
  entityId,
  toRoomId,
  kind,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  activityRunId: string;
  entityId: string;
  toRoomId: string;
  kind?: string;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<{
  entityId: string;
  toRoomId: string;
  kind?: string;
}> =>
  buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "move_entity",
    payload: {
      entityId: entityId.trim(),
      toRoomId: toRoomId.trim(),
      ...(kind?.trim() ? { kind: kind.trim() } : {}),
    },
    idempotencyKey,
    confirmation,
  });

export const buildAssignTeamEnvelope = ({
  actorId,
  activityRunId,
  teamId,
  memberIds,
  roomId,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  activityRunId: string;
  teamId: string;
  memberIds?: string[];
  roomId?: string;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<{
  teamId: string;
  memberIds?: string[];
  roomId?: string;
}> =>
  buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "assign_team",
    payload: {
      teamId: teamId.trim(),
      ...(memberIds ? { memberIds } : {}),
      ...(roomId?.trim() ? { roomId: roomId.trim() } : {}),
    },
    idempotencyKey,
    confirmation,
  });

export const buildTalkEnvelope = ({
  actorId,
  actorRole = "agent",
  activityRunId,
  message,
  roomId,
  targetEntityId,
  audienceScope,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  message: string;
  roomId?: string;
  targetEntityId?: string;
  audienceScope?: MessageAudienceScope;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<TalkPayload> =>
  buildCommandEnvelope({
    actorId,
    actorRole,
    activityRunId,
    type: "talk",
    payload: {
      message: normalizeRequiredText(message, "Talk message"),
      ...(normalizeOptionalText(roomId) ? { roomId: normalizeOptionalText(roomId) } : {}),
      ...(normalizeOptionalText(targetEntityId)
        ? { targetEntityId: normalizeOptionalText(targetEntityId) }
        : {}),
      ...(normalizeAudienceScope(audienceScope)
        ? { audienceScope: normalizeAudienceScope(audienceScope) }
        : {}),
    },
    idempotencyKey,
    confirmation,
  });

export const buildBroadcastEnvelope = ({
  actorId,
  actorRole = "host",
  activityRunId,
  message,
  roomId,
  teamId,
  audienceScope,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  message: string;
  roomId?: string;
  teamId?: string;
  audienceScope?: MessageAudienceScope;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<BroadcastPayload> =>
  buildCommandEnvelope({
    actorId,
    actorRole,
    activityRunId,
    type: "broadcast",
    payload: {
      message: normalizeRequiredText(message, "Broadcast message"),
      ...(normalizeOptionalText(roomId) ? { roomId: normalizeOptionalText(roomId) } : {}),
      ...(normalizeOptionalText(teamId) ? { teamId: normalizeOptionalText(teamId) } : {}),
      ...(normalizeAudienceScope(audienceScope)
        ? { audienceScope: normalizeAudienceScope(audienceScope) }
        : {}),
    },
    idempotencyKey,
    confirmation,
  });

export const buildReactionEnvelope = ({
  actorId,
  actorRole = "agent",
  activityRunId,
  reaction,
  roomId,
  targetEntityId,
  targetTeamId,
  note,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  reaction: string;
  roomId?: string;
  targetEntityId?: string;
  targetTeamId?: string;
  note?: string;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<ReactionPayload> =>
  buildCommandEnvelope({
    actorId,
    actorRole,
    activityRunId,
    type: "reaction",
    payload: {
      reaction: normalizeRequiredText(reaction, "Reaction"),
      ...(normalizeOptionalText(roomId) ? { roomId: normalizeOptionalText(roomId) } : {}),
      ...(normalizeOptionalText(targetEntityId)
        ? { targetEntityId: normalizeOptionalText(targetEntityId) }
        : {}),
      ...(normalizeOptionalText(targetTeamId)
        ? { targetTeamId: normalizeOptionalText(targetTeamId) }
        : {}),
      ...(normalizeOptionalText(note) ? { note: normalizeOptionalText(note) } : {}),
    },
    idempotencyKey,
    confirmation,
  });

export const buildBetEnvelope = ({
  actorId,
  actorRole = "agent",
  activityRunId,
  targetType,
  targetId,
  roomId,
  amount,
  odds,
  stance,
  note,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  targetType: BetPayload["targetType"];
  targetId: string;
  roomId?: string;
  amount?: number;
  odds?: number;
  stance?: string;
  note?: string;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<BetPayload> => {
  if (
    targetType !== "team" &&
    targetType !== "entity" &&
    targetType !== "submission"
  ) {
    throw new Error("Bet target type must be team, entity, or submission.");
  }

  const normalizedAmount =
    typeof amount === "number" && Number.isFinite(amount)
      ? Math.max(1, Math.round(amount))
      : undefined;
  const normalizedOdds =
    typeof odds === "number" && Number.isFinite(odds) && odds > 0
      ? Number(odds.toFixed(2))
      : undefined;

  return buildCommandEnvelope({
    actorId,
    actorRole,
    activityRunId,
    type: "bet",
    payload: {
      targetType,
      targetId: normalizeRequiredText(targetId, "Bet target id"),
      ...(normalizeOptionalText(roomId) ? { roomId: normalizeOptionalText(roomId) } : {}),
      ...(normalizedAmount !== undefined ? { amount: normalizedAmount } : {}),
      ...(normalizedOdds !== undefined ? { odds: normalizedOdds } : {}),
      ...(normalizeOptionalText(stance) ? { stance: normalizeOptionalText(stance) } : {}),
      ...(normalizeOptionalText(note) ? { note: normalizeOptionalText(note) } : {}),
    },
    idempotencyKey,
    confirmation,
  });
};

export const buildVoteEnvelope = ({
  actorId,
  actorRole = "viewer",
  activityRunId,
  targetType,
  targetId,
  roomId,
  value = 1,
  note,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  targetType: VoteTargetType;
  targetId: string;
  roomId?: string;
  value?: number;
  note?: string;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<VotePayload> => {
  if (
    targetType !== "team" &&
    targetType !== "entity" &&
    targetType !== "submission"
  ) {
    throw new Error("Vote target type must be team, entity, or submission.");
  }

  const normalizedValue =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(1, Math.round(value))
      : 1;

  return buildCommandEnvelope({
    actorId,
    actorRole,
    activityRunId,
    type: "vote",
    payload: {
      targetType,
      targetId: normalizeRequiredText(targetId, "Vote target id"),
      ...(normalizeOptionalText(roomId)
        ? { roomId: normalizeOptionalText(roomId) }
        : {}),
      value: normalizedValue,
      ...(normalizeOptionalText(note) ? { note: normalizeOptionalText(note) } : {}),
    },
    idempotencyKey,
    confirmation,
  });
};

export const buildFinishActivityEnvelope = ({
  actorId,
  activityRunId,
  settlementMode = "winner",
  winningTargetType,
  winningTargetId,
  note,
  endedAt,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  activityRunId: string;
  settlementMode?: "winner" | "push";
  winningTargetType?: VoteTargetType;
  winningTargetId?: string;
  note?: string;
  endedAt?: number;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<FinishActivityPayload> => {
  const normalizedSettlementMode =
    settlementMode === "push" ? "push" : "winner";
  const normalizedWinningTargetType =
    winningTargetType === "team" ||
    winningTargetType === "entity" ||
    winningTargetType === "submission"
      ? winningTargetType
      : undefined;
  const normalizedWinningTargetId = normalizeOptionalText(winningTargetId);
  if (
    normalizedSettlementMode !== "push" &&
    (!normalizedWinningTargetType || !normalizedWinningTargetId)
  ) {
    throw new Error(
      "finish_activity requires a winning target or settlementMode=push.",
    );
  }

  return buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "finish_activity",
    payload: {
      settlementMode: normalizedSettlementMode,
      ...(normalizedWinningTargetType
        ? { winningTargetType: normalizedWinningTargetType }
        : {}),
      ...(normalizedWinningTargetId
        ? { winningTargetId: normalizedWinningTargetId }
        : {}),
      ...(normalizeOptionalText(note) ? { note: normalizeOptionalText(note) } : {}),
      ...(typeof endedAt === "number" && Number.isFinite(endedAt)
        ? { endedAt: Math.round(endedAt) }
        : {}),
    },
    idempotencyKey,
    confirmation,
  });
};

export const buildSubmitScoreEnvelope = ({
  actorId,
  activityRunId,
  submissionId,
  score,
  reason,
  annotations,
  idempotencyKey,
  confirmation,
}: {
  actorId: string;
  activityRunId: string;
  submissionId: string;
  score: number;
  reason: string;
  annotations?: ScoreAnnotations;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}): CommandEnvelope<SubmitScorePayload> => {
  const normalizedScore = Math.round(score);
  if (!Number.isFinite(normalizedScore) || normalizedScore < 1 || normalizedScore > 10) {
    throw new Error("Score must be an integer between 1 and 10.");
  }

  const normalizedSubmissionId = submissionId.trim();
  const normalizedReason = reason.trim();
  const normalizedAnnotations = Object.entries(annotations ?? {}).reduce<ScoreAnnotations>(
    (result, [key, value]) => {
      const normalizedValue = value.trim();
      if (normalizedValue) {
        result[key] = normalizedValue;
      }
      return result;
    },
    {},
  );

  if (!normalizedSubmissionId) {
    throw new Error("Submission id is required.");
  }

  if (!normalizedReason) {
    throw new Error("Score reason is required.");
  }

  if (Object.keys(normalizedAnnotations).length === 0) {
    throw new Error("At least one score annotation is required.");
  }

  return buildCommandEnvelope({
    actorId,
    actorRole: "judge",
    activityRunId,
    type: "submit_score",
    payload: {
      submissionId: normalizedSubmissionId,
      score: normalizedScore,
      reason: normalizedReason,
      annotations: normalizedAnnotations,
    },
    idempotencyKey,
    confirmation,
  });
};

export type { ActivityRoomCatalog, ControlRoomResolutionOptions };
