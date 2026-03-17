#!/usr/bin/env bun

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Role = "agent" | "host" | "judge" | "viewer" | "admin";
type TimerStatus = "idle" | "running" | "paused" | "ended";
type ReceiptStatus = "accepted" | "replayed";
type AuditStatus = "accepted" | "replayed" | "rejected" | "conflict";

interface StageTemplate {
  id: string;
  name: string;
  durationSec?: number;
  allowedActions: string[];
  submissionSchemaIds?: string[];
}

interface SubmissionSchema {
  id: string;
  fields: Array<{
    key: string;
    type: "text" | "file" | "link" | "json";
    required: boolean;
  }>;
}

interface SkillBinding {
  role: string;
  stageId?: string;
  docId: string;
  version: string;
}

interface ActivityRunState {
  id: string;
  templateId: string;
  status: "draft" | "running" | "paused" | "finished";
  currentStageId: string | null;
  startedAt?: number;
  endedAt?: number;
}

interface EventCommandContext {
  commandId?: string;
  idempotencyKey?: string;
  actorId?: string;
  actorRole?: Role;
}

interface TimerProjection {
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

interface SubmissionProjection {
  id: string;
  activityRunId: string;
  submitterId: string;
  schemaId: string;
  data: Record<string, unknown>;
  locked: boolean;
  teamId?: string;
  stageId?: string;
  openedAt?: number;
  updatedAt: number;
  lockedAt?: number;
}

interface AwardProjection {
  awardId: string;
  label: string;
  entityId: string;
  reason?: string;
  grantedAt: number;
}

interface ScoreProjection {
  id: string;
  activityRunId: string;
  stageId: string;
  judgeId: string;
  judgeRole: Role;
  targetType: "team" | "submission";
  targetId: string;
  submissionId?: string;
  teamId?: string;
  score: number;
  reason: string;
  favorite: string;
  mostAbsurd: string;
  submittedAt: number;
}

interface CommandEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  actorId: string;
  actorRole: Role;
  activityRunId?: string;
  type: string;
  payload: TPayload;
  issuedAt: number;
  idempotencyKey?: string;
}

interface EventEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  sequence: number;
  type: string;
  activityRunId?: string;
  entityId?: string;
  roomId?: string;
  commandId?: string;
  idempotencyKey?: string;
  actorId?: string;
  actorRole?: Role;
  timestamp: number;
  payload: TPayload;
}

interface CommandReceipt {
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
}

interface StableErrorBody {
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
}

interface ProjectionState {
  version: 3;
  snapshotId: string;
  activityRun: ActivityRunState;
  timers: TimerProjection[];
  submissions: SubmissionProjection[];
  scores: ScoreProjection[];
  awards: AwardProjection[];
  lastSequence: number;
}

interface AuditRecord {
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
  };
  emittedEventIds: string[];
  emittedSequences: number[];
  receipt?: CommandReceipt;
}

interface CommandJournalEntry {
  fingerprint: string;
  accepted: boolean;
  receipt?: CommandReceipt;
  error?: StableErrorBody;
}

interface EventQueryResult {
  activityRunId: string;
  fromSequence: number | null;
  toSequence: number | null;
  lastSequence: number;
  hasMore: boolean;
  events: EventEnvelope[];
}

interface AuditQueryResult {
  activityRunId: string;
  count: number;
  hasMore: boolean;
  records: AuditRecord[];
}

interface ScoreQueryResult {
  activityRunId: string;
  currentStageId: string | null;
  scoreCount: number;
  scores: ScoreProjection[];
  scoreSummary: Array<{
    targetType: "team" | "submission";
    targetId: string;
    teamId?: string;
    submissionId?: string;
    judgeCount: number;
    totalScore: number;
    averageScore: number;
    lastSubmittedAt: number;
  }>;
  fromSequence: number | null;
  toSequence: number | null;
  lastSequence: number;
  hasMore: boolean;
  events: EventEnvelope[];
}

