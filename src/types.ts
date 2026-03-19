import type {
  ActivityRoomSceneRole,
  ActivityStageSpotlightSource,
} from "./openclaw/activityMetadata";
import type { ControlActorRole } from "./openclaw/control";
import type { ScoreAnnotations } from "./openclaw/platform/contracts";

export interface SummaryStat {
  label: string;
  value: string;
  note: string;
}

export type StageDeskMode = "submission" | "score";

export interface StageCapabilities {
  hasSubmissionSchema: boolean;
  supportsSubmissionWindowManagement: boolean;
  supportsScoring: boolean;
  supportsAwards: boolean;
}

export interface StageDefinition {
  id: string;
  label: string;
  title: string;
  summary: string;
  contestantActions: string[];
  humanActions: string[];
  systemSignals: string[];
  allowedActions: string[];
  submissionSchemaIds: string[];
  durationSec?: number;
  capabilities: StageCapabilities;
  presentation: {
    deskMode: StageDeskMode;
    layoutPreset: string | null;
    spotlightSource: ActivityStageSpotlightSource;
    heatAsTieBreaker: boolean;
  };
}

export interface StageRuntimeGuide {
  operatorHint: string;
  successSignal: string;
  preferredRoomIds: string[];
  suggestedDurationSec?: number;
  roomRoles: Record<string, ActivityRoomSceneRole>;
  scene: {
    layoutPreset: string | null;
    spotlightSource: ActivityStageSpotlightSource;
    heatAsTieBreaker: boolean;
  };
}

export interface ActivityViewModel {
  packageId: string;
  badgeLabel: string;
  title: string;
  description: string;
  defaultStageId: string | null;
  stages: StageDefinition[];
  stageRuntimeGuides: Record<string, StageRuntimeGuide>;
  summaryStats: SummaryStat[];
  integrationDocs: IntegrationDoc[];
  operatorCommands: OperatorCommand[];
}

export interface IntegrationDoc {
  title: string;
  href: string;
  summary: string;
  accent: string;
}

export type OperatorCommandRisk = "info" | "safe" | "caution" | "danger";

export type OperatorCommandAvailability =
  | "read-only"
  | "ready"
  | "confirm"
  | "disabled";

export type OperatorCommandScope = "diagnostic" | "agent" | "orchestrator";

export interface OperatorCommandConfirmation {
  title: string;
  description: string;
  challengeLabel: string;
  expectedText: string;
}

