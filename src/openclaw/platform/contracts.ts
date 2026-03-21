export type ActorRole = "agent" | "host" | "judge" | "viewer" | "admin";

export type TimerStatus = "idle" | "running" | "paused" | "ended";

export type ScoreTargetType = "team" | "submission";
export type MessageAudienceScope = "room" | "team" | "global";
export type BetTargetType = "team" | "entity" | "submission";
export type VoteTargetType = BetTargetType;
export type SocialTargetScope =
  | "global"
  | "room"
  | "team"
  | "entity"
  | "submission";

export type SubmissionData = Record<string, unknown>;

export type ScoreAnnotations = Record<string, string>;

export interface TalkPayload extends Record<string, unknown> {
  message: string;
  roomId?: string;
  stageId?: string;
  audienceScope?: MessageAudienceScope;
  targetEntityId?: string;
}

export interface BroadcastPayload extends Record<string, unknown> {
  message: string;
  roomId?: string;
  teamId?: string;
  stageId?: string;
  audienceScope?: MessageAudienceScope;
}

export interface ReactionPayload extends Record<string, unknown> {
  reaction: string;
  roomId?: string;
  stageId?: string;
  targetEntityId?: string;
  targetTeamId?: string;
  note?: string;
}

export interface BetPayload extends Record<string, unknown> {
  targetType: BetTargetType;
  targetId: string;
  roomId?: string;
  stageId?: string;
  amount?: number;
  odds?: number;
  stance?: string;
  note?: string;
}

export interface VotePayload extends Record<string, unknown> {
  targetType: VoteTargetType;
  targetId: string;
  roomId?: string;
  stageId?: string;
  value?: number;
  note?: string;
}

export interface FinishActivityPayload extends Record<string, unknown> {
  settlementMode?: "winner" | "push";
  winningTargetType?: BetTargetType;
  winningTargetId?: string;
  note?: string;
  endedAt?: number;
}

export interface TransitionRule {
  id: string;
  sourceStageId: string;
  targetStageId: string;
  type:
    | "manual"
    | "timer_expired"
    | "all_required_submissions_locked"
    | "scores_completed"
    | "condition_satisfied";
  config: Record<string, unknown>;
}

export interface StageTemplate {
  id: string;
  name: string;
  durationSec?: number;
  allowedActions: string[];
  submissionSchemaIds?: string[];
  transitionRules?: TransitionRule[];
}

export interface SubmissionSchemaField {
  key: string;
  type: "text" | "file" | "link" | "json";
  required: boolean;
}

export interface SubmissionSchema {
  id: string;
  fields: SubmissionSchemaField[];
}

export interface SkillBinding {
  role: string;
  stageId?: string;
  docId: string;
  version: string;
}

export interface ActivityRunState {
  id: string;
  templateId: string;
  status: "draft" | "running" | "paused" | "finished";
  currentStageId: string | null;
  startedAt?: number;
  endedAt?: number;
}

export interface EventCommandContext {
  commandId?: string;
  idempotencyKey?: string;
  actorId?: string;
  actorRole?: ActorRole;
}

export interface TimerProjection {
  id: string;
  stageId: string;
  durationSec: number;
  remainingMs: number;
  state: TimerStatus;
  kind: "countdown";
  startedAt?: number;
  pausedAt?: number;
  endedAt?: number;
  endsAt?: number;
  commandContext?: EventCommandContext;
}

export interface WorldRoomProjection {
  id: string;
  label?: string;
}

export interface WorldTeamProjection {
  id: string;
  memberIds: string[];
  roomId?: string;
}

export interface WorldEntityProjection {
  id: string;
  kind: string;
  roomId?: string;
}

export interface WorldProjection {
  rooms: WorldRoomProjection[];
  teams: WorldTeamProjection[];
  entities: WorldEntityProjection[];
}

export interface SubmissionVersionRecord {
  version: number;
  updatedAt: number;
  actorId: string;
  actorRole: ActorRole;
  data: SubmissionData;
}

export interface SubmissionProjection {
  id: string;
  activityRunId: string;
  submitterId: string;
  schemaId: string;
  data: SubmissionData;
  version: number;
  versions: SubmissionVersionRecord[];
  locked: boolean;
  teamId?: string;
  stageId?: string;
  openedAt?: number;
  updatedAt: number;
  lockedAt?: number;
}

export interface AwardProjection {
  awardId: string;
  label: string;
  entityId: string;
  reason?: string;
  grantedAt: number;
}

