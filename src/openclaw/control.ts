import {
  type ActivityRoomCatalog,
} from "./activityRuntime";
import type {
  ActorRole as PlatformActorRole,
  BetPayload,
  BetTargetType,
  BroadcastPayload,
  CommandConfirmation,
  CommandEnvelope,
  MessageAudienceScope,
  ReactionPayload,
  ScoreAnnotations,
  SubmissionData,
  TalkPayload,
} from "./platform/contracts";

export type { CommandEnvelope };

const DIRECT_GATEWAY_URL = "ws://127.0.0.1:18789";
export const DEFAULT_ORCHESTRATOR_HTTP_URL = "http://127.0.0.1:18791";
const DEFAULT_COMMAND_PARAM_KEY = "command";
const KNOWN_ORCHESTRATION_EVENT_PREFIXES = [
  "activity.",
  "stage.",
  "timer.",
  "submission.",
  "judge.",
  "award.",
  "entity.",
  "team.",
  "draw.",
  "agent.",
  "broadcast.",
  "reaction.",
  "bet.",
] as const;

export const GATEWAY_CONNECT_CLIENT_ID = "openclaw-control";
export const GATEWAY_CONNECT_CLIENT_MODE = "operator";
export const GATEWAY_OPERATOR_READ_SCOPE = "operator.read";

export type ControlActorRole = PlatformActorRole;

export interface SubmissionCommandPayload extends Record<string, unknown> {
  submissionId: string;
  data: Record<string, unknown>;
}

export interface GatewayCapabilitySnapshot {
  methods: string[];
  events: string[];
}

export interface OrchestratorEventQuery {
  activityRunId?: string;
  afterSequence?: number;
  fromSequence?: number;
  toSequence?: number;
  limit?: number;
}

export interface OrchestratorSnapshotQuery {
  activityRunId?: string;
}

export interface OrchestratorAuditQuery {
  activityRunId?: string;
  limit?: number;
}

export const ORCHESTRATOR_HTTP_QUERY_PATHS = {
  snapshot: "/api/orchestrator/snapshot",
  scores: "/api/orchestrator/scores",
  events: "/api/orchestrator/events",
  replay: "/api/orchestrator/replay",
  audit: "/api/orchestrator/audit",
} as const;

export interface SubmitScorePayload extends Record<string, unknown> {
  submissionId: string;
  teamId?: string;
  score: number;
  reason: string;
  annotations?: ScoreAnnotations;
}

export interface DangerousCommandConfirmationRequirement {
  commandType: string;
  challenge: string;
  reason: string;
}

export const UNAVAILABLE_ROOM_ID = "openclaw:room-unavailable";
export const UNAVAILABLE_ROOM_LABEL = "Authority room unavailable";

interface ControlRoomResolutionOptions {
  roomCatalog?: ActivityRoomCatalog | null;
}

const normalizeAlias = (room: string): string =>
  room.trim().toLowerCase().replace(/[\s_]+/g, "-");

const resolveRoomCatalog = (
  _activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
) => options?.roomCatalog ?? null;

const normalizeAgentId = (agentId: string): string => {
  const normalized = agentId.trim();
  if (!normalized) {
    throw new Error("Agent id is required.");
  }
  return normalized;
};

const hasWrappingQuotes = (value: string): boolean =>
  value.length >= 2 &&
  ((value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")));

const normalizeRequiredText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
};

const normalizeOptionalText = (value?: string): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const normalizeAudienceScope = (
  value: MessageAudienceScope | undefined,
): MessageAudienceScope | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === "room" || value === "team" || value === "global") {
    return value;
  }

  throw new Error("Audience scope must be room, team, or global.");
};

export const normalizeCommandConfirmationChallenge = (
  value: string,
): string => value.trim().replace(/\s+/g, " ");

export const buildCommandConfirmation = (
  challenge: string,
  confirmedAt = Date.now(),
): CommandConfirmation => {
  const normalizedChallenge = normalizeCommandConfirmationChallenge(challenge);
  if (!normalizedChallenge) {
    throw new Error("Confirmation challenge is required.");
  }

  const normalizedConfirmedAt = Math.round(confirmedAt);
  if (!Number.isFinite(normalizedConfirmedAt) || normalizedConfirmedAt <= 0) {
    throw new Error("Confirmation timestamp must be a positive number.");
  }

  return {
    challenge: normalizedChallenge,
    confirmedAt: normalizedConfirmedAt,
  };
};

export const buildTransitionStageConfirmationChallenge = (
  targetStageId: string,
): string => {
  const normalizedStageId = targetStageId.trim();
  if (!normalizedStageId) {
    throw new Error("Target stage id is required.");
  }

  return normalizeCommandConfirmationChallenge(`PROMOTE ${normalizedStageId}`);
};

