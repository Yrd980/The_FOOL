export interface SummaryStat {
  label: string;
  value: string;
  note: string;
}

export interface StageDefinition {
  id: string;
  label: string;
  title: string;
  summary: string;
  contestantActions: string[];
  humanActions: string[];
  systemSignals: string[];
}

export interface StageRuntimeGuide {
  operatorHint: string;
  successSignal: string;
  preferredRoomIds: string[];
}

export interface IntegrationDoc {
  title: string;
  href: string;
  summary: string;
  accent: string;
}

export interface OperatorCommand {
  label: string;
  command: string;
  note: string;
}

export interface GatewayRoomCount {
  roomId: string;
  label: string;
  count: number;
}

export interface GatewayStateCount {
  state: "speaking" | "raised-hand" | "listening" | "muted";
  label: string;
  count: number;
  tone: "critical" | "active" | "warm" | "idle";
}

export interface GatewayActivity {
  id: string;
  agentId: string;
  roomId: string;
  roomLabel: string;
  content: string;
  timestamp: number;
  timestampLabel: string;
}

export interface GatewaySessionSummary {
  agentId: string;
  sessionKey: string;
  roomId: string;
  roomLabel: string;
  updatedAt: number;
  updatedLabel: string;
  state: "speaking" | "raised-hand" | "listening" | "muted";
  stateLabel: string;
  stateTone: "critical" | "active" | "warm" | "idle";
}

export interface GatewayContestantSummary extends GatewaySessionSummary {
  activityCount: number;
  recentActivity: GatewayActivity | null;
  recentActivities: GatewayActivity[];
}

export interface GatewayOverview {
  configured: boolean;
  gatewayUrl: string | null;
  connectionState: string;
  authFailed: boolean;
  statusMessage: string;
  totalActiveSessions: number;
  stateCounts: GatewayStateCount[];
  roomCounts: GatewayRoomCount[];
  roomRosters: Array<{
    roomId: string;
    label: string;
    sessions: GatewaySessionSummary[];
  }>;
  sessions: GatewaySessionSummary[];
  contestants: GatewayContestantSummary[];
  activities: GatewayActivity[];
}
