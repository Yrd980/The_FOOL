#!/usr/bin/env bun

import type { ServerWebSocket } from "bun";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureActivityPackagesRegistered,
} from "../src/openclaw/activities";
import { normalizeActivityScoreAnnotations } from "../src/openclaw/activityRuntime";
import {
  getActivityPackage,
  tryGetActivityPackage,
  type ActivityPackage,
} from "../src/openclaw/platform/activityRegistry";
import type {
  AwardProjection,
  CommandConfirmationStatus,
  CommandEnvelope,
  EventCommandContext,
  EventEnvelope,
  ScoreAnnotations,
  ScoreProjection,
  SubmissionProjection,
  SubmissionVersionRecord,
  TimerProjection,
  TimerStatus,
} from "../src/openclaw/platform/contracts";
import { resolveLocalPlatformBootstrapConfig } from "../src/openclaw/localPlatformConfig";
import {
  OrchestratorError,
  buildCommandFingerprint,
  cloneJsonValue,
  createOrchestratorStorage,
  isRecord,
  isRole,
  type AuditQueryResult,
  type AuditRecord,
  type AuditStatus,
  type CommandJournalEntry,
  type CommandReceipt,
  type EventQueryResult,
  type ProjectionState,
  type ScoreQueryResult,
  type SessionProjection,
  type StableErrorBody,
  type WebSocketSessionData,
} from "./orchestrator/support";
import {
  parseLimit,
  parsePositiveInt,
  queryAudit as buildAuditQuery,
  queryEvents as buildEventQuery,
  queryScores as buildScoreQuery,
  resolveRequestedActivityRunId as resolveRequestedActivityRunIdFromQuery,
} from "./orchestrator/query";
import {
  sendErrorResponse,
  sendJson,
  sendRpcError,
} from "./orchestrator/transport";
import {
  createAcceptedReceipt,
  createAuditRecord,
  createReplayError,
  createReplayReceipt,
  parseCommandEnvelope,
} from "./orchestrator/audit";
import {
  buildHealthAgents,
  buildSnapshotEnvelope as createSnapshotEnvelope,
} from "./orchestrator/snapshot";
import {
  executeFreshCommand as executeFreshCommandByHandlers,
  type FreshCommandExecutionContext,
} from "./orchestrator/commands/execute";
import type { CommandHandlerContext } from "./orchestrator/commands/support";
import { createCommandHelpers } from "./orchestrator/commands/helpers";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const devRoot = path.resolve(scriptDir, "..");
const defaultDataDir = path.join(devRoot, ".orchestrator");
const dataDir =
  process.env.OPENCLAW_ORCHESTRATOR_DATA_DIR?.trim() || defaultDataDir;
const projectionFilePath = path.join(dataDir, "projection.json");
const eventLogFilePath = path.join(dataDir, "events.jsonl");
const auditLogFilePath = path.join(dataDir, "audit.jsonl");
const {
  appendAuditRecord,
  appendEventRecord,
  ensureDataDir,
  parseJsonFile,
  readAuditLog,
  readEventLog,
  writeProjection,
} = createOrchestratorStorage({
  dataDir,
  projectionFilePath,
  eventLogFilePath,
  auditLogFilePath,
});
const host = process.env.OPENCLAW_ORCHESTRATOR_HOST?.trim() || "127.0.0.1";
const port = Number.parseInt(
  process.env.OPENCLAW_ORCHESTRATOR_PORT?.trim() || "18791",
  10,
);
const authToken =
  process.env.OPENCLAW_ORCHESTRATOR_TOKEN?.trim() ||
  process.env.VITE_OPENCLAW_TOKEN?.trim() ||
  "molt-claw-local-dev";

ensureActivityPackagesRegistered();

const localBootstrapConfig = resolveLocalPlatformBootstrapConfig({
  activityRunId: process.env.OPENCLAW_ACTIVITY_RUN_ID?.trim(),
  templateId:
    process.env.OPENCLAW_REFERENCE_ACTIVITY_TEMPLATE_ID?.trim() ||
    process.env.OPENCLAW_ACTIVITY_TEMPLATE_ID?.trim(),
});