export const buildLockSubmissionConfirmationChallenge = (
  submissionId: string,
): string => {
  const normalizedSubmissionId = submissionId.trim();
  if (!normalizedSubmissionId) {
    throw new Error("Submission id is required.");
  }

  return normalizeCommandConfirmationChallenge(`LOCK ${normalizedSubmissionId}`);
};

export const buildGrantAwardConfirmationChallenge = ({
  awardId,
  entityId,
}: {
  awardId: string;
  entityId: string;
}): string => {
  const normalizedAwardId = awardId.trim();
  const normalizedEntityId = entityId.trim();
  if (!normalizedAwardId || !normalizedEntityId) {
    throw new Error("Award id and entity id are required.");
  }

  return normalizeCommandConfirmationChallenge(
    `AWARD ${normalizedAwardId} ${normalizedEntityId}`,
  );
};

export const buildMoveEntityConfirmationChallenge = ({
  entityId,
  toRoomId,
}: {
  entityId: string;
  toRoomId: string;
}): string => {
  const normalizedEntityId = entityId.trim();
  const normalizedRoomId = toRoomId.trim();
  if (!normalizedEntityId || !normalizedRoomId) {
    throw new Error("Entity id and destination room id are required.");
  }

  return normalizeCommandConfirmationChallenge(
    `MOVE ${normalizedEntityId} ${normalizedRoomId}`,
  );
};

export const buildAssignTeamConfirmationChallenge = (
  teamId: string,
): string => {
  const normalizedTeamId = teamId.trim();
  if (!normalizedTeamId) {
    throw new Error("Team id is required.");
  }

  return normalizeCommandConfirmationChallenge(`ASSIGN ${normalizedTeamId}`);
};

const readNonEmptyPayloadString = (
  payload: Record<string, unknown>,
  key: string,
): string | null => {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
};

export const resolveDangerousCommandConfirmationRequirement = (
  command: Pick<CommandEnvelope, "type" | "payload">,
): DangerousCommandConfirmationRequirement | null => {
  if (command.type === "transition_stage") {
    const targetStageId = readNonEmptyPayloadString(command.payload, "targetStageId");
    return targetStageId
      ? {
          commandType: command.type,
          challenge: buildTransitionStageConfirmationChallenge(targetStageId),
          reason: "changing authority currentStageId",
        }
      : null;
  }

  if (command.type === "lock_submission") {
    const submissionId = readNonEmptyPayloadString(command.payload, "submissionId");
    return submissionId
      ? {
          commandType: command.type,
          challenge: buildLockSubmissionConfirmationChallenge(submissionId),
          reason: "locking the authoritative submission payload",
        }
      : null;
  }

  if (command.type === "grant_award") {
    const awardId = readNonEmptyPayloadString(command.payload, "awardId");
    const entityId = readNonEmptyPayloadString(command.payload, "entityId");
    return awardId && entityId
      ? {
          commandType: command.type,
          challenge: buildGrantAwardConfirmationChallenge({ awardId, entityId }),
          reason: "granting an authoritative award",
        }
      : null;
  }

  if (command.type === "move_entity") {
    const entityId = readNonEmptyPayloadString(command.payload, "entityId");
    const toRoomId = readNonEmptyPayloadString(command.payload, "toRoomId");
    return entityId && toRoomId
      ? {
          commandType: command.type,
          challenge: buildMoveEntityConfirmationChallenge({ entityId, toRoomId }),
          reason: "rewriting authority world entity placement",
        }
      : null;
  }

  if (command.type === "assign_team") {
    const teamId = readNonEmptyPayloadString(command.payload, "teamId");
    return teamId
      ? {
          commandType: command.type,
          challenge: buildAssignTeamConfirmationChallenge(teamId),
          reason: "rewriting authority world team membership/room state",
        }
      : null;
  }

  return null;
};

export const satisfiesDangerousCommandConfirmation = ({
  command,
  requirement,
}: {
  command: Pick<CommandEnvelope, "confirmation">;
  requirement: DangerousCommandConfirmationRequirement;
}): boolean => {
  const confirmation = command.confirmation;
  if (!confirmation || !Number.isFinite(confirmation.confirmedAt)) {
    return false;
  }

  return (
    normalizeCommandConfirmationChallenge(confirmation.challenge) ===
    requirement.challenge
  );
};

export const normalizeControlConfigValue = (
  value: string | undefined,
): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return hasWrappingQuotes(trimmed) ? trimmed.slice(1, -1).trim() : trimmed;
};

export const normalizeControlDispatchMethod = (
  value: string | undefined,
): string | undefined => normalizeControlConfigValue(value);

export const normalizeControlCommandParamKey = (
  value: string | undefined,
): string => normalizeControlConfigValue(value) ?? DEFAULT_COMMAND_PARAM_KEY;