export interface ScoreProjection {
  id: string;
  activityRunId: string;
  stageId: string;
  judgeId: string;
  judgeRole: ActorRole;
  targetType: ScoreTargetType;
  targetId: string;
  submissionId?: string;
  teamId?: string;
  score: number;
  reason: string;
  annotations: ScoreAnnotations;
  submittedAt: number;
}

export interface ScoreSummaryItem {
  targetType: ScoreTargetType;
  targetId: string;
  teamId?: string;
  submissionId?: string;
  judgeCount: number;
  totalScore: number;
  averageScore: number;
  lastSubmittedAt: number;
}

export interface TalkProjection {
  actorId: string;
  actorRole: ActorRole;
  stageId?: string;
  message: string;
  roomId?: string;
  targetEntityId?: string;
  audienceScope?: MessageAudienceScope;
  submittedAt: number;
}

export interface ReactionProjection {
  actorId: string;
  actorRole: ActorRole;
  stageId?: string;
  reaction: string;
  roomId?: string;
  targetEntityId?: string;
  targetTeamId?: string;
  note?: string;
  submittedAt: number;
}

export interface BetProjection {
  id: string;
  activityRunId: string;
  actorId: string;
  actorRole: ActorRole;
  stageId?: string;
  targetType: BetTargetType;
  targetId: string;
  roomId?: string;
  amount?: number;
  odds?: number;
  stance?: string;
  note?: string;
  placedAt: number;
}

export interface VoteProjection {
  id: string;
  activityRunId: string;
  voterId: string;
  voterRole: ActorRole;
  stageId?: string;
  targetType: VoteTargetType;
  targetId: string;
  roomId?: string;
  value: number;
  note?: string;
  submittedAt: number;
}

export interface SocialHeatEntry {
  scope: SocialTargetScope;
  targetId: string;
  value: number;
  lastUpdatedAt: number;
}

export interface ReactionTotalEntry {
  scope: Extract<SocialTargetScope, "global" | "room" | "team" | "entity">;
  targetId: string;
  total: number;
  reactions: Record<string, number>;
  lastUpdatedAt: number;
}

export interface BetSummaryItem {
  targetType: BetTargetType;
  targetId: string;
  count: number;
  totalAmount: number;
  lastPlacedAt: number;
}

export interface VoteSummaryItem {
  targetType: VoteTargetType;
  targetId: string;
  count: number;
  totalValue: number;
  averageValue: number;
  lastSubmittedAt: number;
}

export interface BetSettlementItem {
  betId: string;
  actorId: string;
  actorRole: ActorRole;
  targetType: BetTargetType;
  targetId: string;
  amount?: number;
  odds?: number;
  stance?: string;
  result: "won" | "lost" | "push";
  payout?: number;
  settledAt: number;
  winningTargetType?: BetTargetType;
  winningTargetId?: string;
}

export interface SocialSnapshot {
  audienceHeat: SocialHeatEntry[];
  betHeat: SocialHeatEntry[];
  reactionTotals: ReactionTotalEntry[];
  betSummary: BetSummaryItem[];
  voteSummary: VoteSummaryItem[];
  betSettlements: BetSettlementItem[];
}

export interface CommandConfirmation {
  challenge: string;
  confirmedAt: number;
}

export interface CommandConfirmationStatus {
  required: boolean;
  challenge: string;
  confirmedAt?: number;
  providedChallenge?: string;
}

export interface CommandEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  actorId: string;
  actorRole: ActorRole;
  activityRunId?: string;
  type: string;
  payload: TPayload;
  issuedAt: number;
  idempotencyKey?: string;
  confirmation?: CommandConfirmation;
}

export interface EventEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  sequence: number;
  type: string;
  activityRunId?: string;
  entityId?: string;
  roomId?: string;
  commandId?: string;
  idempotencyKey?: string;
  actorId?: string;
  actorRole?: ActorRole;
  timestamp: number;
  payload: TPayload;
}

export interface CommandReceipt {
  status: "accepted" | "replayed";
  commandId: string;
  requestCommandId: string;
  commandType: string;
  activityRunId?: string;
  issuedAt: number;
  handledAt: number;
  eventIds: string[];
  emittedSequences: number[];
  replayed: boolean;
  replayedFromIdempotency?: string;
  confirmation?: CommandConfirmationStatus;
}

export interface CommandError {
  code: string;
  message: string;
  confirmation?: CommandConfirmationStatus;
}