const bootstrapActivityPackage = getActivityPackage(
  localBootstrapConfig.defaultTemplateId,
);

const tryResolveActivityPackageByTemplateId = (
  templateId?: string | null,
): ActivityPackage | undefined =>
  templateId?.trim() ? tryGetActivityPackage(templateId) : undefined;

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
  "entity.moved",
  "team.assigned",
  "draw.submitted",
  "agent.talked",
  "broadcast.sent",
  "reaction.added",
  "bet.placed",
];

const timerHandles = new Map<string, ReturnType<typeof setTimeout>>();
const clients = new Set<ServerWebSocket<WebSocketSessionData>>();
const sessions = new Map<string, SessionProjection>();

const buildSeedProjection = (now = Date.now()): ProjectionState => ({
  version: 6,
  snapshotId: `snapshot-${now}`,
  activityRun: {
    id: localBootstrapConfig.defaultActivityRunId,
    templateId: bootstrapActivityPackage.id,
    status: "running",
    currentStageId: bootstrapActivityPackage.initialStageId,
    startedAt: now,
  },
  stageTemplates: cloneJsonValue(bootstrapActivityPackage.stageTemplates),
  submissionSchemas: cloneJsonValue(bootstrapActivityPackage.submissionSchemas),
  world: cloneJsonValue(bootstrapActivityPackage.bootstrap.world),
  skills: cloneJsonValue(bootstrapActivityPackage.skillBindings),
  timers: [],
  submissions: [],
  scores: [],
  awards: [],
  lastSequence: 0,
});


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

const readSubmissionVersionRecord = (
  value: unknown,
): SubmissionVersionRecord | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.version !== "number" ||
    typeof value.updatedAt !== "number" ||
    typeof value.actorId !== "string" ||
    !isRole(value.actorRole) ||
    !isRecord(value.data)
  ) {
    return null;
  }

  return {
    version: value.version,
    updatedAt: value.updatedAt,
    actorId: value.actorId,
    actorRole: value.actorRole,
    data: cloneJsonValue(value.data),
  };
};

const readSubmissionVersionRecords = (
  value: unknown,
  fallback: SubmissionVersionRecord[] = [],
): SubmissionVersionRecord[] => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const records = value
    .map(readSubmissionVersionRecord)
    .filter((entry): entry is SubmissionVersionRecord => entry !== null)
    .sort((left, right) => left.version - right.version);

  return records.length > 0 ? records : fallback;
};

