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

export interface GatewayPresenceEntry {
  instanceId?: string;
  deviceId?: string;
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode?: string; // freeform — known: "gateway", "agent", "operator", "node", "cli"
  lastInputSeconds?: number;
  reason?: string;
  roles?: string[];
  scopes?: string[];
  tags?: string[];
  text?: string; // e.g. "Node: host (ip) · app ver · last input Xs ago · mode M · reason R"
  ts: number;
}

export interface GatewayMessage {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  ts: number;
}

export interface GatewayConfig {
  id: string; // gateway identity, e.g. "local" — enables multi-gateway keying later
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

export interface AgentPresenceMapping {
  contestantId: string;
  name?: string;
}

export type AgentPresenceMap = Record<string, AgentPresenceMapping>;

export type Unsubscribe = () => void;