export const isKnownOrchestrationEvent = (eventName: string): boolean =>
  KNOWN_ORCHESTRATION_EVENT_PREFIXES.some((prefix) =>
    eventName.startsWith(prefix),
  );

export const summarizeGatewayOrchestrationContract = ({
  capabilities,
  configuredDispatchMethod,
}: {
  capabilities: GatewayCapabilitySnapshot;
  configuredDispatchMethod?: string;
}): {
  status: "available" | "blocked" | "unknown";
  note: string | null;
} => {
  const methods = capabilities.methods.filter(
    (method): method is string => typeof method === "string" && method.trim().length > 0,
  );
  const events = capabilities.events.filter(
    (event): event is string => typeof event === "string" && event.trim().length > 0,
  );

  if (methods.length === 0 && events.length === 0) {
    return { status: "unknown", note: null };
  }

  if (configuredDispatchMethod) {
    if (methods.includes(configuredDispatchMethod)) {
      return {
        status: "available",
        note: `Live gateway hello advertises ${configuredDispatchMethod}.`,
      };
    }

    return {
      status: "blocked",
      note: `Live gateway hello advertises ${methods.length} methods / ${events.length} events, but not ${configuredDispatchMethod}.`,
    };
  }

  const orchestrationEvents = events.filter(isKnownOrchestrationEvent);
  if (orchestrationEvents.length > 0) {
    return {
      status: "unknown",
      note: `Live gateway advertises orchestration-like events: ${orchestrationEvents.slice(0, 4).join(", ")}.`,
    };
  }

  return {
    status: "blocked",
    note:
      "Live gateway hello does not advertise stage/timer/submission/award events or any verified orchestration dispatch method.",
  };
};