interface SessionProjection {
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

interface HealthAgent {
  agentId: string;
  sessions: {
    recent: Array<{
      key: string;
      updatedAt: number;
    }>;
  };
}

interface WebSocketSessionData {
  connectionId: string;
  agentId: string | null;
  role: string | null;
  key: string;
  authed: boolean;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const devRoot = path.resolve(scriptDir, "..");
const defaultDataDir = path.join(devRoot, ".orchestrator");
const dataDir =
  process.env.OPENCLAW_ORCHESTRATOR_DATA_DIR?.trim() || defaultDataDir;
const projectionFilePath = path.join(dataDir, "projection.json");
const eventLogFilePath = path.join(dataDir, "events.jsonl");
const auditLogFilePath = path.join(dataDir, "audit.jsonl");
const host = process.env.OPENCLAW_ORCHESTRATOR_HOST?.trim() || "127.0.0.1";
const port = Number.parseInt(
  process.env.OPENCLAW_ORCHESTRATOR_PORT?.trim() || "18791",
  10,
);
const authToken =
  process.env.OPENCLAW_ORCHESTRATOR_TOKEN?.trim() ||
  process.env.VITE_OPENCLAW_TOKEN?.trim() ||
  "molt-claw-local-dev";

const stageTemplates: StageTemplate[] = [
  {
    id: "act-1-intro",
    name: "自我介绍",
    durationSec: 300,
    allowedActions: ["talk", "reaction", "bet", "query"],
  },
  {
    id: "act-2-preference",
    name: "组队偏好",
    durationSec: 240,
    allowedActions: ["talk", "query"],
  },
  {
    id: "act-3-assignment",
    name: "组织龙虾分组",
    durationSec: 180,
    allowedActions: ["broadcast", "talk", "query"],
  },
  {
    id: "act-4-discussion",
    name: "队内讨论",
    durationSec: 900,
    allowedActions: ["move", "talk", "broadcast", "query"],
  },
  {
    id: "act-5-submission",
    name: "项目提交",
    durationSec: 420,
    allowedActions: [
      "submit",
      "update_submission",
      "open_submission",
      "lock_submission",
      "query",
    ],
    submissionSchemaIds: ["team-project-v1"],
  },
  {
    id: "act-6-human-review",
    name: "人类观赛点评",
    durationSec: 480,
    allowedActions: ["broadcast", "talk", "reaction", "bet"],
  },
  {
    id: "act-7-ai-judging",
    name: "AI 评委评审",
    durationSec: 300,
    allowedActions: ["score", "talk", "query"],
  },
  {
    id: "act-8-awards",
    name: "颁奖",
    durationSec: 240,
    allowedActions: ["broadcast", "grant_award", "query"],
  },
  {
    id: "act-9-co-creation",
    name: "全体共创艺术品",
    durationSec: 600,
    allowedActions: ["submit", "draw", "talk", "query"],
    submissionSchemaIds: ["personal-poem-v1"],
  },
  {
    id: "act-10-open-mic",
    name: "人类观众感想点评",
    durationSec: 300,
    allowedActions: ["talk", "broadcast"],
  },
];

const submissionSchemas: SubmissionSchema[] = [
  {
    id: "team-project-v1",
    fields: [
      { key: "posterOrDeck", type: "file", required: true },
      { key: "elevatorPitch", type: "text", required: true },
      { key: "highlights", type: "json", required: true },
      { key: "risk", type: "text", required: true },
    ],
  },
  {
    id: "personal-poem-v1",
    fields: [
      { key: "poem", type: "text", required: true },
      { key: "moodAtSubmission", type: "text", required: false },
    ],
  },
];

const skillBindings: SkillBinding[] = [
  {
    role: "agent",
    docId: "skill.md",
    version: "0.1.0",
  },
  {
    role: "agent",
    docId: "heartbeat.md",
    version: "0.1.0",
  },
];

const worldProjection = {
  rooms: [
    { id: "main-stage", label: "Main Stage" },
    { id: "team-room-1", label: "Team Room 1" },
    { id: "team-room-2", label: "Team Room 2" },
    { id: "team-room-3", label: "Team Room 3" },
    { id: "quiet-orbit", label: "Quiet Orbit" },
  ],
  teams: [
    {
      id: "team-1",
      memberIds: ["contestant-01", "contestant-02"],
      roomId: "team-room-1",
    },
    {
      id: "team-2",
      memberIds: ["contestant-03", "contestant-04"],
      roomId: "team-room-2",
    },
    {
      id: "team-3",
      memberIds: ["contestant-05", "contestant-06"],
      roomId: "team-room-3",
    },
  ],
  entities: [
    { id: "contestant-01", kind: "agent", roomId: "main-stage" },
    { id: "contestant-02", kind: "agent", roomId: "main-stage" },
    { id: "contestant-03", kind: "agent", roomId: "main-stage" },
    { id: "contestant-04", kind: "agent", roomId: "main-stage" },
    { id: "contestant-05", kind: "agent", roomId: "main-stage" },
    { id: "contestant-06", kind: "agent", roomId: "main-stage" },
    { id: "host-01", kind: "host", roomId: "main-stage" },
  ],
};

const supportedRpcMethods = [
  "connect",
  "status",
  "orchestrator.command",
  "orchestrator.snapshot",
  "orchestrator.events",
  "orchestrator.replay",
  "orchestrator.audit",
  "orchestrator.scores",
];
const supportedEvents = [
  "activity.started",
  "stage.changed",
  "timer.started",
  "timer.paused",
  "timer.ended",
  "submission.opened",
  "submission.updated",
  "submission.locked",
  "judge.score_submitted",
  "award.granted",
];

const timerHandles = new Map<string, ReturnType<typeof setTimeout>>();
const clients = new Set<ServerWebSocket<WebSocketSessionData>>();
const sessions = new Map<string, SessionProjection>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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

const buildSeedProjection = (now = Date.now()): ProjectionState => ({
  version: 3,
  snapshotId: `snapshot-${now}`,
  activityRun: {
    id: "activity-run-01",
    templateId: "the-fool-v1",
    status: "running",
    currentStageId: "act-1-intro",
    startedAt: now,
  },
  timers: [],
  submissions: [],
  scores: [],
  awards: [],
  lastSequence: 0,
});

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

const stableSerialize = (value: unknown): string => {
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

const buildCommandFingerprint = (command: CommandEnvelope): string =>
  stableSerialize({
    actorId: command.actorId,
    actorRole: command.actorRole,
    activityRunId: command.activityRunId ?? null,
    type: command.type,
    payload: command.payload,
  });

class OrchestratorError extends Error {
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

const computeRemainingMs = (
  timer: TimerProjection,
  now = Date.now(),
): number => {
  if (timer.state === "running" && typeof timer.endsAt === "number") {
    return Math.max(0, timer.endsAt - now);
  }

  if (timer.state === "ended") {
    return 0;
  }

  return Math.max(0, timer.remainingMs);
};

const upsertById = <T extends { id: string }>(
  items: T[],
  nextItem: T,
): T[] => {
  const remaining = items.filter((item) => item.id !== nextItem.id);
  return [...remaining, nextItem];
};

const upsertAwardById = (
  items: AwardProjection[],
  nextItem: AwardProjection,
): AwardProjection[] => {
  const remaining = items.filter((item) => item.awardId !== nextItem.awardId);
  return [...remaining, nextItem];
};

const upsertScoreById = (
  items: ScoreProjection[],
  nextItem: ScoreProjection,
): ScoreProjection[] => {
  const remaining = items.filter((item) => item.id !== nextItem.id);
  return [...remaining, nextItem];
};

const buildScoreSummary = (
  scores: ScoreProjection[],
): ScoreQueryResult["scoreSummary"] =>
  Array.from(
    scores.reduce(
      (groups, score) => {
        const summaryTargetType = score.teamId ? "team" : score.targetType;
        const summaryTargetId = score.teamId ?? score.targetId;
        const key = `${summaryTargetType}:${summaryTargetId}`;
        const existing = groups.get(key);
        if (existing) {
          existing.judgeCount += 1;
          existing.totalScore += score.score;
          existing.lastSubmittedAt = Math.max(
            existing.lastSubmittedAt,
            score.submittedAt,
          );
          if (!existing.teamId && score.teamId) {
            existing.teamId = score.teamId;
          }
          if (!existing.submissionId && score.submissionId) {
            existing.submissionId = score.submissionId;
          }
          return groups;
        }

        groups.set(key, {
          targetType: summaryTargetType,
          targetId: summaryTargetId,
          teamId: score.teamId,
          submissionId: score.submissionId,
          judgeCount: 1,
          totalScore: score.score,
          averageScore: score.score,
          lastSubmittedAt: score.submittedAt,
        });
        return groups;
      },
      new Map<string, ScoreQueryResult["scoreSummary"][number]>(),
    ),
  )
    .map(([, entry]) => ({
      ...entry,
      averageScore:
        entry.judgeCount > 0
          ? Number((entry.totalScore / entry.judgeCount).toFixed(2))
          : 0,
    }))
    .sort((left, right) => {
      if (right.averageScore !== left.averageScore) {
        return right.averageScore - left.averageScore;
      }
      if (right.judgeCount !== left.judgeCount) {
        return right.judgeCount - left.judgeCount;
      }
      return right.lastSubmittedAt - left.lastSubmittedAt;
    });

const applyEventToProjection = (
  current: ProjectionState,
  event: EventEnvelope,
): ProjectionState => {
  const payload =
    isRecord(event.payload) ? event.payload : {};
  let next: ProjectionState = {
    ...current,
    snapshotId: `snapshot-${event.sequence}`,
    lastSequence: event.sequence,
  };

  if (event.type === "activity.started") {
    const stageId =
      typeof payload.stageId === "string"
        ? payload.stageId
        : next.activityRun.currentStageId;
    next = {
      ...next,
      activityRun: {
        ...next.activityRun,
        status: "running",
        currentStageId: stageId,
        startedAt:
          typeof payload.startedAt === "number"
            ? payload.startedAt
            : next.activityRun.startedAt ?? event.timestamp,
      },
    };
  }

  if (event.type === "stage.changed") {
    const toStageId =
      typeof payload.toStageId === "string"
        ? payload.toStageId
        : typeof payload.stageId === "string"
          ? payload.stageId
          : null;
    next = {
      ...next,
      activityRun: {
        ...next.activityRun,
        currentStageId: toStageId,
        status: "running",
      },
    };
  }

  if (event.type.startsWith("timer.")) {
    const rawTimer =
      isRecord(payload.timer) ? payload.timer : payload;
    const existingTimer =
      typeof rawTimer.id === "string"
        ? next.timers.find((entry) => entry.id === rawTimer.id)
        : undefined;
    const timerId =
      typeof rawTimer.id === "string" ? rawTimer.id : `timer-${Date.now()}`;
    const durationSec =
      typeof rawTimer.durationSec === "number"
        ? rawTimer.durationSec
        : typeof payload.durationSec === "number"
          ? payload.durationSec
          : existingTimer?.durationSec ?? 0;
    const timer: TimerProjection = {
      id: timerId,
      stageId:
        typeof rawTimer.stageId === "string"
          ? rawTimer.stageId
          : existingTimer?.stageId ??
            next.activityRun.currentStageId ??
            "unknown-stage",
      durationSec,
      remainingMs:
        typeof rawTimer.remainingMs === "number"
          ? rawTimer.remainingMs
          : event.type === "timer.ended"
            ? 0
            : existingTimer?.remainingMs ?? durationSec * 1_000,
      state:
        typeof rawTimer.state === "string"
          ? (rawTimer.state as TimerStatus)
          : event.type === "timer.started"
            ? "running"
            : event.type === "timer.paused"
              ? "paused"
              : "ended",
      kind: "countdown",
      startedAt:
        typeof rawTimer.startedAt === "number"
          ? rawTimer.startedAt
          : existingTimer?.startedAt,
      pausedAt:
        typeof rawTimer.pausedAt === "number"
          ? rawTimer.pausedAt
          : existingTimer?.pausedAt,
      endedAt:
        typeof rawTimer.endedAt === "number"
          ? rawTimer.endedAt
          : existingTimer?.endedAt,
      endsAt:
        typeof rawTimer.endsAt === "number"
          ? rawTimer.endsAt
          : existingTimer?.endsAt,
      commandContext:
        isRecord(rawTimer.commandContext) &&
        (typeof rawTimer.commandContext.commandId === "string" ||
          typeof rawTimer.commandContext.idempotencyKey === "string")
          ? {
              commandId:
                typeof rawTimer.commandContext.commandId === "string"
                  ? rawTimer.commandContext.commandId
                  : undefined,
              idempotencyKey:
                typeof rawTimer.commandContext.idempotencyKey === "string"
                  ? rawTimer.commandContext.idempotencyKey
                  : undefined,
              actorId:
                typeof rawTimer.commandContext.actorId === "string"
                  ? rawTimer.commandContext.actorId
                  : undefined,
              actorRole:
                rawTimer.commandContext.actorRole === "agent" ||
                rawTimer.commandContext.actorRole === "host" ||
                rawTimer.commandContext.actorRole === "judge" ||
                rawTimer.commandContext.actorRole === "viewer" ||
                rawTimer.commandContext.actorRole === "admin"
                  ? rawTimer.commandContext.actorRole
                  : undefined,
            }
          : event.commandId || event.idempotencyKey
            ? {
                commandId: event.commandId,
                idempotencyKey: event.idempotencyKey,
                actorId: event.actorId,
                actorRole: event.actorRole,
              }
            : existingTimer?.commandContext,
    };
    next = {
      ...next,
      timers: upsertById(next.timers, timer),
    };
  }

  if (event.type.startsWith("submission.")) {
    const rawSubmission =
      isRecord(payload.submission) ? payload.submission : payload;
    const submissionId =
      typeof rawSubmission.id === "string" ? rawSubmission.id : null;

    if (submissionId) {
      const existingSubmission = next.submissions.find(
        (entry) => entry.id === submissionId,
      );
      const submission: SubmissionProjection = {
        id: submissionId,
        activityRunId:
          typeof rawSubmission.activityRunId === "string"
            ? rawSubmission.activityRunId
            : next.activityRun.id,
        submitterId:
          typeof rawSubmission.submitterId === "string"
            ? rawSubmission.submitterId
            : typeof rawSubmission.teamId === "string"
              ? rawSubmission.teamId
              : existingSubmission?.submitterId ?? "unknown-submitter",
        schemaId:
          typeof rawSubmission.schemaId === "string"
            ? rawSubmission.schemaId
            : existingSubmission?.schemaId ?? "unknown-schema",
        data:
          isRecord(rawSubmission.data)
            ? rawSubmission.data
            : existingSubmission?.data ?? {},
        locked:
          typeof rawSubmission.locked === "boolean"
            ? rawSubmission.locked
            : event.type === "submission.locked",
        teamId:
          typeof rawSubmission.teamId === "string"
            ? rawSubmission.teamId
            : existingSubmission?.teamId,
        stageId:
          typeof rawSubmission.stageId === "string"
            ? rawSubmission.stageId
            : existingSubmission?.stageId,
        openedAt:
          typeof rawSubmission.openedAt === "number"
            ? rawSubmission.openedAt
            : existingSubmission?.openedAt ??
              (event.type === "submission.opened" ? event.timestamp : undefined),
        updatedAt:
          typeof rawSubmission.updatedAt === "number"
            ? rawSubmission.updatedAt
            : event.timestamp,
        lockedAt:
          typeof rawSubmission.lockedAt === "number"
            ? rawSubmission.lockedAt
            : existingSubmission?.lockedAt ??
              (event.type === "submission.locked" ? event.timestamp : undefined),
      };
      next = {
        ...next,
        submissions: upsertById(next.submissions, submission),
      };
    }
  }

  if (event.type === "judge.score_submitted") {
    const rawScore =
      isRecord(payload.judgeScore) ? payload.judgeScore : payload;

    if (
      typeof rawScore.id === "string" &&
      typeof rawScore.stageId === "string" &&
      typeof rawScore.judgeId === "string" &&
      (rawScore.judgeRole === "agent" ||
        rawScore.judgeRole === "host" ||
        rawScore.judgeRole === "judge" ||
        rawScore.judgeRole === "viewer" ||
        rawScore.judgeRole === "admin") &&
      (rawScore.targetType === "team" || rawScore.targetType === "submission") &&
      typeof rawScore.targetId === "string" &&
      typeof rawScore.score === "number" &&
      typeof rawScore.reason === "string" &&
      typeof rawScore.favorite === "string" &&
      typeof rawScore.mostAbsurd === "string"
    ) {
      next = {
        ...next,
        scores: upsertScoreById(next.scores, {
          id: rawScore.id,
          activityRunId:
            typeof rawScore.activityRunId === "string"
              ? rawScore.activityRunId
              : next.activityRun.id,
          stageId: rawScore.stageId,
          judgeId: rawScore.judgeId,
          judgeRole: rawScore.judgeRole,
          targetType: rawScore.targetType,
          targetId: rawScore.targetId,
          submissionId:
            typeof rawScore.submissionId === "string"
              ? rawScore.submissionId
              : undefined,
          teamId:
            typeof rawScore.teamId === "string" ? rawScore.teamId : undefined,
          score: rawScore.score,
          reason: rawScore.reason,
          favorite: rawScore.favorite,
          mostAbsurd: rawScore.mostAbsurd,
          submittedAt:
            typeof rawScore.submittedAt === "number"
              ? rawScore.submittedAt
              : event.timestamp,
        }),
      };
    }
  }

  if (event.type === "award.granted") {
    const rawAward = isRecord(payload.award) ? payload.award : payload;
    if (
      typeof rawAward.awardId === "string" &&
      typeof rawAward.label === "string" &&
      typeof rawAward.entityId === "string"
    ) {
      next = {
        ...next,
        awards: upsertAwardById(next.awards, {
          awardId: rawAward.awardId,
          label: rawAward.label,
          entityId: rawAward.entityId,
          reason:
            typeof rawAward.reason === "string" ? rawAward.reason : undefined,
          grantedAt:
            typeof rawAward.grantedAt === "number"
              ? rawAward.grantedAt
              : event.timestamp,
        }),
      };
    }
  }

  return next;
};

const buildBootstrapActivityStartedEvent = (
  seedProjection: ProjectionState,
): EventEnvelope => {
  const now = seedProjection.activityRun.startedAt ?? Date.now();
  return {
    id: "evt-1",
    sequence: 1,
    type: "activity.started",
    activityRunId: seedProjection.activityRun.id,
    timestamp: now,
    payload: {
      activityRunId: seedProjection.activityRun.id,
      stageId: seedProjection.activityRun.currentStageId,
      startedAt: now,
    },
  };
};

const rebuildProjectionFromEventLog = (
  events: EventEnvelope[],
  seedProjection = buildSeedProjection(),
): ProjectionState =>
  events.reduce(applyEventToProjection, seedProjection);

const loadProjection = (): ProjectionState => {
  ensureDataDir();

  const storedProjection = parseJsonFile<ProjectionState>(projectionFilePath);
  const rawEvents = readEventLog();
  const events =
    rawEvents.length > 0
      ? rawEvents
      : (() => {
          const seedProjection = buildSeedProjection();
          const bootstrapEvent =
            buildBootstrapActivityStartedEvent(seedProjection);
          appendEventRecord(bootstrapEvent);
          return [bootstrapEvent];
        })();

  const rebuiltProjection = rebuildProjectionFromEventLog(events);
  if (
    storedProjection &&
    storedProjection.lastSequence !== rebuiltProjection.lastSequence
  ) {
    console.warn(
      `[openclaw-orchestrator] Rebuilt projection from event log; stored projection lastSequence=${storedProjection.lastSequence}, rebuilt=${rebuiltProjection.lastSequence}.`,
    );
  }

  writeProjection(rebuiltProjection);
  return rebuiltProjection;
};

let projection = loadProjection();

const rebuildCommandJournal = (records: AuditRecord[]): Map<string, CommandJournalEntry> => {
  const journal = new Map<string, CommandJournalEntry>();

  for (const record of records) {
    if (!record.idempotencyKey || journal.has(record.idempotencyKey)) {
      continue;
    }

    if (!record.fingerprint || record.replayed) {
      continue;
    }

    if (record.status !== "accepted" && record.status !== "rejected") {
      continue;
    }

    if (record.status === "accepted" && record.receipt) {
      journal.set(record.idempotencyKey, {
        fingerprint: record.fingerprint,
        accepted: true,
        receipt: record.receipt,
      });
      continue;
    }

    if (record.status === "rejected" && record.error) {
      journal.set(record.idempotencyKey, {
        fingerprint: record.fingerprint,
        accepted: false,
        error: {
          ...record.error,
          status:
            typeof record.error.status === "number"
              ? record.error.status
              : 400,
          commandId: record.commandId,
          commandType: record.commandType,
          activityRunId: record.activityRunId,
          issuedAt: record.issuedAt,
          handledAt: record.handledAt,
          sourceCommandId: record.sourceCommandId,
        },
      });
    }
  }

  return journal;
};

const auditLog = readAuditLog();
const commandJournal = rebuildCommandJournal(auditLog);

const buildHealthAgents = (): HealthAgent[] =>
  Array.from(sessions.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((session) => ({
      agentId: session.agentId,
      sessions: {
        recent: [
          {
            key: session.key,
            updatedAt: session.updatedAt,
          },
        ],
      },
    }));

const buildSnapshotEnvelope = (now = Date.now()) => ({
  snapshotId: projection.snapshotId,
  activityRun: projection.activityRun,
  world: worldProjection,
  timers: projection.timers.map((timer) => ({
    id: timer.id,
    stageId: timer.stageId,
    remainingMs: computeRemainingMs(timer, now),
    state: timer.state,
  })),
  skills: skillBindings,
  submissions: projection.submissions.map((submission) => ({
    id: submission.id,
    schemaId: submission.schemaId,
    locked: submission.locked,
    teamId: submission.teamId,
    stageId: submission.stageId,
    openedAt: submission.openedAt,
    updatedAt: submission.updatedAt,
    lockedAt: submission.lockedAt,
  })),
  scores: projection.scores.map((score) => ({
    id: score.id,
    activityRunId: score.activityRunId,
    stageId: score.stageId,
    judgeId: score.judgeId,
    judgeRole: score.judgeRole,
    targetType: score.targetType,
    targetId: score.targetId,
    submissionId: score.submissionId,
    teamId: score.teamId,
    score: score.score,
    reason: score.reason,
    favorite: score.favorite,
    mostAbsurd: score.mostAbsurd,
    submittedAt: score.submittedAt,
  })),
  scoreSummary: buildScoreSummary(projection.scores),
  awards: projection.awards.map((award) => ({
    awardId: award.awardId,
    label: award.label,
    entityId: award.entityId,
    reason: award.reason,
    grantedAt: award.grantedAt,
  })),
  lastSequence: projection.lastSequence,
  health: {
    agents: buildHealthAgents(),
    ts: now,
  },
});

const sendJson = (
  value: unknown,
  init: ResponseInit = {},
): Response =>
  new Response(JSON.stringify(value, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      ...(init.headers ?? {}),
    },
  });

const sendErrorResponse = (error: unknown): Response => {
  const body =
    error instanceof OrchestratorError
      ? error.body
      : {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Unexpected orchestrator error.",
          status: 500,
          handledAt: Date.now(),
        };

  return sendJson(
    {
      ok: false,
      error: body,
    },
    { status: body.status },
  );
};

const sendRpcError = (
  ws: ServerWebSocket<WebSocketSessionData>,
  id: string,
  error: unknown,
): void => {
  const body =
    error instanceof OrchestratorError
      ? error.body
      : {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Unexpected orchestrator error.",
          status: 500,
          handledAt: Date.now(),
        };

  ws.send(
    JSON.stringify({
      type: "res",
      id,
      ok: false,
      error: {
        code: body.code,
        message: body.message,
        handledAt: body.handledAt,
        replayed: body.replayed ?? false,
        replayedFromIdempotency: body.replayedFromIdempotency,
        commandId: body.commandId,
        sourceCommandId: body.sourceCommandId,
        commandType: body.commandType,
        activityRunId: body.activityRunId,
        issuedAt: body.issuedAt,
      },
    }),
  );
};

const nextSequence = (): number => projection.lastSequence + 1;

const makeEvent = <TPayload extends Record<string, unknown>>(
  type: string,
  payload: TPayload,
  now = Date.now(),
  context: EventCommandContext = {},
): EventEnvelope<TPayload> => {
  const sequence = nextSequence();
  return {
    id: `evt-${sequence}`,
    sequence,
    type,
    activityRunId: projection.activityRun.id,
    commandId: context.commandId,
    idempotencyKey: context.idempotencyKey,
    actorId: context.actorId,
    actorRole: context.actorRole,
    timestamp: now,
    payload,
  };
};

const createEventBuilder = (context: EventCommandContext = {}) => {
  let sequence = projection.lastSequence;

  return <TPayload extends Record<string, unknown>>(
    type: string,
    payload: TPayload,
    now = Date.now(),
  ): EventEnvelope<TPayload> => {
    sequence += 1;
    return {
      id: `evt-${sequence}`,
      sequence,
      type,
      activityRunId: projection.activityRun.id,
      commandId: context.commandId,
      idempotencyKey: context.idempotencyKey,
      actorId: context.actorId,
      actorRole: context.actorRole,
      timestamp: now,
      payload,
    };
  };
};

const commitEvents = (events: EventEnvelope[]): void => {
  for (const event of events) {
    projection = applyEventToProjection(projection, event);
    appendEventRecord(event);
  }
  writeProjection(projection);
};

const broadcastEvent = (event: EventEnvelope): void => {
  const frame = JSON.stringify({
    type: "event",
    event: event.type,
    payload: event,
  });

  for (const client of clients) {
    client.send(frame);
  }
};

const broadcastHealth = (): void => {
  const frame = JSON.stringify({
    type: "event",
    event: "health",
    payload: {
      agents: buildHealthAgents(),
      ts: Date.now(),
    },
  });

  for (const client of clients) {
    client.send(frame);
  }
};

const clearTimerHandle = (timerId: string): void => {
  const handle = timerHandles.get(timerId);
  if (!handle) {
    return;
  }
  clearTimeout(handle);
  timerHandles.delete(timerId);
};

const scheduleTimerEnd = (timer: TimerProjection): void => {
  clearTimerHandle(timer.id);
  if (timer.state !== "running" || typeof timer.endsAt !== "number") {
    return;
  }

  const delay = Math.max(0, timer.endsAt - Date.now());
  const handle = setTimeout(() => {
    const latestTimer = projection.timers.find((entry) => entry.id === timer.id);
    if (!latestTimer || latestTimer.state !== "running") {
      return;
    }

    const endedAt = Date.now();
    const timerEndedEvent = makeEvent(
      "timer.ended",
      {
        stageId: latestTimer.stageId,
        timer: {
          ...latestTimer,
          remainingMs: 0,
          state: "ended",
          endedAt,
          endsAt: latestTimer.endsAt,
        },
      },
      endedAt,
      latestTimer.commandContext ?? {},
    );
    commitEvents([timerEndedEvent]);
    clearTimerHandle(latestTimer.id);
    broadcastEvent(timerEndedEvent);
  }, delay);

  timerHandles.set(timer.id, handle);
};

const syncTimerSchedules = (): void => {
  for (const timer of projection.timers) {
    if (timer.state === "running") {
      scheduleTimerEnd(timer);
    } else {
      clearTimerHandle(timer.id);
    }
  }
};

syncTimerSchedules();

const createCommandError = (
  command: CommandEnvelope,
  handledAt: number,
  code: string,
  message: string,
  status = 400,
  extra: Partial<StableErrorBody> = {},
): OrchestratorError =>
  new OrchestratorError({
    code,
    message,
    status,
    commandId: command.id,
    sourceCommandId: extra.sourceCommandId ?? command.id,
    commandType: command.type,
    activityRunId: command.activityRunId ?? projection.activityRun.id,
    issuedAt: command.issuedAt,
    handledAt,
    replayed: extra.replayed,
    replayedFromIdempotency: extra.replayedFromIdempotency,
  });

const requireHostRole = (
  command: CommandEnvelope,
  handledAt: number,
): void => {
  if (command.actorRole === "host" || command.actorRole === "admin") {
    return;
  }

  throw createCommandError(
    command,
    handledAt,
    "FORBIDDEN",
    `Command ${command.type} requires host/admin role.`,
    403,
  );
};

const requireScoreRole = (
  command: CommandEnvelope,
  handledAt: number,
): void => {
  if (
    command.actorRole === "judge" ||
    command.actorRole === "admin"
  ) {
    return;
  }

  throw createCommandError(
    command,
    handledAt,
    "FORBIDDEN",
    `Command ${command.type} requires judge/admin role.`,
    403,
  );
};

const findStage = (stageId: string): StageTemplate | undefined =>
  stageTemplates.find((stage) => stage.id === stageId);

const findTeam = (teamId: string) =>
  worldProjection.teams.find((team) => team.id === teamId);

const inferSubmissionSchemaId = (stageId: string | null): string | null => {
  const stage = stageId ? findStage(stageId) : undefined;
  return stage?.submissionSchemaIds?.[0] ?? null;
};

const inferSubmissionTeamId = (submissionId: string): string | undefined => {
  const numericSuffix = submissionId.match(/(\d+)$/)?.[1];
  if (!numericSuffix) {
    return undefined;
  }

  const normalized = Number.parseInt(numericSuffix, 10);
  return Number.isFinite(normalized) ? `team-${normalized}` : undefined;
};

const buildSubmissionProjection = (
  submissionId: string,
  now: number,
): SubmissionProjection => {
  const currentStageId = projection.activityRun.currentStageId;
  const schemaId = inferSubmissionSchemaId(currentStageId);
  if (!schemaId) {
    throw new OrchestratorError({
      code: "SUBMISSION_STAGE_REQUIRED",
      message:
        "open_submission requires the current stage to expose a submission schema.",
      status: 409,
      handledAt: now,
    });
  }

  const teamId = inferSubmissionTeamId(submissionId);
  return {
    id: submissionId,
    activityRunId: projection.activityRun.id,
    submitterId: teamId ?? "host-01",
    schemaId,
    data: {},
    locked: false,
    teamId,
    stageId: currentStageId ?? undefined,
    openedAt: now,
    updatedAt: now,
  };
};

const buildScoreTargetId = ({
  teamId,
  submissionId,
}: {
  teamId?: string;
  submissionId?: string;
}): { targetType: "team" | "submission"; targetId: string } => {
  if (teamId) {
    return {
      targetType: "team",
      targetId: teamId,
    };
  }

  if (submissionId) {
    return {
      targetType: "submission",
      targetId: submissionId,
    };
  }

  throw new Error("Score target requires teamId or submissionId.");
};

const buildScoreProjection = (
  command: CommandEnvelope,
  handledAt: number,
): ScoreProjection => {
  const currentStageId = projection.activityRun.currentStageId;
  if (currentStageId !== "act-7-ai-judging") {
    throw createCommandError(
      command,
      handledAt,
      "SCORE_STAGE_REQUIRED",
      "submit_score is only allowed during act-7-ai-judging.",
      409,
    );
  }

  const payload = command.payload;
  const submissionId =
    typeof payload.submissionId === "string"
      ? payload.submissionId.trim()
      : "";
  const teamId =
    typeof payload.teamId === "string" ? payload.teamId.trim() : "";
  const scoreValue =
    typeof payload.score === "number"
      ? Math.round(payload.score)
      : Number.NaN;
  const reason =
    typeof payload.reason === "string" ? payload.reason.trim() : "";
  const favorite =
    typeof payload.favorite === "string" ? payload.favorite.trim() : "";
  const mostAbsurd =
    typeof payload.mostAbsurd === "string" ? payload.mostAbsurd.trim() : "";

  if (!submissionId && !teamId) {
    throw createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "submit_score requires payload.submissionId or payload.teamId.",
    );
  }

  if (
    !Number.isFinite(scoreValue) ||
    scoreValue < 1 ||
    scoreValue > 10
  ) {
    throw createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "submit_score requires payload.score as an integer between 1 and 10.",
    );
  }

  if (!reason || !favorite || !mostAbsurd) {
    throw createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "submit_score requires non-empty payload.reason, payload.favorite, and payload.mostAbsurd.",
    );
  }