export interface OperatorCommand {
  label: string;
  command: string;
  note: string;
  risk?: OperatorCommandRisk;
  availability?: OperatorCommandAvailability;
  scope?: OperatorCommandScope;
  blockingReason?: string;
  confirmation?: OperatorCommandConfirmation;
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
  templateId: string | null;
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

export interface GatewaySubmissionVersionSummary {
  version: number;
  updatedAt: number;
  updatedLabel: string;
  actorId: string | null;
  actorRole: ControlActorRole | null;
  data: Record<string, unknown>;
}

export interface GatewaySubmissionSummary {
  id: string;
  schemaId: string;
  locked: boolean;
  lockedLabel: string;
  teamId: string | null;
  stageId: string | null;
  data: Record<string, unknown> | null;
  version: number | null;
  versions: GatewaySubmissionVersionSummary[];
  openedAt: number | null;
  updatedAt: number | null;
  updatedLabel: string | null;
  lockedAt: number | null;
  latestActorId: string | null;
  latestActorRole: ControlActorRole | null;
}

export interface GatewayAwardSummary {
  id: string;
  label: string;
  entityId: string;
  reason: string | null;
  grantedAt: number;
  grantedLabel: string;
}

export interface GatewayEventProvenanceSummary {
  commandId: string | null;
  idempotencyKey: string | null;
  actorId: string | null;
  actorRole: ControlActorRole | null;
}

export interface GatewayDomainEventSummary {
  id: string;
  sequence: number | null;
  type: string;
  title: string;
  detail: string;
  timestamp: number;
  timestampLabel: string;
  stageId: string | null;
  roomId: string | null;
  teamId: string | null;
  submissionId: string | null;
  entityId: string | null;
  tone: "critical" | "active" | "warm" | "idle";
  provenance: GatewayEventProvenanceSummary;
}

export interface GatewayScoreSummaryEntry {
  targetType: "team" | "submission";
  targetId: string;
  teamId: string | null;
  submissionId: string | null;
  judgeCount: number;
  totalScore: number;
  averageScore: number;
  averageLabel: string;
  lastSubmittedAt: number;
  lastSubmittedLabel: string;
}

export interface GatewayScoreEntrySummary {
  id: string;
  targetType: "team" | "submission";
  targetId: string;
  submissionId: string | null;
  teamId: string | null;
  stageId: string | null;
  judgeId: string | null;
  judgeRole: ControlActorRole | null;
  score: number;
  reason: string;
  annotations: ScoreAnnotations;
  submittedAt: number;
  submittedLabel: string;
}

export interface GatewayAuditRecordSummary {
  id: string;
  commandId: string;
  sourceCommandId: string;
  commandType: string;
  status: "accepted" | "replayed" | "rejected" | "conflict";
  accepted: boolean;
  replayed: boolean;
  replayedFromIdempotency: string | null;
  actorId: string;
  actorRole: ControlActorRole;
  idempotencyKey: string | null;
  handledAt: number;
  handledLabel: string;
  issuedAt: number;
  issuedLabel: string;
  emittedSequences: number[];
  emittedSequenceLabel: string;
  errorCode: string | null;
  errorMessage: string | null;
  statusLabel: string;
  title: string;
  detail: string;
  tone: "critical" | "active" | "warm" | "idle";
}

export interface GatewayQueryCheckSummary {
  key: "snapshot" | "scores" | "events" | "replay" | "audit";
  label: string;
  status: "ok" | "error" | "idle";
  detail: string;
  tone: "critical" | "active" | "warm" | "idle";
  lastSuccessfulAt: number | null;
  lastSuccessfulLabel: string | null;
}

export interface GatewayAuthoritativeQueryStatus {
  configured: boolean;
  loading: boolean;
  available: boolean;
  status: "available" | "degraded" | "syncing" | "unavailable" | "disabled";
  statusLabel: string;
  baseUrl: string | null;
  source:
    | "explicit-orchestrator-url"
    | "derived-local-orchestrator-url"
    | "unavailable";
  note: string | null;
  reason: string | null;
  error: string | null;
  lastSuccessfulAt: number | null;
  lastSuccessfulLabel: string | null;
  freshnessLabel: string;
  tone: "critical" | "active" | "warm" | "idle";
  checks: GatewayQueryCheckSummary[];
}

export interface GatewayAuditSummary {
  status: "healthy" | "warning" | "error" | "missing";
  label: string;
  detail: string;
  tone: "critical" | "active" | "warm" | "idle";
  error: string | null;
  recordCount: number;
  acceptedCount: number;
  replayedCount: number;
  rejectedCount: number;
  conflictCount: number;
  latestHandledAt: number | null;
  latestHandledLabel: string | null;
  latestRecord: GatewayAuditRecordSummary | null;
}

export interface GatewayBackendHealthEvidence {
  id: string;
  title: string;
  detail: string;
  status: "ok" | "warning" | "error" | "missing";
  tone: "critical" | "active" | "warm" | "idle";
  timestamp: number | null;
  timestampLabel: string | null;
}

export interface GatewayBackendHealthSummary {
  status: "healthy" | "warning" | "error" | "missing";
  label: string;
  detail: string;
  tone: "critical" | "active" | "warm" | "idle";
  source: "authoritative-query-snapshot" | "gateway-snapshot" | "unavailable";
  snapshotGeneratedAt: number | null;
  snapshotGeneratedLabel: string | null;
  freshnessLabel: string;
  agentCount: number;
  recentAgentIds: string[];
  evidence: GatewayBackendHealthEvidence[];
}

export type GatewayStructuredStateSource =
  | "authoritative-query-snapshot"
  | "gateway-snapshot"
  | "unavailable";

export interface GatewayStructuredStateSummary {
  available: boolean;
  source: GatewayStructuredStateSource;
  reason: string | null;
}

export interface GatewayWorldEntitySummary {
  entityId: string;
  label: string;
  kind: string;
  roomId: string | null;
  roomLabel: string | null;
  teamId: string | null;
  teamLabel: string | null;
  liveRoomId: string | null;
  liveRoomLabel: string | null;
  liveState: GatewaySessionSummary["state"] | null;
  liveStateLabel: string | null;
}

export interface GatewayWorldTeamSummary {
  teamId: string;
  label: string;
  roomId: string | null;
  roomLabel: string | null;
  memberCount: number;
  members: GatewayWorldEntitySummary[];
  placementStatus: "aligned" | "mixed" | "unassigned";
  placementDetail: string;
}

export interface GatewayWorldRoomSummary {
  roomId: string;
  label: string;
  teamCount: number;
  memberCount: number;
  occupantCount: number;
  teamIds: string[];
  occupantIds: string[];
}

export interface GatewayWorldSummary extends GatewayStructuredStateSummary {
  rooms: GatewayWorldRoomSummary[];
  teams: GatewayWorldTeamSummary[];
  entities: GatewayWorldEntitySummary[];
  unassignedEntities: GatewayWorldEntitySummary[];
}

export interface GatewaySkillBindingSummary {
  id: string;
  role: string;
  stageId: string | null;
  scopeLabel: string;
  docId: string;
  version: string;
  isCurrentStage: boolean;
}

export interface GatewaySkillDocumentSummary {
  id: string;
  docId: string;
  version: string;
  bindingCount: number;
  roles: string[];
  stageIds: string[];
  currentStage: boolean;
}

export interface GatewaySkillSummary extends GatewayStructuredStateSummary {
  currentStageId: string | null;
  currentStageReason: string | null;
  bindings: GatewaySkillBindingSummary[];
  currentStageBindings: GatewaySkillBindingSummary[];
  globalBindings: GatewaySkillBindingSummary[];
  documents: GatewaySkillDocumentSummary[];
}

export interface GatewayOverview {
  configured: boolean;
  gatewayUrl: string | null;
  orchestratorQuery: GatewayAuthoritativeQueryStatus;
  auditSummary: GatewayAuditSummary;
  backendHealth: GatewayBackendHealthSummary;
  world: GatewayWorldSummary;
  skills: GatewaySkillSummary;
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
  currentSubmission: GatewaySubmissionSummary | null;
  lockedSubmissionCount: number;
  totalSubmissionCount: number;
  scores: GatewayScoreEntrySummary[];
  scoreSummary: GatewayScoreSummaryEntry[];
  awards: GatewayAwardSummary[];
  domainEvents: GatewayDomainEventSummary[];
  recentAuditRecords: GatewayAuditRecordSummary[];
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

export type OrchestratorActorRole =
  | "agent"
  | "host"
  | "judge"
  | "viewer"
  | "admin";

export interface OrchestratorEventProvenance {
  commandId?: string;
  idempotencyKey?: string;
  actorId?: string;
  actorRole?: OrchestratorActorRole;
}

export interface OrchestratorEventEnvelope<
  TPayload = Record<string, unknown>,
> extends OrchestratorEventProvenance {
  id: string;
  sequence: number;
  type: string;
  activityRunId?: string;
  entityId?: string;
  roomId?: string;
  timestamp: number;
  payload: TPayload;
}

export interface OrchestratorSubmissionVersion {
  version: number;
  updatedAt: number;
  actorId: string;
  actorRole: OrchestratorActorRole;
  data: Record<string, unknown>;
}

export interface TeamProjectSubmissionPayload extends Record<string, unknown> {
  posterOrDeck: string;
  elevatorPitch: string;
  highlights: [string, string, string];
  risk: string;
}

export interface OrchestratorSubmissionSnapshot {
  id: string;
  activityRunId: string;
  submitterId: string;
  schemaId: string;
  data: Record<string, unknown>;
  version: number;
  versions: OrchestratorSubmissionVersion[];
  locked: boolean;
  teamId?: string;
  stageId?: string;
  openedAt?: number;
  updatedAt: number;
  lockedAt?: number;
}

export interface OrchestratorScoreProjection {
  id: string;
  activityRunId: string;
  stageId: string;
  judgeId: string;
  judgeRole: OrchestratorActorRole;
  targetType: "team" | "submission";
  targetId: string;
  submissionId?: string;
  teamId?: string;
  score: number;
  reason: string;
  annotations: ScoreAnnotations;
  submittedAt: number;
}

export interface OrchestratorScoreSummaryItem {
  targetType: "team" | "submission";
  targetId: string;
  teamId?: string;
  submissionId?: string;
  judgeCount: number;
  totalScore: number;
  averageScore: number;
  lastSubmittedAt: number;
}

export interface OrchestratorAuditRecord {
  auditId: string;
  commandId: string;
  sourceCommandId: string;
  commandType: string;
  activityRunId?: string;
  actorId: string;
  actorRole: OrchestratorActorRole;
  idempotencyKey?: string;
  issuedAt: number;
  handledAt: number;
  fingerprint?: string;
  status: "accepted" | "replayed" | "rejected" | "conflict";
  accepted: boolean;
  replayed: boolean;
  replayedFromIdempotency?: string;
  error?: {
    code: string;
    message: string;
    status?: number;
  };
  emittedEventIds: string[];
  emittedSequences: number[];
}

export interface OrchestratorSnapshotEnvelope {
  snapshotId: string;
  activityRun: {
    id: string;
    templateId: string;
    status: string;
    currentStageId: string | null;
  };
  world?: Record<string, unknown>;
  timers: Array<{
    id: string;
    stageId?: string;
    remainingMs: number;
    state: string;
  }>;
  skills: Array<{
    role: string;
    stageId?: string;
    docId: string;
    version: string;
  }>;
  submissions: OrchestratorSubmissionSnapshot[];
  scores: OrchestratorScoreProjection[];
  scoreSummary: OrchestratorScoreSummaryItem[];
  awards: Array<{
    awardId?: string;
    label?: string;
    entityId?: string;
    reason?: string;
    grantedAt?: number;
  }>;
  lastSequence: number;
}

export interface OrchestratorSnapshotQueryResponse {
  ok: true;
  snapshot: OrchestratorSnapshotEnvelope;
  stageTemplates: Array<Record<string, unknown>>;
  submissionSchemas: Array<Record<string, unknown>>;
}

export interface OrchestratorEventQueryResponse {
  ok: true;
  activityRunId: string;
  fromSequence: number | null;
  toSequence: number | null;
  lastSequence: number;
  hasMore: boolean;
  events: OrchestratorEventEnvelope[];
}

export interface OrchestratorScoresQueryResponse {
  ok: true;
  activityRunId: string;
  currentStageId: string | null;
  scoreCount: number;
  scores: OrchestratorScoreProjection[];
  scoreSummary: OrchestratorScoreSummaryItem[];
  fromSequence: number | null;
  toSequence: number | null;
  lastSequence: number;
  hasMore: boolean;
  events: OrchestratorEventEnvelope[];
}

export interface OrchestratorAuditQueryResponse {
  ok: true;
  activityRunId: string;
  count: number;
  hasMore: boolean;
  records: OrchestratorAuditRecord[];
}

export interface OrchestratorQueryHealth {
  source: "orchestrator-http";
  loading: boolean;
  available: boolean;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  staleAfterMs: number;
  error: string | null;
}