const readScoreAnnotations = (
  value: unknown,
  templateId?: string | null,
): ScoreAnnotations => {
  const rawScore = isRecord(value) ? value : {};
  return normalizeActivityScoreAnnotations(
    rawScore,
    templateId ?? projection.activityRun.templateId,
  );
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
      const versions = readSubmissionVersionRecords(
        rawSubmission.versions,
        existingSubmission?.versions ?? [],
      );
      const latestVersionRecord = versions.at(-1);
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
            ? cloneJsonValue(rawSubmission.data)
            : existingSubmission?.data ?? {},
        version:
          typeof rawSubmission.version === "number"
            ? rawSubmission.version
            : latestVersionRecord?.version ?? existingSubmission?.version ?? 0,
        versions,
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
            : latestVersionRecord?.updatedAt ??
              existingSubmission?.updatedAt ??
              event.timestamp,
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
    const annotations = readScoreAnnotations(
      rawScore,
      next.activityRun.templateId,
    );

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
      typeof rawScore.reason === "string"
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
          annotations,
          submittedAt:
            typeof rawScore.submittedAt === "number"
              ? rawScore.submittedAt
              : event.timestamp,
        }),
      };
    }
  }

  if (event.type === "entity.moved") {
    const entityId =
      typeof payload.entityId === "string" ? payload.entityId : event.entityId;
    const toRoomId =
      typeof payload.toRoomId === "string"
        ? payload.toRoomId
        : typeof payload.roomId === "string"
          ? payload.roomId
          : undefined;
    if (entityId && toRoomId !== undefined) {
      const existingEntity = next.world.entities.find((e) => e.id === entityId);
      if (existingEntity) {
        next = {
          ...next,
          world: {
            ...next.world,
            entities: next.world.entities.map((e) =>
              e.id === entityId ? { ...e, roomId: toRoomId } : e,
            ),
          },
        };
      } else {
        next = {
          ...next,
          world: {
            ...next.world,
            entities: [
              ...next.world.entities,
              {
                id: entityId,
                kind: typeof payload.kind === "string" ? payload.kind : "agent",
                roomId: toRoomId,
              },
            ],
          },
        };
      }
    }
  }

  if (event.type === "team.assigned") {
    const rawTeam = isRecord(payload.team) ? payload.team : payload;
    const teamId = typeof rawTeam.id === "string" ? rawTeam.id : null;
    if (teamId) {
      const memberIds = Array.isArray(rawTeam.memberIds)
        ? (rawTeam.memberIds.filter((m): m is string => typeof m === "string"))
        : [];
      const roomId =
        typeof rawTeam.roomId === "string" ? rawTeam.roomId : undefined;
      const existingTeam = next.world.teams.find((t) => t.id === teamId);
      if (existingTeam) {
        next = {
          ...next,
          world: {
            ...next.world,
            teams: next.world.teams.map((t) =>
              t.id === teamId
                ? {
                    ...t,
                    memberIds: memberIds.length > 0 ? memberIds : t.memberIds,
                    roomId: roomId ?? t.roomId,
                  }
                : t,
            ),
          },
        };
      } else {
        next = {
          ...next,
          world: {
            ...next.world,
            teams: [
              ...next.world.teams,
              { id: teamId, memberIds, roomId },
            ],
          },
        };
      }
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

const resolveActivityPackage = (
  templateId?: string | null,
): ActivityPackage | undefined =>
  tryResolveActivityPackageByTemplateId(
    templateId ?? projection.activityRun.templateId,
  );

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

const buildSnapshotEnvelope = (now = Date.now()) =>
  createSnapshotEnvelope({
    projection,
    sessions,
    now,
    computeRemainingMs,
    buildScoreSummary,
  });

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
      agents: buildHealthAgents(sessions),
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

    const autoEvents = applyTransitionRuleAfterEvent("timer.ended");
    if (autoEvents.length > 0) {
      commitEvents(autoEvents);
      syncTimerSchedules();
      for (const autoEvent of autoEvents) {
        broadcastEvent(autoEvent);
      }
    }
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

const findTransitionRulesForStage = (
  stageId: string | null,
): import("../src/openclaw/platform/contracts").TransitionRule[] => {
  if (!stageId) return [];
  const stage = commandHelpers.findStage(stageId);
  return stage?.transitionRules ?? [];
};

const readRuleStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const normalized = entry.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return [...deduped];
};

const listStageSubmissions = ({
  stageId,
  schemaIds,
}: {
  stageId: string;
  schemaIds: string[];
}): SubmissionProjection[] => {
  const schemaIdSet = new Set(schemaIds);
  return projection.submissions.filter(
    (submission) =>
      submission.stageId === stageId &&
      (schemaIdSet.size === 0 || schemaIdSet.has(submission.schemaId)),
  );
};

const allRequiredSubmissionsLocked = (config: Record<string, unknown>): boolean => {
  const currentStageId = projection.activityRun.currentStageId;
  if (!currentStageId) return false;
  const stage = commandHelpers.findStage(currentStageId);
  if (!stage) return false;
  const schemaIds = stage.submissionSchemaIds ?? [];
  if (schemaIds.length === 0) return false;
  const stageSubmissions = listStageSubmissions({
    stageId: currentStageId,
    schemaIds,
  });
  if (stageSubmissions.length === 0) {
    return false;
  }

  if (!stageSubmissions.every((submission) => submission.locked)) {
    return false;
  }

  const requiredTeamIds = readRuleStringList(config.requiredTeamIds);
  if (requiredTeamIds.length === 0) {
    return true;
  }

  return requiredTeamIds.every((teamId) =>
    stageSubmissions.some((submission) => submission.teamId === teamId),
  );
};

const allScoresCompleted = (config: Record<string, unknown>): boolean => {
  const expectedJudgeCount =
    typeof config.expectedJudgeCount === "number"
      ? config.expectedJudgeCount
      : 0;
  if (expectedJudgeCount <= 0) return false;
  const currentStageId = projection.activityRun.currentStageId;
  if (!currentStageId) return false;

  const submissionSchemaIds = readRuleStringList(config.submissionSchemaIds);
  const requiredTeamIds = readRuleStringList(config.requiredTeamIds);
  const scoreableLockedSubmissions = projection.submissions.filter((submission) => {
    if (!submission.locked || !commandHelpers.isSubmissionReadyForScoring(submission)) {
      return false;
    }

    if (
      submissionSchemaIds.length > 0 &&
      !submissionSchemaIds.includes(submission.schemaId)
    ) {
      return false;
    }

    if (
      requiredTeamIds.length > 0 &&
      (!submission.teamId || !requiredTeamIds.includes(submission.teamId))
    ) {
      return false;
    }

    return true;
  });
  if (scoreableLockedSubmissions.length === 0) {
    return false;
  }

  const judgesBySubmissionId = new Map<string, Set<string>>();
  for (const score of projection.scores) {
    if (score.stageId !== currentStageId || !score.submissionId) {
      continue;
    }

    const judges = judgesBySubmissionId.get(score.submissionId) ?? new Set<string>();
    judges.add(score.judgeId);
    judgesBySubmissionId.set(score.submissionId, judges);
  }

  return scoreableLockedSubmissions.every(
    (submission) =>
      (judgesBySubmissionId.get(submission.id)?.size ?? 0) >= expectedJudgeCount,
  );
};

const evaluateTransitionRules = (
  triggerEventType: string,
): EventEnvelope | null => {
  const currentStageId = projection.activityRun.currentStageId;
  const rules = findTransitionRulesForStage(currentStageId);
  if (rules.length === 0) return null;

  for (const rule of rules) {
    let shouldTransition = false;

    if (
      rule.type === "timer_expired" &&
      triggerEventType === "timer.ended"
    ) {
      shouldTransition = true;
    }

    if (
      rule.type === "all_required_submissions_locked" &&
      triggerEventType === "submission.locked"
    ) {
      shouldTransition = allRequiredSubmissionsLocked(rule.config);
    }

    if (
      rule.type === "scores_completed" &&
      triggerEventType === "judge.score_submitted"
    ) {
      shouldTransition = allScoresCompleted(rule.config);
    }

    if (
      shouldTransition &&
      rule.targetStageId &&
      commandHelpers.findStage(rule.targetStageId)
    ) {
      const now = Date.now();
      const stageChangedEvent = makeEvent(
        "stage.changed",
        {
          activityRunId: projection.activityRun.id,
          fromStageId: currentStageId,
          toStageId: rule.targetStageId,
          stageId: rule.targetStageId,
          changedBy: "transition-rule-evaluator",
          transitionRuleId: rule.id,
          transitionRuleType: rule.type,
        },
        now,
      );
      return stageChangedEvent;
    }
  }

  return null;
};

const applyTransitionRuleAfterEvent = (
  triggerEventType: string,
): EventEnvelope[] => {
  const autoTransitionEvent = evaluateTransitionRules(triggerEventType);
  if (!autoTransitionEvent) return [];

  const pauseEvents: EventEnvelope[] = [];
  const activeTimers = projection.timers.filter((t) => t.state === "running");
  for (const timer of activeTimers) {
    const pauseEvent = makeEvent(
      "timer.paused",
      {
        stageId: timer.stageId,
        reason: "auto_stage_transition",
        timer: {
          ...timer,
          remainingMs: computeRemainingMs(timer, Date.now()),
          state: "paused",
          pausedAt: Date.now(),
        },
      },
      Date.now(),
    );
    pauseEvents.push(pauseEvent);
  }

  return [...pauseEvents, autoTransitionEvent];
};

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
    confirmation: extra.confirmation,
  });