  if (teamId && !findTeam(teamId)) {
    throw createCommandError(
      command,
      handledAt,
      "UNKNOWN_TEAM",
      `Unknown team ${teamId}.`,
      404,
    );
  }

  let resolvedSubmission =
    submissionId.length > 0
      ? projection.submissions.find((submission) => submission.id === submissionId)
      : undefined;

  if (!resolvedSubmission && teamId) {
    const lockedTeamSubmissions = projection.submissions.filter(
      (submission) => submission.teamId === teamId && submission.locked,
    );

    if (lockedTeamSubmissions.length === 1) {
      [resolvedSubmission] = lockedTeamSubmissions;
    } else if (lockedTeamSubmissions.length > 1) {
      throw createCommandError(
        command,
        handledAt,
        "SCORE_TARGET_AMBIGUOUS",
        `Team ${teamId} has multiple locked submissions. Provide payload.submissionId explicitly.`,
        409,
      );
    }
  }

  if (!resolvedSubmission) {
    throw createCommandError(
      command,
      handledAt,
      "SUBMISSION_NOT_FOUND",
      submissionId
        ? `Submission ${submissionId} does not exist.`
        : `No locked submission is available for team ${teamId}.`,
      404,
    );
  }

  if (!resolvedSubmission.locked) {
    throw createCommandError(
      command,
      handledAt,
      "SUBMISSION_NOT_LOCKED",
      `Submission ${resolvedSubmission.id} must be locked before scoring.`,
      409,
    );
  }

