export type ConnectionState =
  | "idle"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type ConnectionEvent =
  | { type: "start" }
  | { type: "ws-open" }
  | { type: "auth-ok" }
  | { type: "auth-fail"; reason: string }
  | { type: "ws-close" }
  | { type: "ws-error" }
  | { type: "retry-exhausted" }
  | { type: "disconnect" };

export interface GatewayConfig {
  id: string;
  url: string;
  token: string;
}

export interface GatewayHelloPayload {
  type?: string;
  features?: {
    methods?: string[];
    events?: string[];
  };
}

export interface GatewaySessionEntry {
  agentId: string;
  key: string;
  kind: string;
  updatedAt: number;
  abortedLastRun: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  modelProvider: string;
  contextTokens: number;
}

export interface GatewayMessage {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  ts: number;
}

export interface GatewayStatusByAgent {
  agentId: string;
  count: number;
  recent: GatewaySessionEntry[];
}

export interface GatewayStatusResponse {
  sessions: {
    recent: GatewaySessionEntry[];
    byAgent?: GatewayStatusByAgent[];
  };
}

export interface GatewayActivityRunSnapshot {
  id: string;
  templateId: string;
  status: string;
  currentStageId: string | null;
}

export interface GatewayWorldSnapshot {
  rooms: Array<{ id: string; label?: string }>;
  teams: Array<{ id: string; memberIds: string[]; roomId?: string }>;
  entities: Array<{ id: string; kind: string; roomId?: string }>;
}

export interface GatewayTimerSnapshot {
  id: string;
  stageId?: string;
  remainingMs: number;
  state: string;
}

export interface GatewaySkillSnapshot {
  role: string;
  stageId?: string;
  docId: string;
  version: string;
}

export interface GatewaySubmissionSnapshot {
  id: string;
  schemaId: string;
  locked: boolean;
  stageId?: string;
  teamId?: string;
  updatedAt?: number;
}

export interface GatewaySnapshotEnvelope {
  snapshotId?: string;
  activityRun?: GatewayActivityRunSnapshot;
  world?: GatewayWorldSnapshot;
  timers?: GatewayTimerSnapshot[];
  skills?: GatewaySkillSnapshot[];
  submissions?: GatewaySubmissionSnapshot[];
  awards?: Array<{
    awardId?: string;
    label?: string;
    entityId?: string;
    reason?: string;
    grantedAt?: number;
  }>;
  lastSequence?: number;
}

export interface GatewayEventEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  sequence?: number;
  type: string;
  activityRunId?: string;
  entityId?: string;
  roomId?: string;
  timestamp: number;
  payload: TPayload;
}

export type Unsubscribe = () => void;
