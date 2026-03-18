import {
  buildOrchestratorAuditUrl,
  buildOrchestratorEventsUrl,
  buildOrchestratorReplayUrl,
  buildOrchestratorScoresUrl,
  buildOrchestratorSnapshotUrl,
  normalizeControlConfigValue,
  normalizeOrchestratorBaseUrl,
  type ControlActorRole,
  type OrchestratorEventQuery,
} from "./control";
import type {
  GatewayEventEnvelope,
  GatewayScoreSnapshot,
  GatewayScoreSummarySnapshot,
  GatewaySnapshotEnvelope,
} from "./gateway/types";

const DEFAULT_PAGE_LIMIT = 20;
const LOCAL_ORCHESTRATOR_HOSTS = new Set(["127.0.0.1", "localhost"]);
const LOCAL_ORCHESTRATOR_PORT = "18791";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (
  record: Record<string, unknown> | undefined,
  key: string,
): string | null => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

const formatOrchestratorError = (payload: unknown, fallback: string): string => {
  if (!isRecord(payload)) {
    return fallback;
  }

  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }

  if (isRecord(payload.error)) {
    const code = readString(payload.error, "code");
    const message = readString(payload.error, "message") ?? fallback;
    return code ? `[${code}] ${message}` : message;
  }

  return fallback;
};

export interface OrchestratorStageTemplate {
  id: string;
  name?: string;
  durationSec?: number;
  allowedActions?: string[];
  submissionSchemaIds?: string[];
  scoringRuleIds?: string[];
}

export interface OrchestratorSubmissionSchemaField {
  key: string;
  type: string;
  required?: boolean;
}

export interface OrchestratorSubmissionSchema {
  id: string;
  fields?: OrchestratorSubmissionSchemaField[];
}

export interface OrchestratorAuditError {
  code: string;
  message: string;
  status?: number;
}

export interface OrchestratorAuditRecord {
  auditId: string;
  commandId: string;
  sourceCommandId: string;
  commandType: string;
  activityRunId?: string;
  actorId: string;
  actorRole: ControlActorRole;
  idempotencyKey?: string;
  issuedAt: number;
  handledAt: number;
  fingerprint?: string;
  status: "accepted" | "replayed" | "rejected" | "conflict";
  accepted: boolean;
  replayed: boolean;
  replayedFromIdempotency?: string;
  error?: OrchestratorAuditError;
  emittedEventIds: string[];
  emittedSequences: number[];
}

export interface OrchestratorSnapshotResponse {
  ok: true;
  snapshot: GatewaySnapshotEnvelope;
  stageTemplates?: OrchestratorStageTemplate[];
  submissionSchemas?: OrchestratorSubmissionSchema[];
}

export interface OrchestratorEventPage {
  ok: true;
  activityRunId: string;
  fromSequence: number | null;
  toSequence: number | null;
  lastSequence: number;
  hasMore: boolean;
  events: GatewayEventEnvelope[];
}

export interface OrchestratorScoresResponse extends OrchestratorEventPage {
  currentStageId: string | null;
  scoreCount: number;
  scores: GatewayScoreSnapshot[];
  scoreSummary: GatewayScoreSummarySnapshot[];
}

export interface OrchestratorAuditResponse {
  ok: true;
  activityRunId: string;
  count: number;
  hasMore: boolean;
  records: OrchestratorAuditRecord[];
}

export interface OrchestratorQueryClientConfig {
  baseUrl: string;
  token: string;
}

export interface OrchestratorBrowserQueryConfigOptions {
  orchestratorBaseUrl?: string;
  gatewayUrl?: string;
  orchestratorToken?: string;
  gatewayToken?: string;
}

export interface ResolvedOrchestratorBrowserQueryConfig
  extends OrchestratorQueryClientConfig {
  source: "explicit-orchestrator-url" | "derived-local-orchestrator-url";
  note: string | null;
}

const normalizeBrowserOrchestratorBaseUrl = (value: string): string => {
  const parsed = new URL(normalizeOrchestratorBaseUrl(value));
  if (parsed.pathname === "/ws") {
    parsed.pathname = "";
  }
  return parsed.toString().replace(/\/$/, "");
};