  if (
    teamId &&
    resolvedSubmission.teamId &&
    resolvedSubmission.teamId !== teamId
  ) {
    throw createCommandError(
      command,
      handledAt,
      "SCORE_TARGET_MISMATCH",
      `Submission ${resolvedSubmission.id} belongs to ${resolvedSubmission.teamId}, not ${teamId}.`,
      409,
    );
  }

  const resolvedSubmissionId = resolvedSubmission.id;
  const resolvedTeamId = resolvedSubmission.teamId ?? (teamId || undefined);
  const { targetType, targetId } = buildScoreTargetId({
    submissionId: resolvedSubmissionId,
  });
  const scoreId = `score-${command.actorId}-${targetType}-${targetId}`;
  const duplicate = projection.scores.find(
    (entry) =>
      entry.judgeId === command.actorId &&
      (entry.submissionId === resolvedSubmissionId ||
        (resolvedTeamId !== undefined && entry.teamId === resolvedTeamId)),
  );
  if (duplicate) {
    throw createCommandError(
      command,
      handledAt,
      "SCORE_ALREADY_SUBMITTED",
      `Judge ${command.actorId} has already submitted a score for ${targetType} ${targetId}.`,
      409,
    );
  }

  return {
    id: scoreId,
    activityRunId: projection.activityRun.id,
    stageId: currentStageId,
    judgeId: command.actorId,
    judgeRole: command.actorRole,
    targetType,
    targetId,
    submissionId: resolvedSubmissionId,
    teamId: resolvedTeamId,
    score: scoreValue,
    reason,
    favorite,
    mostAbsurd,
    submittedAt: handledAt,
  };
};

const extractBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const requireHttpAuth = (request: Request): void => {
  const bearer = extractBearerToken(request);
  if (bearer !== authToken) {
    throw new OrchestratorError({
      code: "UNAUTHORIZED",
      message: "Unauthorized.",
      status: 401,
      handledAt: Date.now(),
    });
  }
};

const parsePositiveInt = (
  rawValue: string | null,
  field: string,
): number | undefined => {
  if (rawValue === null || rawValue.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new OrchestratorError({
      code: "INVALID_QUERY",
      message: `${field} must be a non-negative integer.`,
      status: 400,
      handledAt: Date.now(),
    });
  }

  return parsed;
};

const parseLimit = (rawValue: string | null, defaultValue: number): number => {
  const parsed = parsePositiveInt(rawValue, "limit");
  return Math.max(1, Math.min(200, parsed ?? defaultValue));
};

const resolveRequestedActivityRunId = (
  activityRunId: string | undefined,
): string => {
  if (!activityRunId) {
    return projection.activityRun.id;
  }

  if (activityRunId !== projection.activityRun.id) {
    throw new OrchestratorError({
      code: "UNKNOWN_ACTIVITY_RUN",
      message: `Unknown activity run ${activityRunId}. Expected ${projection.activityRun.id}.`,
      status: 404,
      handledAt: Date.now(),
    });
  }

  return activityRunId;
};

const queryEvents = ({
  activityRunId,
  afterSequence,
  fromSequence,
  toSequence,
  limit,
}: {
  activityRunId?: string;
  afterSequence?: number;
  fromSequence?: number;
  toSequence?: number;
  limit: number;
}): EventQueryResult => {
  if (
    typeof afterSequence === "number" &&
    typeof fromSequence === "number"
  ) {
    throw new OrchestratorError({
      code: "INVALID_QUERY",
      message: "Use afterSequence or fromSequence, not both.",
      status: 400,
      handledAt: Date.now(),
    });
  }

  const resolvedActivityRunId =
    resolveRequestedActivityRunId(activityRunId);
  const log = readEventLog().filter(
    (event) =>
      (event.activityRunId ?? projection.activityRun.id) ===
      resolvedActivityRunId,
  );
  const requestedFromSequence =
    typeof fromSequence === "number"
      ? fromSequence
      : typeof afterSequence === "number"
        ? afterSequence + 1
        : undefined;

  const ranged = log.filter((event) => {
    if (
      typeof requestedFromSequence === "number" &&
      event.sequence < requestedFromSequence
    ) {
      return false;
    }

    if (typeof toSequence === "number" && event.sequence > toSequence) {
      return false;
    }

    return true;
  });

  const page =
    typeof requestedFromSequence === "number"
      ? ranged.slice(0, limit)
      : ranged.slice(-limit);

  return {
    activityRunId: resolvedActivityRunId,
    fromSequence:
      page[0]?.sequence ??
      requestedFromSequence ??
      null,
    toSequence:
      page.length > 0
        ? page[page.length - 1].sequence
        : typeof toSequence === "number"
          ? toSequence
          : null,
    lastSequence: projection.lastSequence,
    hasMore: ranged.length > page.length,
    events: page,
  };
};

const queryScoreEvents = ({
  activityRunId,
  afterSequence,
  fromSequence,
  toSequence,
  limit,
}: {
  activityRunId?: string;
  afterSequence?: number;
  fromSequence?: number;
  toSequence?: number;
  limit: number;
}): EventQueryResult => {
  if (
    typeof afterSequence === "number" &&
    typeof fromSequence === "number"
  ) {
    throw new OrchestratorError({
      code: "INVALID_QUERY",
      message: "Use afterSequence or fromSequence, not both.",
      status: 400,
      handledAt: Date.now(),
    });
  }

  const resolvedActivityRunId =
    resolveRequestedActivityRunId(activityRunId);
  const log = readEventLog().filter(
    (event) =>
      (event.activityRunId ?? projection.activityRun.id) ===
        resolvedActivityRunId && event.type === "judge.score_submitted",
  );
  const requestedFromSequence =
    typeof fromSequence === "number"
      ? fromSequence
      : typeof afterSequence === "number"
        ? afterSequence + 1
        : undefined;

  const ranged = log.filter((event) => {
    if (
      typeof requestedFromSequence === "number" &&
      event.sequence < requestedFromSequence
    ) {
      return false;
    }

    if (typeof toSequence === "number" && event.sequence > toSequence) {
      return false;
    }

    return true;
  });

  const page =
    typeof requestedFromSequence === "number"
      ? ranged.slice(0, limit)
      : ranged.slice(-limit);

  return {
    activityRunId: resolvedActivityRunId,
    fromSequence:
      page[0]?.sequence ??
      requestedFromSequence ??
      null,
    toSequence:
      page.length > 0
        ? page[page.length - 1].sequence
        : typeof toSequence === "number"
          ? toSequence
          : null,
    lastSequence: projection.lastSequence,
    hasMore: ranged.length > page.length,
    events: page,
  };
};

const queryScores = ({
  activityRunId,
  afterSequence,
  fromSequence,
  toSequence,
  limit,
}: {
  activityRunId?: string;
  afterSequence?: number;
  fromSequence?: number;
  toSequence?: number;
  limit: number;
}): ScoreQueryResult => {
  const eventPage = queryScoreEvents({
    activityRunId,
    afterSequence,
    fromSequence,
    toSequence,
    limit,
  });
  const resolvedScores = projection.scores
    .filter(
      (score) =>
        (score.activityRunId ?? projection.activityRun.id) ===
        eventPage.activityRunId,
    )
    .sort((left, right) => {
      if (right.submittedAt !== left.submittedAt) {
        return right.submittedAt - left.submittedAt;
      }
      return left.id.localeCompare(right.id);
    });

  return {
    activityRunId: eventPage.activityRunId,
    currentStageId: projection.activityRun.currentStageId,
    scoreCount: resolvedScores.length,
    scores: resolvedScores,
    scoreSummary: buildScoreSummary(resolvedScores),
    fromSequence: eventPage.fromSequence,
    toSequence: eventPage.toSequence,
    lastSequence: eventPage.lastSequence,
    hasMore: eventPage.hasMore,
    events: eventPage.events,
  };
};

const queryAudit = ({
  activityRunId,
  limit,
}: {
  activityRunId?: string;
  limit: number;
}): AuditQueryResult => {
  const resolvedActivityRunId =
    resolveRequestedActivityRunId(activityRunId);
  const records = readAuditLog().filter(
    (record) =>
      (record.activityRunId ?? projection.activityRun.id) ===
      resolvedActivityRunId,
  );
  const page = records.slice(-limit);

  return {
    activityRunId: resolvedActivityRunId,
    count: page.length,
    hasMore: records.length > page.length,
    records: page,
  };
};

const parseCommandEnvelope = (value: unknown): CommandEnvelope | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.actorId !== "string" ||
    typeof value.actorRole !== "string" ||
    typeof value.type !== "string" ||
    typeof value.issuedAt !== "number" ||
    !isRecord(value.payload)
  ) {
    return null;
  }

  return value as CommandEnvelope;
};

