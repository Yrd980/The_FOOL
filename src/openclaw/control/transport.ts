import type { ActivityRoomCatalog } from "../activityRuntime";
import type { CommandEnvelope } from "../platform/contracts";
import {
  normalizeControlCommandParamKey,
  normalizeControlGatewayUrl,
  normalizeOrchestratorBaseUrl,
} from "./config";
import {
  buildGatewaySessionKey,
} from "./commandDsl";
import { normalizeAgentId } from "./support";
import type {
  OrchestratorAuditQuery,
  OrchestratorEventQuery,
  OrchestratorSnapshotQuery,
} from "./types";
import { ORCHESTRATOR_HTTP_QUERY_PATHS } from "./types";

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
  sessionKeySuffix,
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
  sessionKeySuffix?: string;
}): string[] => {
  const normalizedAgentId = normalizeAgentId(agentId);
  const sessionKey = buildGatewaySessionKey(
    normalizedAgentId,
    room,
    activityPackageId,
    roomCatalog ? { roomCatalog } : undefined,
  );
  const resolvedSessionKey = sessionKeySuffix?.trim()
    ? `${sessionKey}:${sessionKeySuffix.trim()}`
    : sessionKey;
  return buildGatewayCallArgs({
    method: "agent",
    expectFinal: true,
    timeoutMs: Math.max(10_000, (timeoutSeconds + 60) * 1_000),
    gatewayUrl,
    token,
    params: {
      agentId: normalizedAgentId,
      message: message.trim(),
      sessionKey: resolvedSessionKey,
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
