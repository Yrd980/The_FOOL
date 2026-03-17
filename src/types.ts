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
  suggestedDurationSec?: number;
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

export interface GatewayActivityRunSummary {
  id: string;
  templateId: string;
  status: string;
  currentStageId: string | null;
  snapshotId: string | null;
}

export interface GatewayTimerSummary {
  id: string;
  stageId: string | null;
  remainingMs: number;
  remainingLabel: string;
  state: string;
  stateLabel: string;
  isRunning: boolean;
}

export interface GatewaySubmissionSummary {
  id: string;
  schemaId: string;
  locked: boolean;
  lockedLabel: string;
  teamId: string | null;
  stageId: string | null;
  updatedAt: number | null;
  updatedLabel: string | null;
}

export interface GatewayAwardSummary {
  id: string;
  label: string;
  entityId: string;
  reason: string | null;
  grantedAt: number;
  grantedLabel: string;
}

export interface GatewayDomainEventSummary {
  id: string;
  type: string;
  title: string;
  detail: string;
  timestamp: number;
  timestampLabel: string;
  stageId: string | null;
  tone: "critical" | "active" | "warm" | "idle";
}

export interface GatewayOverview {
  configured: boolean;
  gatewayUrl: string | null;
  connectionState: string;
  authFailed: boolean;
  statusMessage: string;
  gatewayWarning: string | null;
  orchestrationContractStatus: "available" | "blocked" | "unknown";
  orchestrationContractNote: string | null;
  activityRun: GatewayActivityRunSummary | null;
  authorityStageId: string | null;
  lastSequence: number | null;
  timers: GatewayTimerSummary[];
  activeTimer: GatewayTimerSummary | null;
  submissions: GatewaySubmissionSummary[];
  lockedSubmissionCount: number;
  totalSubmissionCount: number;
  awards: GatewayAwardSummary[];
  domainEvents: GatewayDomainEventSummary[];
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