const buildAuditRecord = ({
  command,
  fingerprint,
  handledAt,
  status,
  accepted,
  replayed,
  replayedFromIdempotency,
  sourceCommandId,
  receipt,
  error,
}: {
  command: CommandEnvelope;
  fingerprint?: string;
  handledAt: number;
  status: AuditStatus;
  accepted: boolean;
  replayed: boolean;
  replayedFromIdempotency?: string;
  sourceCommandId?: string;
  receipt?: CommandReceipt;
  error?: StableErrorBody;
}): AuditRecord => ({
  auditId: `audit-${Date.now()}-${crypto.randomUUID()}`,
  commandId: command.id,
  sourceCommandId: sourceCommandId ?? command.id,
  commandType: command.type,
  activityRunId: command.activityRunId ?? projection.activityRun.id,
  actorId: command.actorId,
  actorRole: command.actorRole,
  idempotencyKey: command.idempotencyKey,
  issuedAt: command.issuedAt,
  handledAt,
  fingerprint,
  status,
  accepted,
  replayed,
  replayedFromIdempotency,
  error:
    error
      ? {
          code: error.code,
          message: error.message,
          status: error.status,
        }
      : undefined,
  emittedEventIds: receipt?.eventIds ?? [],
  emittedSequences: receipt?.emittedSequences ?? [],
  receipt,
});

