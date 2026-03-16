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

export type Unsubscribe = () => void;
