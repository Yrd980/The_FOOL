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

export type ControlActorRole = "agent" | "host" | "judge" | "viewer" | "admin";

export interface CommandEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  actorId: string;
  actorRole: ControlActorRole;
  activityRunId?: string;
  type: string;
  payload: TPayload;
  issuedAt: number;
  idempotencyKey?: string;
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

export const SCORE_MOST_ABSURD_FIELD = "mostAbsurd" as const;

export interface SubmitScorePayload {
  submissionId: string;
  score: number;
  reason: string;
  favorite: string;
  mostAbsurd: string;
}

const ROOM_ALIASES: Record<string, string> = {
  main: "main-stage",
  "main-stage": "main-stage",

  "team-room-1": "team-room-1",
  "team-1": "team-room-1",
  team1: "team-room-1",

  "team-room-2": "team-room-2",
  "team-2": "team-room-2",
  team2: "team-room-2",

  "team-room-3": "team-room-3",
  "team-3": "team-room-3",
  team3: "team-room-3",

  "quiet-orbit": "quiet-orbit",
  quiet: "quiet-orbit",
};

export const DEFAULT_GATEWAY_ROOM_IDS = [
  "main-stage",
  "team-room-1",
  "team-room-2",
  "team-room-3",
  "quiet-orbit",
] as const;

export const ROOM_LABELS: Record<string, string> = {
  "main-stage": "Main Stage",
  "team-room-1": "Team Room 1",
  "team-room-2": "Team Room 2",
  "team-room-3": "Team Room 3",
  "quiet-orbit": "Quiet Orbit",
};

const normalizeAlias = (room: string): string =>
  room.trim().toLowerCase().replace(/[\s_]+/g, "-");

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

export const resolveControlRoomId = (room: string): string => {
  const resolved = ROOM_ALIASES[normalizeAlias(room)];
  if (!resolved) {
    throw new Error(
      `Unknown room alias "${room}". Use main-stage, team-room-1, team-room-2, team-room-3, or quiet-orbit.`,
    );
  }
  return resolved;
};

export const buildGatewaySessionKey = (agentId: string, room: string): string =>
  `agent:${normalizeAgentId(agentId)}:${resolveControlRoomId(room)}`;

const normalizeSessionRoomId = (roomId: string): string =>
  roomId === "main" ? "main-stage" : roomId;

export const resolveSessionRoomId = (sessionKey: string | undefined): string => {
  if (!sessionKey) {
    return "quiet-orbit";
  }

  const match = sessionKey.match(/^agent:[^:]+:(.+)$/);
  const roomId = normalizeSessionRoomId(match?.[1] ?? "");

  if (DEFAULT_GATEWAY_ROOM_IDS.includes(roomId as (typeof DEFAULT_GATEWAY_ROOM_IDS)[number])) {
    return roomId;
  }

  return "quiet-orbit";
};

export const getRoomLabel = (roomId: string): string => ROOM_LABELS[roomId] ?? roomId;

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

export const buildMoveMessage = (room: string): string => {
  const roomId = resolveControlRoomId(room);
  const label = ROOM_LABELS[roomId] ?? roomId;
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
  favorite,
  mostAbsurd,
  idempotencyKey,
}: {
  actorId: string;
  activityRunId: string;
  submissionId: string;
  score: number;
  reason: string;
  favorite: string;
  mostAbsurd: string;
  idempotencyKey?: string;
}): CommandEnvelope<SubmitScorePayload> => {
  const normalizedScore = Math.round(score);
  if (!Number.isFinite(normalizedScore) || normalizedScore < 1 || normalizedScore > 10) {
    throw new Error("Score must be an integer between 1 and 10.");
  }

  const normalizedSubmissionId = submissionId.trim();
  const normalizedReason = reason.trim();
  const normalizedFavorite = favorite.trim();
  const normalizedMostAbsurd = mostAbsurd.trim();

  if (!normalizedSubmissionId) {
    throw new Error("Submission id is required.");
  }

  if (!normalizedReason) {
    throw new Error("Score reason is required.");
  }

  if (!normalizedFavorite) {
    throw new Error("Favorite field is required.");
  }

  if (!normalizedMostAbsurd) {
    throw new Error("mostAbsurd field is required.");
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
      favorite: normalizedFavorite,
      mostAbsurd: normalizedMostAbsurd,
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
}: {
  agentId: string;
  room: string;
  message: string;
  timeoutSeconds: number;
  gatewayUrl?: string;
  token?: string;
  idempotencyKey: string;
}): string[] => {
  const normalizedAgentId = normalizeAgentId(agentId);
  const sessionKey = buildGatewaySessionKey(normalizedAgentId, room);
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
  activityRunId?: string;
} = {}): string =>
  buildOrchestratorApiUrl({
    baseUrl,
    pathname: "/api/orchestrator/snapshot",
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
    pathname: "/api/orchestrator/events",
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
    pathname: "/api/orchestrator/replay",
    query: toEventQueryParams(query),
  });

export const buildOrchestratorAuditUrl = ({
  baseUrl,
  activityRunId,
  limit,
}: {
  baseUrl?: string;
  activityRunId?: string;
  limit?: number;
} = {}): string =>
  buildOrchestratorApiUrl({
    baseUrl,
    pathname: "/api/orchestrator/audit",
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
    pathname: "/api/orchestrator/scores",
    query: toEventQueryParams(query),
  });