const recordAudit = (record: AuditRecord): void => {
  auditLog.push(record);
  appendAuditRecord(record);
};

const buildAcceptedReceipt = (
  command: CommandEnvelope,
  handledAt: number,
  events: EventEnvelope[],
  note?: string,
): CommandReceipt => ({
  status: "accepted",
  accepted: true,
  replayed: false,
  commandId: command.id,
  requestCommandId: command.id,
  commandType: command.type,
  activityRunId: command.activityRunId ?? projection.activityRun.id,
  issuedAt: command.issuedAt,
  handledAt,
  eventIds: events.map((event) => event.id),
  emittedSequences: events.map((event) => event.sequence),
  events,
  snapshotId: projection.snapshotId,
  lastSequence: projection.lastSequence,
  note,
});

const buildReplayReceipt = (
  storedReceipt: CommandReceipt,
  requestCommand: CommandEnvelope,
  handledAt: number,
): CommandReceipt => ({
  ...storedReceipt,
  status: "replayed",
  replayed: true,
  replayedFromIdempotency: requestCommand.idempotencyKey,
  requestCommandId: requestCommand.id,
  handledAt,
});

const buildReplayError = (
  storedError: StableErrorBody,
  requestCommand: CommandEnvelope,
  handledAt: number,
): OrchestratorError =>
  new OrchestratorError({
    ...storedError,
    commandId: requestCommand.id,
    sourceCommandId: storedError.sourceCommandId ?? storedError.commandId,
    commandType: requestCommand.type,
    activityRunId:
      requestCommand.activityRunId ?? storedError.activityRunId,
    issuedAt: requestCommand.issuedAt,
    handledAt,
    replayed: true,
    replayedFromIdempotency: requestCommand.idempotencyKey,
  });

const executeFreshCommand = (
  command: CommandEnvelope,
  handledAt: number,
): CommandReceipt => {
  const resolvedActivityRunId = resolveRequestedActivityRunId(
    command.activityRunId,
  );
  if (command.type === "submit_score") {
    requireScoreRole(command, handledAt);
  } else {
    requireHostRole(command, handledAt);
  }

  const events: EventEnvelope[] = [];
  const queueEvent = createEventBuilder({
    commandId: command.id,
    idempotencyKey: command.idempotencyKey,
    actorId: command.actorId,
    actorRole: command.actorRole,
  });

  if (command.type === "transition_stage") {
    const payload = command.payload;
    const targetStageId =
      typeof payload.targetStageId === "string"
        ? payload.targetStageId.trim()
        : "";
    if (!targetStageId) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        "transition_stage requires payload.targetStageId.",
      );
    }

    if (!findStage(targetStageId)) {
      throw createCommandError(
        command,
        handledAt,
        "UNKNOWN_STAGE",
        `Unknown stage ${targetStageId}.`,
      );
    }

    if (projection.activityRun.currentStageId === targetStageId) {
      return buildAcceptedReceipt(
        command,
        handledAt,
        [],
        `Stage already at ${targetStageId}.`,
      );
    }

    const activeTimers = projection.timers.filter(
      (timer) => timer.state === "running",
    );
    for (const timer of activeTimers) {
      events.push(
        queueEvent(
          "timer.paused",
          {
            stageId: timer.stageId,
            reason: "stage_transition",
            timer: {
              ...timer,
              remainingMs: computeRemainingMs(timer, handledAt),
              state: "paused",
              pausedAt: handledAt,
              commandContext: {
                commandId: command.id,
                idempotencyKey: command.idempotencyKey,
                actorId: command.actorId,
                actorRole: command.actorRole,
              },
            },
          },
          handledAt,
        ),
      );
    }

    events.push(
      queueEvent(
        "stage.changed",
        {
          activityRunId: resolvedActivityRunId,
          fromStageId: projection.activityRun.currentStageId,
          toStageId: targetStageId,
          stageId: targetStageId,
          changedBy: command.actorId,
        },
        handledAt,
      ),
    );
  } else if (command.type === "start_timer") {
    const payload = command.payload;
    const stageId =
      typeof payload.stageId === "string" ? payload.stageId.trim() : "";
    const durationSec =
      typeof payload.durationSec === "number"
        ? Math.max(1, Math.round(payload.durationSec))
        : NaN;

    if (!stageId || !Number.isFinite(durationSec)) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        "start_timer requires payload.stageId and payload.durationSec.",
      );
    }

    if (!findStage(stageId)) {
      throw createCommandError(
        command,
        handledAt,
        "UNKNOWN_STAGE",
        `Unknown stage ${stageId}.`,
      );
    }

    const timerId = `timer-${stageId}`;
    const previous = projection.timers.find((timer) => timer.id === timerId);
    if (previous?.state === "running") {
      events.push(
        queueEvent(
          "timer.paused",
          {
            stageId,
            reason: "timer_restarted",
            timer: {
              ...previous,
              remainingMs: computeRemainingMs(previous, handledAt),
              state: "paused",
              pausedAt: handledAt,
              commandContext: {
                commandId: command.id,
                idempotencyKey: command.idempotencyKey,
                actorId: command.actorId,
                actorRole: command.actorRole,
              },
            },
          },
          handledAt,
        ),
      );
    }

    events.push(
      queueEvent(
        "timer.started",
        {
          stageId,
          timer: {
            id: timerId,
            stageId,
            durationSec,
            remainingMs: durationSec * 1_000,
            state: "running",
            kind: "countdown",
            startedAt: handledAt,
            endsAt: handledAt + durationSec * 1_000,
            commandContext: {
              commandId: command.id,
              idempotencyKey: command.idempotencyKey,
              actorId: command.actorId,
              actorRole: command.actorRole,
            },
          },
        },
        handledAt,
      ),
    );
  } else if (command.type === "open_submission") {
    const payload = command.payload;
    const submissionId =
      typeof payload.submissionId === "string"
        ? payload.submissionId.trim()
        : "";
    if (!submissionId) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        "open_submission requires payload.submissionId.",
      );
    }

    const existingSubmission = projection.submissions.find(
      (submission) => submission.id === submissionId,
    );
    if (existingSubmission) {
      throw createCommandError(
        command,
        handledAt,
        "SUBMISSION_ALREADY_OPENED",
        `Submission ${submissionId} is already opened.`,
        409,
      );
    }

    const nextSubmission = buildSubmissionProjection(submissionId, handledAt);
    events.push(
      queueEvent(
        "submission.opened",
        {
          stageId: nextSubmission.stageId,
          submission: nextSubmission,
        },
        handledAt,
      ),
    );
  } else if (command.type === "lock_submission") {
    const payload = command.payload;
    const submissionId =
      typeof payload.submissionId === "string"
        ? payload.submissionId.trim()
        : "";
    if (!submissionId) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        "lock_submission requires payload.submissionId.",
      );
    }

    const existingSubmission = projection.submissions.find(
      (submission) => submission.id === submissionId,
    );

    if (!existingSubmission) {
      throw createCommandError(
        command,
        handledAt,
        "SUBMISSION_NOT_OPENED",
        `Submission ${submissionId} is not opened.`,
        409,
      );
    }

    if (existingSubmission.locked) {
      throw createCommandError(
        command,
        handledAt,
        "SUBMISSION_ALREADY_LOCKED",
        `Submission ${submissionId} is already locked.`,
        409,
      );
    }

    const updatedSubmission: SubmissionProjection = {
      ...existingSubmission,
      updatedAt: handledAt,
    };

    events.push(
      queueEvent(
        "submission.updated",
        {
          stageId: updatedSubmission.stageId,
          submission: updatedSubmission,
        },
        handledAt,
      ),
    );

    events.push(
      queueEvent(
        "submission.locked",
        {
          stageId: updatedSubmission.stageId,
          submission: {
            ...updatedSubmission,
            locked: true,
            updatedAt: handledAt,
            lockedAt: handledAt,
          },
        },
        handledAt,
      ),
    );
  } else if (command.type === "submit_score") {
    const nextScore = buildScoreProjection(command, handledAt);

    events.push(
      queueEvent(
        "judge.score_submitted",
        {
          stageId: nextScore.stageId,
          judgeScore: nextScore,
        },
        handledAt,
      ),
    );
  } else if (command.type === "grant_award") {
    const payload = command.payload;
    const awardId =
      typeof payload.awardId === "string" ? payload.awardId.trim() : "";
    const entityId =
      typeof payload.entityId === "string" ? payload.entityId.trim() : "";
    const label =
      typeof payload.label === "string" && payload.label.trim().length > 0
        ? payload.label.trim()
        : awardId;
    const reason =
      typeof payload.reason === "string" && payload.reason.trim().length > 0
        ? payload.reason.trim()
        : undefined;

    if (!awardId || !entityId) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        "grant_award requires payload.awardId and payload.entityId.",
      );
    }

    const existingAward = projection.awards.find(
      (award) => award.awardId === awardId,
    );
    if (existingAward) {
      throw createCommandError(
        command,
        handledAt,
        "AWARD_ALREADY_GRANTED",
        `Award ${awardId} has already been granted.`,
        409,
      );
    }

    events.push(
      queueEvent(
        "award.granted",
        {
          award: {
            awardId,
            label,
            entityId,
            reason,
            grantedAt: handledAt,
          },
        },
        handledAt,
      ),
    );
  } else {
    throw createCommandError(
      command,
      handledAt,
      "UNSUPPORTED_COMMAND",
      `Unsupported command type ${command.type}.`,
      400,
    );
  }

  commitEvents(events);
  syncTimerSchedules();
  for (const event of events) {
    broadcastEvent(event);
  }
  broadcastHealth();

  return buildAcceptedReceipt(command, handledAt, events);
};

