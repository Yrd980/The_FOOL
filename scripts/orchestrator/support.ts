import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import type {
  ActivityRunState,
  ActorRole,
  AwardProjection,
  BetProjection,
  CommandConfirmationStatus,
  CommandEnvelope,
  EventEnvelope,
  ReactionProjection,
  ScoreProjection,
  ScoreSummaryItem,
  SkillBinding,
  SocialSnapshot,
  StageTemplate,
  SubmissionProjection,
  SubmissionSchema,
  TimerProjection,
  TalkProjection,
  VoteProjection,
  WorldProjection,
} from "../../src/openclaw/platform/contracts";

export type Role = ActorRole;
export type ReceiptStatus = "accepted" | "replayed";
export type AuditStatus = "accepted" | "replayed" | "rejected" | "conflict";
export type SubmissionCommandType = "submit" | "update_submission";

export interface CommandReceipt {
  status: ReceiptStatus;
  accepted: true;
  replayed: boolean;
  replayedFromIdempotency?: string;
  commandId: string;
  requestCommandId: string;
  commandType: string;
  activityRunId?: string;
  issuedAt: number;
  handledAt: number;
  eventIds: string[];
  emittedSequences: number[];
  events: EventEnvelope[];
  snapshotId: string;
  lastSequence: number;
  note?: string;
  confirmation?: CommandConfirmationStatus;
}

export interface StableErrorBody {
  code: string;
  message: string;
  status: number;
  commandId?: string;
  sourceCommandId?: string;
  commandType?: string;
  activityRunId?: string;
  issuedAt?: number;
  handledAt: number;
  replayed?: boolean;
  replayedFromIdempotency?: string;
  confirmation?: CommandConfirmationStatus;
}

export interface ProjectionState {
  version: 7;
  snapshotId: string;
  activityRun: ActivityRunState;
  stageTemplates: StageTemplate[];
  submissionSchemas: SubmissionSchema[];
  world: WorldProjection;
  skills: SkillBinding[];
  timers: TimerProjection[];
  submissions: SubmissionProjection[];
  scores: ScoreProjection[];
  awards: AwardProjection[];
  talks: TalkProjection[];
  reactions: ReactionProjection[];
  bets: BetProjection[];
  votes: VoteProjection[];
  social: SocialSnapshot;
  lastSequence: number;
}

export interface AuditRecord {
  auditId: string;
  commandId: string;
  sourceCommandId: string;
  commandType: string;
  activityRunId?: string;
  actorId: string;
  actorRole: Role;
  idempotencyKey?: string;
  issuedAt: number;
  handledAt: number;
  fingerprint?: string;
  status: AuditStatus;
  accepted: boolean;
  replayed: boolean;
  replayedFromIdempotency?: string;
  error?: {
    code: string;
    message: string;
    status?: number;
    confirmation?: CommandConfirmationStatus;
  };
  emittedEventIds: string[];
  emittedSequences: number[];
  receipt?: CommandReceipt;
}

export interface CommandJournalEntry {
  fingerprint: string;
  accepted: boolean;
  receipt?: CommandReceipt;
  error?: StableErrorBody;
}

export interface EventQueryResult {
  activityRunId: string;
  fromSequence: number | null;
  toSequence: number | null;
  lastSequence: number;
  hasMore: boolean;
  events: EventEnvelope[];
}

export interface AuditQueryResult {
  activityRunId: string;
  count: number;
  hasMore: boolean;
  records: AuditRecord[];
}

export interface ScoreQueryResult {
  activityRunId: string;
  currentStageId: string | null;
  scoreCount: number;
  scores: ScoreProjection[];
  scoreSummary: ScoreSummaryItem[];
  fromSequence: number | null;
  toSequence: number | null;
  lastSequence: number;
  hasMore: boolean;
  events: EventEnvelope[];
}

export interface SessionProjection {
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

export interface HealthAgent {
  agentId: string;
  sessions: {
    recent: Array<{
      key: string;
      updatedAt: number;
    }>;
  };
}

export interface WebSocketSessionData {
  connectionId: string;
  agentId: string | null;
  role: string | null;
  key: string;
  authed: boolean;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isRole = (value: unknown): value is Role =>
  value === "agent" ||
  value === "host" ||
  value === "judge" ||
  value === "viewer" ||
  value === "admin";

export const cloneJsonValue = <T>(value: T): T => structuredClone(value);

export const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

export const buildCommandFingerprint = (command: CommandEnvelope): string =>
  stableSerialize({
    actorId: command.actorId,
    actorRole: command.actorRole,
    activityRunId: command.activityRunId ?? null,
    type: command.type,
    payload: command.payload,
  });

export class OrchestratorError extends Error {
  readonly code: string;
  readonly status: number;
  readonly body: StableErrorBody;

  constructor(body: StableErrorBody) {
    super(body.message);
    this.name = "OrchestratorError";
    this.code = body.code;
    this.status = body.status;
    this.body = body;
  }
}

export const createOrchestratorStorage = ({
  dataDir,
  projectionFilePath,
  eventLogFilePath,
  auditLogFilePath,
}: {
  dataDir: string;
  projectionFilePath: string;
  eventLogFilePath: string;
  auditLogFilePath: string;
}) => {
  const parseJsonFile = <T>(filePath: string): T | null => {
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as T;
    } catch {
      return null;
    }
  };

  const ensureDataDir = (): void => {
    mkdirSync(dataDir, { recursive: true });
  };

  const writeProjection = (nextProjection: ProjectionState): void => {
    ensureDataDir();
    writeFileSync(projectionFilePath, JSON.stringify(nextProjection, null, 2));
  };

  const appendEventRecord = (event: EventEnvelope): void => {
    ensureDataDir();
    appendFileSync(eventLogFilePath, `${JSON.stringify(event)}\n`);
  };

  const appendAuditRecord = (record: AuditRecord): void => {
    ensureDataDir();
    appendFileSync(auditLogFilePath, `${JSON.stringify(record)}\n`);
  };

  const parseJsonLinesFile = <T>(filePath: string): T[] => {
    if (!existsSync(filePath)) {
      return [];
    }

    const source = readFileSync(filePath, "utf8");
    return source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as T;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is T => entry !== null);
  };

  const readEventLog = (): EventEnvelope[] =>
    parseJsonLinesFile<EventEnvelope>(eventLogFilePath);

  const readAuditLog = (): AuditRecord[] =>
    parseJsonLinesFile<AuditRecord>(auditLogFilePath);

  return {
    appendAuditRecord,
    appendEventRecord,
    ensureDataDir,
    parseJsonFile,
    readAuditLog,
    readEventLog,
    writeProjection,
  };
};