export const resolveBrowserOrchestratorQueryConfig = ({
  orchestratorBaseUrl,
  gatewayUrl,
  orchestratorToken,
  gatewayToken,
}: OrchestratorBrowserQueryConfigOptions): ResolvedOrchestratorBrowserQueryConfig | null => {
  const token =
    normalizeControlConfigValue(orchestratorToken) ??
    normalizeControlConfigValue(gatewayToken);

  if (!token) {
    return null;
  }

  const explicitBaseUrl = normalizeControlConfigValue(orchestratorBaseUrl);
  if (explicitBaseUrl) {
    return {
      baseUrl: normalizeBrowserOrchestratorBaseUrl(explicitBaseUrl),
      token,
      source: "explicit-orchestrator-url",
      note: "Browser authoritative queries are pinned to VITE_OPENCLAW_ORCHESTRATOR_URL.",
    };
  }

  const normalizedGatewayUrl = normalizeControlConfigValue(gatewayUrl);
  if (!normalizedGatewayUrl) {
    return null;
  }

  try {
    const parsed = new URL(normalizedGatewayUrl);
    const isLocalOrchestratorGateway =
      (parsed.protocol === "ws:" || parsed.protocol === "wss:") &&
      LOCAL_ORCHESTRATOR_HOSTS.has(parsed.hostname) &&
      parsed.port === LOCAL_ORCHESTRATOR_PORT;

    if (!isLocalOrchestratorGateway) {
      return null;
    }

    return {
      baseUrl: normalizeBrowserOrchestratorBaseUrl(normalizedGatewayUrl),
      token,
      source: "derived-local-orchestrator-url",
      note:
        "Browser authoritative queries are derived from the local orchestrator websocket URL.",
    };
  } catch {
    return null;
  }
};

export class OrchestratorQueryClient {
  private readonly config: OrchestratorQueryClientConfig;

  constructor(config: OrchestratorQueryClientConfig) {
    this.config = config;
  }

  async fetchSnapshot(activityRunId?: string): Promise<OrchestratorSnapshotResponse> {
    return this.request<OrchestratorSnapshotResponse>(
      buildOrchestratorSnapshotUrl({
        baseUrl: this.config.baseUrl,
        activityRunId,
      }),
    );
  }

  async fetchEvents(
    query: OrchestratorEventQuery = {},
  ): Promise<OrchestratorEventPage> {
    return this.request<OrchestratorEventPage>(
      buildOrchestratorEventsUrl({
        baseUrl: this.config.baseUrl,
        query: {
          limit: DEFAULT_PAGE_LIMIT,
          ...query,
        },
      }),
    );
  }

  async fetchReplay(
    query: OrchestratorEventQuery = {},
  ): Promise<OrchestratorEventPage> {
    return this.request<OrchestratorEventPage>(
      buildOrchestratorReplayUrl({
        baseUrl: this.config.baseUrl,
        query: {
          limit: DEFAULT_PAGE_LIMIT,
          ...query,
        },
      }),
    );
  }

  async fetchScores(
    query: OrchestratorEventQuery = {},
  ): Promise<OrchestratorScoresResponse> {
    return this.request<OrchestratorScoresResponse>(
      buildOrchestratorScoresUrl({
        baseUrl: this.config.baseUrl,
        query: {
          limit: DEFAULT_PAGE_LIMIT,
          ...query,
        },
      }),
    );
  }

  async fetchAudit({
    activityRunId,
    limit = DEFAULT_PAGE_LIMIT,
  }: {
    activityRunId?: string;
    limit?: number;
  } = {}): Promise<OrchestratorAuditResponse> {
    return this.request<OrchestratorAuditResponse>(
      buildOrchestratorAuditUrl({
        baseUrl: this.config.baseUrl,
        activityRunId,
        limit,
      }),
    );
  }

  private async request<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${this.config.token}`,
      },
    });

    let responseBody: unknown = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      throw new Error(
        formatOrchestratorError(responseBody, `HTTP ${response.status}`),
      );
    }

    return responseBody as T;
  }
}