export const resolveControlRoomId = (
  room: string,
  activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
): string => {
  const roomCatalog = resolveRoomCatalog(activityPackageId, options);
  if (!roomCatalog) {
    throw new Error("No activity room catalog is registered.");
  }
  const resolved = roomCatalog.aliasMap[normalizeAlias(room)];
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
  resolveRoomCatalog(activityPackageId, options)?.aliasMap[normalizeAlias(roomId)] ??
  roomId;

export const resolveSessionRoomId = (
  sessionKey: string | undefined,
  activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
): string => {
  const roomCatalog = resolveRoomCatalog(activityPackageId, options);
  if (!sessionKey) {
    return roomCatalog?.fallbackRoomId ?? UNAVAILABLE_ROOM_ID;
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

  return roomCatalog.fallbackRoomId;
};

export const getRoomLabel = (
  roomId: string,
  activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
): string =>
  roomId === UNAVAILABLE_ROOM_ID
    ? UNAVAILABLE_ROOM_LABEL
    : resolveRoomCatalog(activityPackageId, options)?.labels[roomId] ?? roomId;

export const normalizeControlGatewayUrl = (
  configuredUrl: string | undefined,
): string => {
  const normalized = normalizeControlConfigValue(configuredUrl);
  if (!normalized) {
    return DIRECT_GATEWAY_URL;
  }

  try {
    const parsed = new URL(normalized);
    if ((parsed.protocol === "ws:" || parsed.protocol === "wss:") && parsed.pathname === "/") {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return normalized;
  }

  return normalized;
};

export const normalizeOrchestratorBaseUrl = (
  value: string | undefined,
): string => {
  const normalized = normalizeControlConfigValue(value);
  if (!normalized) {
    return DEFAULT_ORCHESTRATOR_HTTP_URL;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "ws:") {
      parsed.protocol = "http:";
    } else if (parsed.protocol === "wss:") {
      parsed.protocol = "https:";
    }

    if (parsed.pathname === "/") {
      parsed.pathname = "";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return normalized.replace(/\/$/, "");
  }
};

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
  targetType: BetTargetType;
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

export const buildGatewayCallArgs = ({
  method,
  params,
  timeoutMs,
  gatewayUrl,
  token,
  expectFinal = false,
}: {
  method: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
  gatewayUrl?: string;
  token?: string;
  expectFinal?: boolean;
}): string[] => {
  const normalizedGatewayUrl = normalizeControlGatewayUrl(gatewayUrl);
  const args = [
    "gateway",
    "call",
    method.trim(),
    "--timeout",
    String(Math.max(1_000, timeoutMs ?? 10_000)),
    "--url",
    normalizedGatewayUrl,
  ];

  if (expectFinal) {
    args.push("--expect-final");
  }

  if (token?.trim()) {
    args.push("--token", token.trim());
  }

  args.push("--json", "--params", JSON.stringify(params ?? {}));
  return args;
};

export const buildGatewayDispatchCommandArgs = ({
  dispatchMethod,
  commandEnvelope,
  gatewayUrl,
  token,
  timeoutMs = 10_000,
  commandParamKey,
}: {
  dispatchMethod: string;
  commandEnvelope: CommandEnvelope;
  gatewayUrl?: string;
  token?: string;
  timeoutMs?: number;
  commandParamKey?: string;
}): string[] =>
  buildGatewayCallArgs({
    method: dispatchMethod,
    params: {
      [normalizeControlCommandParamKey(commandParamKey)]: commandEnvelope,
    },
    timeoutMs,
    gatewayUrl,
    token,
  });

export const buildGatewayAgentCallArgs = ({
  agentId,
  room,
  message,
  timeoutSeconds,
  gatewayUrl,
  token,
  idempotencyKey,
  activityPackageId,
  roomCatalog,
}: {
  agentId: string;
  room: string;
  message: string;
  timeoutSeconds: number;
  gatewayUrl?: string;
  token?: string;
  idempotencyKey: string;
  activityPackageId?: string | null;
  roomCatalog?: ActivityRoomCatalog | null;
}): string[] => {
  const normalizedAgentId = normalizeAgentId(agentId);
  const sessionKey = buildGatewaySessionKey(
    normalizedAgentId,
    room,
    activityPackageId,
    roomCatalog ? { roomCatalog } : undefined,
  );
  return buildGatewayCallArgs({
    method: "agent",
    expectFinal: true,
    timeoutMs: Math.max(10_000, (timeoutSeconds + 60) * 1_000),
    gatewayUrl,
    token,
    params: {
      agentId: normalizedAgentId,
      message: message.trim(),
      sessionKey,
      timeout: timeoutSeconds,
      idempotencyKey,
    },
  });
};

const buildOrchestratorApiUrl = ({
  baseUrl,
  pathname,
  query,
}: {
  baseUrl?: string;
  pathname: string;
  query?: Record<string, string | number | undefined>;
}): string => {
  const parsed = new URL(normalizeOrchestratorBaseUrl(baseUrl));
  const normalizedPath = parsed.pathname.replace(/\/$/, "");
  parsed.pathname = `${normalizedPath}${pathname}`.replace(/\/{2,}/g, "/");

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === "") {
      continue;
    }
    parsed.searchParams.set(key, String(value));
  }

  return parsed.toString();
};

export const buildOrchestratorCommandUrl = (baseUrl?: string): string =>
  buildOrchestratorApiUrl({
    baseUrl,
    pathname: "/api/orchestrator/commands",
  });

export const buildOrchestratorSnapshotUrl = ({
  baseUrl,
  activityRunId,
}: {
  baseUrl?: string;
} & OrchestratorSnapshotQuery = {}): string =>
  buildOrchestratorApiUrl({
    baseUrl,
    pathname: ORCHESTRATOR_HTTP_QUERY_PATHS.snapshot,
    query: {
      activityRunId,
    },
  });

const toEventQueryParams = (
  query: OrchestratorEventQuery = {},
): Record<string, string | number | undefined> => ({
  activityRunId: query.activityRunId,
  afterSequence: query.afterSequence,
  fromSequence: query.fromSequence,
  toSequence: query.toSequence,
  limit: query.limit,
});

export const buildOrchestratorEventsUrl = ({
  baseUrl,
  query,
}: {
  baseUrl?: string;
  query?: OrchestratorEventQuery;
} = {}): string =>
  buildOrchestratorApiUrl({
    baseUrl,
    pathname: ORCHESTRATOR_HTTP_QUERY_PATHS.events,
    query: toEventQueryParams(query),
  });

export const buildOrchestratorReplayUrl = ({
  baseUrl,
  query,
}: {
  baseUrl?: string;
  query?: OrchestratorEventQuery;
} = {}): string =>
  buildOrchestratorApiUrl({
    baseUrl,
    pathname: ORCHESTRATOR_HTTP_QUERY_PATHS.replay,
    query: toEventQueryParams(query),
  });

export const buildOrchestratorAuditUrl = ({
  baseUrl,
  activityRunId,
  limit,
}: {
  baseUrl?: string;
} & OrchestratorAuditQuery = {}): string =>
  buildOrchestratorApiUrl({
    baseUrl,
    pathname: ORCHESTRATOR_HTTP_QUERY_PATHS.audit,
    query: {
      activityRunId,
      limit,
    },
  });

export const buildOrchestratorScoresUrl = ({
  baseUrl,
  query,
}: {
  baseUrl?: string;
  query?: OrchestratorEventQuery;
} = {}): string =>
  buildOrchestratorApiUrl({
    baseUrl,
    pathname: ORCHESTRATOR_HTTP_QUERY_PATHS.scores,
    query: toEventQueryParams(query),
  });