const commandHelpers = createCommandHelpers({
  getProjection: () => projection,
  resolveActivityPackage,
  createCommandError,
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

const requireParticipantRole = (
  command: CommandEnvelope,
  handledAt: number,
): void => {
  if (
    command.actorRole === "agent" ||
    command.actorRole === "host" ||
    command.actorRole === "judge" ||
    command.actorRole === "viewer" ||
    command.actorRole === "admin"
  ) {
    return;
  }

  throw createCommandError(
    command,
    handledAt,
    "FORBIDDEN",
    `Command ${command.type} requires participant role.`,
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

const resolveRequestedActivityRunId = (
  activityRunId: string | undefined,
): string =>
  resolveRequestedActivityRunIdFromQuery({
    activityRunId,
    currentActivityRunId: projection.activityRun.id,
  });

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
}): EventQueryResult =>
  buildEventQuery({
    projection,
    readEventLog,
    activityRunId,
    afterSequence,
    fromSequence,
    toSequence,
    limit,
  });

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
}): ScoreQueryResult =>
  buildScoreQuery({
    projection,
    readEventLog,
    buildScoreSummary,
    activityRunId,
    afterSequence,
    fromSequence,
    toSequence,
    limit,
  });

const queryAudit = ({
  activityRunId,
  limit,
}: {
  activityRunId?: string;
  limit: number;
}): AuditQueryResult =>
  buildAuditQuery({
    projection,
    readAuditLog,
    activityRunId,
    limit,
  });

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
  ...createAuditRecord({
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
    currentActivityRunId: projection.activityRun.id,
  }),
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
  confirmation?: CommandConfirmationStatus,
): CommandReceipt => ({
  ...createAcceptedReceipt({
    command,
    handledAt,
    events,
    note,
    confirmation,
    snapshotId: projection.snapshotId,
    lastSequence: projection.lastSequence,
    currentActivityRunId: projection.activityRun.id,
  }),
});