const executeCommand = (command: CommandEnvelope): CommandReceipt => {
  const handledAt = Date.now();
  const fingerprint = buildCommandFingerprint(command);
  const journalEntry = command.idempotencyKey
    ? commandJournal.get(command.idempotencyKey)
    : undefined;

  if (
    command.idempotencyKey &&
    journalEntry &&
    journalEntry.fingerprint !== fingerprint
  ) {
    const conflictError = createCommandError(
      command,
      handledAt,
      "IDEMPOTENCY_CONFLICT",
      `Idempotency key ${command.idempotencyKey} is already bound to a different command payload.`,
      409,
      {
        sourceCommandId:
          journalEntry.receipt?.commandId ?? journalEntry.error?.commandId,
      },
    );

    recordAudit(
      buildAuditRecord({
        command,
        fingerprint,
        handledAt,
        status: "conflict",
        accepted: false,
        replayed: false,
        sourceCommandId: conflictError.body.sourceCommandId,
        error: conflictError.body,
      }),
    );
    throw conflictError;
  }

  if (journalEntry && command.idempotencyKey) {
    if (journalEntry.accepted && journalEntry.receipt) {
      const receipt = buildReplayReceipt(
        journalEntry.receipt,
        command,
        handledAt,
      );
      recordAudit(
        buildAuditRecord({
          command,
          fingerprint,
          handledAt,
          status: "replayed",
          accepted: true,
          replayed: true,
          replayedFromIdempotency: command.idempotencyKey,
          sourceCommandId: journalEntry.receipt.commandId,
          receipt,
        }),
      );
      return receipt;
    }

    if (journalEntry.error) {
      const replayedError = buildReplayError(
        journalEntry.error,
        command,
        handledAt,
      );
      recordAudit(
        buildAuditRecord({
          command,
          fingerprint,
          handledAt,
          status: "replayed",
          accepted: false,
          replayed: true,
          replayedFromIdempotency: command.idempotencyKey,
          sourceCommandId:
            replayedError.body.sourceCommandId ?? replayedError.body.commandId,
          error: replayedError.body,
        }),
      );
      throw replayedError;
    }
  }

  try {
    const receipt = executeFreshCommand(command, handledAt);
    if (command.idempotencyKey) {
      commandJournal.set(command.idempotencyKey, {
        fingerprint,
        accepted: true,
        receipt,
      });
    }

    recordAudit(
      buildAuditRecord({
        command,
        fingerprint,
        handledAt,
        status: "accepted",
        accepted: true,
        replayed: false,
        receipt,
      }),
    );
    return receipt;
  } catch (error) {
    const normalizedError =
      error instanceof OrchestratorError
        ? error
        : createCommandError(
            command,
            handledAt,
            "INTERNAL_ERROR",
            error instanceof Error ? error.message : "Unexpected command error.",
            500,
          );

    if (command.idempotencyKey) {
      commandJournal.set(command.idempotencyKey, {
        fingerprint,
        accepted: false,
        error: normalizedError.body,
      });
    }

    recordAudit(
      buildAuditRecord({
        command,
        fingerprint,
        handledAt,
        status: "rejected",
        accepted: false,
        replayed: false,
        sourceCommandId:
          normalizedError.body.sourceCommandId ??
          normalizedError.body.commandId,
        error: normalizedError.body,
      }),
    );
    throw normalizedError;
  }
};

