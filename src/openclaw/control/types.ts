import type { ActorRole as PlatformActorRole, ScoreAnnotations } from "../platform/contracts";

export type { CommandEnvelope } from "../platform/contracts";

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
