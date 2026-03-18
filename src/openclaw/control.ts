import {
  buildActivityRoomCatalog,
  tryBuildActivityRoomCatalog,
  type ActivityRoomCatalog,
} from "./activityRuntime";
import type {
  ActorRole as PlatformActorRole,
  CommandEnvelope,
  ScoreAnnotations,
  SubmissionData,
} from "./platform/contracts";

export type { CommandEnvelope };

const DIRECT_GATEWAY_URL = "ws://127.0.0.1:18789";
export const DEFAULT_ORCHESTRATOR_HTTP_URL = "http://127.0.0.1:18791";
const LOCAL_PROXY_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_PROXY_PATH = "/ws";
const LOCAL_PROXY_PORTS = new Set(["4173", "5173"]);
const DEFAULT_COMMAND_PARAM_KEY = "command";
const KNOWN_ORCHESTRATION_EVENT_PREFIXES = [
  "activity.",
  "stage.",
  "timer.",
  "submission.",
  "judge.",
  "award.",
] as const;

export const GATEWAY_CONNECT_CLIENT_ID = "gateway-client";
export const GATEWAY_CONNECT_CLIENT_MODE = "ui";
export const GATEWAY_OPERATOR_READ_SCOPE = "operator.read";

export type ControlActorRole = PlatformActorRole;

export interface SubmissionCommandPayload {
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

export interface SubmitScorePayload {
  submissionId: string;
  teamId?: string;
  score: number;
  reason: string;
  annotations?: ScoreAnnotations;
}

interface ControlRoomResolutionOptions {
  fallbackToDefault?: boolean;
  roomCatalog?: ActivityRoomCatalog | null;
}

const normalizeAlias = (room: string): string =>
  room.trim().toLowerCase().replace(/[\s_]+/g, "-");

const resolveRoomCatalog = (
  activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
) =>
  options?.roomCatalog ??
  (options?.fallbackToDefault === false
    ? tryBuildActivityRoomCatalog(activityPackageId)
    : buildActivityRoomCatalog(activityPackageId));

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
    return roomCatalog?.fallbackRoomId ?? "room";
  }

  const match = sessionKey.match(/^agent:[^:]+:(.+)$/);
  const roomId = normalizeSessionRoomId(
    match?.[1]?.trim() ?? "",
    activityPackageId,
    options,
  );

  if (!roomCatalog) {
    return roomId || "room";
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
  resolveRoomCatalog(activityPackageId, options)?.labels[roomId] ?? roomId;

export const normalizeControlGatewayUrl = (
  configuredUrl: string | undefined,
): string => {
  const raw = configuredUrl?.trim();
  if (!raw) {
    return DIRECT_GATEWAY_URL;
  }

  try {
    const parsed = new URL(raw);
    const isLocalProxyUrl =
      (parsed.protocol === "ws:" || parsed.protocol === "wss:") &&
      LOCAL_PROXY_HOSTS.has(parsed.hostname) &&
      parsed.pathname === LOCAL_PROXY_PATH &&
      LOCAL_PROXY_PORTS.has(parsed.port);

    if (isLocalProxyUrl) {
      return DIRECT_GATEWAY_URL;
    }

    if ((parsed.protocol === "ws:" || parsed.protocol === "wss:") && parsed.pathname === "/") {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return raw;
  }

  return raw;
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
  issuedAt = Date.now(),
}: {
  actorId: string;
  actorRole: ControlActorRole;
  activityRunId?: string;
  type: string;
  payload: TPayload;
  idempotencyKey?: string;
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
});

export const buildTransitionStageEnvelope = ({
  actorId,
  activityRunId,
  targetStageId,
  idempotencyKey,
}: {
  actorId: string;
  activityRunId: string;
  targetStageId: string;
  idempotencyKey?: string;
}): CommandEnvelope<{ targetStageId: string }> =>
  buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "transition_stage",
    payload: { targetStageId: targetStageId.trim() },
    idempotencyKey,
  });

export const buildStartTimerEnvelope = ({
  actorId,
  activityRunId,
  stageId,
  durationSec,
  idempotencyKey,
}: {
  actorId: string;
  activityRunId: string;
  stageId: string;
  durationSec: number;
  idempotencyKey?: string;
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
  });

export const buildLockSubmissionEnvelope = ({
  actorId,
  activityRunId,
  submissionId,
  idempotencyKey,
}: {
  actorId: string;
  activityRunId: string;
  submissionId: string;
  idempotencyKey?: string;
}): CommandEnvelope<{ submissionId: string }> =>
  buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "lock_submission",
    payload: { submissionId: submissionId.trim() },
    idempotencyKey,
  });

export const buildOpenSubmissionEnvelope = ({
  actorId,
  activityRunId,
  submissionId,
  idempotencyKey,
}: {
  actorId: string;
  activityRunId: string;
  submissionId: string;
  idempotencyKey?: string;
}): CommandEnvelope<{ submissionId: string }> =>
  buildCommandEnvelope({
    actorId,
    actorRole: "host",
    activityRunId,
    type: "open_submission",
    payload: { submissionId: submissionId.trim() },
    idempotencyKey,
  });

const buildSubmissionCommandEnvelope = ({
  actorId,
  actorRole = "agent",
  activityRunId,
  submissionId,
  data,
  idempotencyKey,
  type,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  submissionId: string;
  data: SubmissionData;
  idempotencyKey?: string;
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
  });
};

export const buildSubmitEnvelope = ({
  actorId,
  actorRole = "agent",
  activityRunId,
  submissionId,
  data,
  idempotencyKey,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  submissionId: string;
  data: SubmissionData;
  idempotencyKey?: string;
}): CommandEnvelope<SubmissionCommandPayload> =>
  buildSubmissionCommandEnvelope({
    actorId,
    actorRole,
    activityRunId,
    submissionId,
    data,
    idempotencyKey,
    type: "submit",
  });

export const buildUpdateSubmissionEnvelope = ({
  actorId,
  actorRole = "agent",
  activityRunId,
  submissionId,
  data,
  idempotencyKey,
}: {
  actorId: string;
  actorRole?: ControlActorRole;
  activityRunId: string;
  submissionId: string;
  data: SubmissionData;
  idempotencyKey?: string;
}): CommandEnvelope<SubmissionCommandPayload> =>
  buildSubmissionCommandEnvelope({
    actorId,
    actorRole,
    activityRunId,
    submissionId,
    data,
    idempotencyKey,
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
}: {
  actorId: string;
  activityRunId: string;
  awardId: string;
  entityId: string;
  label?: string;
  reason?: string;
  idempotencyKey?: string;
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
  });

export const buildSubmitScoreEnvelope = ({
  actorId,
  activityRunId,
  submissionId,
  score,
  reason,
  annotations,
  idempotencyKey,
}: {
  actorId: string;
  activityRunId: string;
  submissionId: string;
  score: number;
  reason: string;
  annotations?: ScoreAnnotations;
  idempotencyKey?: string;
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
    roomCatalog
      ? {
          fallbackToDefault: false,
          roomCatalog,
        }
      : undefined,
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