const handleHttpCommand = async (request: Request): Promise<Response> => {
  try {
    requireHttpAuth(request);
  } catch (error) {
    return sendErrorResponse(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sendErrorResponse(
      new OrchestratorError({
        code: "INVALID_JSON",
        message: "Invalid JSON request body.",
        status: 400,
        handledAt: Date.now(),
      }),
    );
  }

  const payload = isRecord(body) ? body : null;
  const command = parseCommandEnvelope(payload?.command ?? payload);
  if (!command) {
    return sendErrorResponse(
      new OrchestratorError({
        code: "INVALID_COMMAND",
        message: "Missing command envelope.",
        status: 400,
        handledAt: Date.now(),
      }),
    );
  }

  try {
    const receipt = executeCommand(command);
    return sendJson({
      ok: true,
      receipt,
      snapshot: buildSnapshotEnvelope(),
    });
  } catch (error) {
    return sendErrorResponse(error);
  }
};

const parseRpcEventQueryParams = (
  params: Record<string, unknown>,
): {
  activityRunId?: string;
  afterSequence?: number;
  fromSequence?: number;
  toSequence?: number;
  limit: number;
} => ({
  activityRunId:
    typeof params.activityRunId === "string"
      ? params.activityRunId
      : undefined,
  afterSequence:
    typeof params.afterSequence === "number"
      ? params.afterSequence
      : undefined,
  fromSequence:
    typeof params.fromSequence === "number"
      ? params.fromSequence
      : undefined,
  toSequence:
    typeof params.toSequence === "number" ? params.toSequence : undefined,
  limit:
    typeof params.limit === "number"
      ? Math.max(1, Math.min(200, Math.round(params.limit)))
      : 20,
});

const handleRpcCommand = (
  ws: ServerWebSocket<WebSocketSessionData>,
  id: string,
  command: CommandEnvelope,
): void => {
  try {
    const receipt = executeCommand(command);
    ws.send(
      JSON.stringify({
        type: "res",
        id,
        ok: true,
        payload: {
          receipt,
          snapshot: buildSnapshotEnvelope(),
        },
      }),
    );
  } catch (error) {
    sendRpcError(ws, id, error);
  }
};

const handleWsMessage = (
  ws: ServerWebSocket<WebSocketSessionData>,
  rawMessage: string | Buffer | ArrayBuffer | Uint8Array,
): void => {
  const source =
    typeof rawMessage === "string"
      ? rawMessage
      : rawMessage instanceof ArrayBuffer
        ? Buffer.from(rawMessage).toString("utf8")
        : Buffer.from(rawMessage).toString("utf8");

  let frame: Record<string, unknown>;
  try {
    frame = JSON.parse(source) as Record<string, unknown>;
  } catch {
    return;
  }

  if (frame.type !== "req" || typeof frame.id !== "string") {
    return;
  }

  if (frame.method === "connect") {
    const params = isRecord(frame.params) ? frame.params : {};
    const auth = isRecord(params.auth) ? params.auth : {};
    const token = typeof auth.token === "string" ? auth.token.trim() : "";
    if (token !== authToken) {
      sendRpcError(
        ws,
        frame.id,
        new OrchestratorError({
          code: "UNAUTHORIZED",
          message: "Unauthorized.",
          status: 401,
          handledAt: Date.now(),
        }),
      );
      return;
    }

    const client = isRecord(params.client) ? params.client : {};
    const instanceId =
      typeof client.instanceId === "string" ? client.instanceId : "unknown-client";
    const role = typeof params.role === "string" ? params.role : "operator";
    const updatedAt = Date.now();

    ws.data.authed = true;
    ws.data.agentId = instanceId;
    ws.data.role = role;
    ws.data.key = `${role}:${instanceId}`;

    sessions.set(ws.data.connectionId, {
      agentId: instanceId,
      key: ws.data.key,
      kind: role,
      updatedAt,
      abortedLastRun: false,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      model: "",
      modelProvider: "",
      contextTokens: 0,
    });

    ws.send(
      JSON.stringify({
        type: "res",
        id: frame.id,
        ok: true,
        payload: {
          type: "hello-ok",
          features: {
            methods: supportedRpcMethods,
            events: supportedEvents,
          },
          snapshot: buildSnapshotEnvelope(updatedAt),
        },
      }),
    );
    broadcastHealth();
    return;
  }

  if (!ws.data.authed) {
    sendRpcError(
      ws,
      frame.id,
      new OrchestratorError({
        code: "CONNECT_REQUIRED",
        message: "Connect first.",
        status: 401,
        handledAt: Date.now(),
      }),
    );
    return;
  }

  const session = sessions.get(ws.data.connectionId);
  if (session) {
    session.updatedAt = Date.now();
    sessions.set(ws.data.connectionId, session);
  }

  if (frame.method === "status") {
    ws.send(
      JSON.stringify({
        type: "res",
        id: frame.id,
        ok: true,
        payload: {
          sessions: {
            recent: Array.from(sessions.values()).sort(
              (left, right) => right.updatedAt - left.updatedAt,
            ),
          },
        },
      }),
    );
    return;
  }

  if (frame.method === "orchestrator.command") {
    const params = isRecord(frame.params) ? frame.params : {};
    const command = parseCommandEnvelope(params.command);
    if (!command) {
      sendRpcError(
        ws,
        frame.id,
        new OrchestratorError({
          code: "INVALID_COMMAND",
          message: "Missing command envelope.",
          status: 400,
          handledAt: Date.now(),
        }),
      );
      return;
    }

    handleRpcCommand(ws, frame.id, command);
    return;
  }

  if (frame.method === "orchestrator.snapshot") {
    const params = isRecord(frame.params) ? frame.params : {};
    try {
      resolveRequestedActivityRunId(
        typeof params.activityRunId === "string"
          ? params.activityRunId
          : undefined,
      );
      ws.send(
        JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload: {
            snapshot: buildSnapshotEnvelope(),
            stageTemplates,
            submissionSchemas,
          },
        }),
      );
    } catch (error) {
      sendRpcError(ws, frame.id, error);
    }
    return;
  }

  if (frame.method === "orchestrator.events") {
    const params = isRecord(frame.params) ? frame.params : {};
    try {
      ws.send(
        JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload: queryEvents(parseRpcEventQueryParams(params)),
        }),
      );
    } catch (error) {
      sendRpcError(ws, frame.id, error);
    }
    return;
  }

  if (frame.method === "orchestrator.replay") {
    const params = isRecord(frame.params) ? frame.params : {};
    try {
      ws.send(
        JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload: queryEvents(parseRpcEventQueryParams(params)),
        }),
      );
    } catch (error) {
      sendRpcError(ws, frame.id, error);
    }
    return;
  }

  if (frame.method === "orchestrator.audit") {
    const params = isRecord(frame.params) ? frame.params : {};
    try {
      const activityRunId =
        typeof params.activityRunId === "string"
          ? params.activityRunId
          : undefined;
      const limit =
        typeof params.limit === "number"
          ? Math.max(1, Math.min(200, Math.round(params.limit)))
          : 20;

      ws.send(
        JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload: queryAudit({
            activityRunId,
            limit,
          }),
        }),
      );
    } catch (error) {
      sendRpcError(ws, frame.id, error);
    }
    return;
  }

  if (frame.method === "orchestrator.scores") {
    const params = isRecord(frame.params) ? frame.params : {};
    try {
      ws.send(
        JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload: queryScores(parseRpcEventQueryParams(params)),
        }),
      );
    } catch (error) {
      sendRpcError(ws, frame.id, error);
    }
    return;
  }

  sendRpcError(
    ws,
    frame.id,
    new OrchestratorError({
      code: "UNSUPPORTED_METHOD",
      message: `Unsupported RPC method ${String(frame.method)}.`,
      status: 400,
      handledAt: Date.now(),
    }),
  );
};

const server = Bun.serve<WebSocketSessionData>({
  hostname: host,
  port: Number.isFinite(port) ? port : 18791,
  fetch(request, runtime) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return sendJson({ ok: true });
    }

    if (
      (url.pathname === "/" || url.pathname === "/ws") &&
      runtime.upgrade(request, {
        data: {
          connectionId: crypto.randomUUID(),
          agentId: null,
          role: null,
          key: "pending",
          authed: false,
        },
      })
    ) {
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson({
        ok: true,
        service: "molt-claw-authoritative-orchestrator",
        activityRunId: projection.activityRun.id,
        currentStageId: projection.activityRun.currentStageId,
        lastSequence: projection.lastSequence,
        dataDir,
      });
    }

    if (request.method === "GET" && url.pathname === "/api/orchestrator/snapshot") {
      try {
        requireHttpAuth(request);
        resolveRequestedActivityRunId(
          url.searchParams.get("activityRunId") ?? undefined,
        );
        return sendJson({
          ok: true,
          snapshot: buildSnapshotEnvelope(),
          stageTemplates,
          submissionSchemas,
        });
      } catch (error) {
        return sendErrorResponse(error);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/orchestrator/events") {
      try {
        requireHttpAuth(request);
        return sendJson({
          ok: true,
          ...queryEvents({
            activityRunId: url.searchParams.get("activityRunId") ?? undefined,
            afterSequence: parsePositiveInt(
              url.searchParams.get("afterSequence"),
              "afterSequence",
            ),
            fromSequence: parsePositiveInt(
              url.searchParams.get("fromSequence"),
              "fromSequence",
            ),
            toSequence: parsePositiveInt(
              url.searchParams.get("toSequence"),
              "toSequence",
            ),
            limit: parseLimit(url.searchParams.get("limit"), 20),
          }),
        });
      } catch (error) {
        return sendErrorResponse(error);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/orchestrator/replay") {
      try {
        requireHttpAuth(request);
        return sendJson({
          ok: true,
          ...queryEvents({
            activityRunId: url.searchParams.get("activityRunId") ?? undefined,
            afterSequence: parsePositiveInt(
              url.searchParams.get("afterSequence"),
              "afterSequence",
            ),
            fromSequence: parsePositiveInt(
              url.searchParams.get("fromSequence"),
              "fromSequence",
            ),
            toSequence: parsePositiveInt(
              url.searchParams.get("toSequence"),
              "toSequence",
            ),
            limit: parseLimit(url.searchParams.get("limit"), 20),
          }),
        });
      } catch (error) {
        return sendErrorResponse(error);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/orchestrator/audit") {
      try {
        requireHttpAuth(request);
        return sendJson({
          ok: true,
          ...queryAudit({
            activityRunId: url.searchParams.get("activityRunId") ?? undefined,
            limit: parseLimit(url.searchParams.get("limit"), 20),
          }),
        });
      } catch (error) {
        return sendErrorResponse(error);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/orchestrator/scores") {
      try {
        requireHttpAuth(request);
        return sendJson({
          ok: true,
          ...queryScores({
            activityRunId: url.searchParams.get("activityRunId") ?? undefined,
            afterSequence: parsePositiveInt(
              url.searchParams.get("afterSequence"),
              "afterSequence",
            ),
            fromSequence: parsePositiveInt(
              url.searchParams.get("fromSequence"),
              "fromSequence",
            ),
            toSequence: parsePositiveInt(
              url.searchParams.get("toSequence"),
              "toSequence",
            ),
            limit: parseLimit(url.searchParams.get("limit"), 20),
          }),
        });
      } catch (error) {
        return sendErrorResponse(error);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/orchestrator/commands") {
      return handleHttpCommand(request);
    }

    return sendErrorResponse(
      new OrchestratorError({
        code: "NOT_FOUND",
        message: `Unknown route ${url.pathname}.`,
        status: 404,
        handledAt: Date.now(),
      }),
    );
  },
  websocket: {
    open(ws) {
      clients.add(ws);
      ws.send(
        JSON.stringify({
          type: "event",
          event: "connect.challenge",
          payload: {
            minProtocol: 3,
            maxProtocol: 3,
          },
        }),
      );
    },
    message(ws, message) {
      handleWsMessage(ws, message);
    },
    close(ws) {
      clients.delete(ws);
      sessions.delete(ws.data.connectionId);
      broadcastHealth();
    },
  },
});

console.log(
  JSON.stringify(
    {
      service: "molt-claw-authoritative-orchestrator",
      host,
      port: server.port,
      wsUrl: `ws://${host}:${server.port}`,
      httpUrl: `http://${host}:${server.port}`,
      activityRunId: projection.activityRun.id,
      currentStageId: projection.activityRun.currentStageId,
      dataDir,
      methods: supportedRpcMethods,
      events: supportedEvents,
    },
    null,
    2,
  ),
);