const buildReplayReceipt = (
  storedReceipt: CommandReceipt,
  requestCommand: CommandEnvelope,
  handledAt: number,
): CommandReceipt => ({
  ...createReplayReceipt({
    storedReceipt,
    requestCommand,
    handledAt,
  }),
});

const buildReplayError = (
  storedError: StableErrorBody,
  requestCommand: CommandEnvelope,
  handledAt: number,
): OrchestratorError =>
  createReplayError({
    storedError,
    requestCommand,
    handledAt,
  });

const createCommandHandlerContext = (
  command: CommandEnvelope,
): CommandHandlerContext => {
  const queueEvent = createEventBuilder({
    commandId: command.id,
    idempotencyKey: command.idempotencyKey,
    actorId: command.actorId,
    actorRole: command.actorRole,
  });

  return {
    getProjection: () => projection,
    queueEvent,
    commitEvents,
    findStage: commandHelpers.findStage,
    computeRemainingMs,
    createCommandError,
    requireDangerousCommandConfirmation:
      commandHelpers.requireDangerousCommandConfirmation,
    requireStageActionAllowed: commandHelpers.requireStageActionAllowed,
    requireSubmissionActionWindow: commandHelpers.requireSubmissionActionWindow,
    validateSubmissionDataForCommand:
      commandHelpers.validateSubmissionDataForCommand,
    buildSubmissionVersionRecord:
      commandHelpers.buildSubmissionVersionRecord,
    buildSubmissionProjection: commandHelpers.buildSubmissionProjection,
    buildScoreProjection: commandHelpers.buildScoreProjection,
  };
};

const freshCommandExecutionContext: FreshCommandExecutionContext = {
  resolveRequestedActivityRunId,
  requireHostRole,
  requireParticipantRole,
  requireScoreRole,
  requireSubmissionRole: commandHelpers.requireSubmissionRole,
  createCommandHandlerContext,
  commitEvents,
  syncTimerSchedules,
  broadcastEvent,
  applyTransitionRuleAfterEvent,
  broadcastHealth,
  buildAcceptedReceipt,
  createCommandError,
};

const executeFreshCommand = (
  command: CommandEnvelope,
  handledAt: number,
): CommandReceipt =>
  executeFreshCommandByHandlers(
    command,
    handledAt,
    freshCommandExecutionContext,
  );

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
            stageTemplates: projection.stageTemplates,
            submissionSchemas: projection.submissionSchemas,
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
          stageTemplates: projection.stageTemplates,
          submissionSchemas: projection.submissionSchemas,
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
