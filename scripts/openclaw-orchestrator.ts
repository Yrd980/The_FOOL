#!/usr/bin/env bun

import type { ServerWebSocket } from "bun";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureActivityPackagesRegistered,
} from "../src/openclaw/activities";
import {
  getActivityPackage,
  tryGetActivityPackage,
  type ActivityPackage,
} from "../src/openclaw/platform/activityRegistry";
import type {
  CommandConfirmationStatus,
  CommandEnvelope,
  EventCommandContext,
  EventEnvelope,
} from "../src/openclaw/platform/contracts";
import { resolveLocalPlatformBootstrapConfig } from "../src/openclaw/localPlatformConfig";
import {
  OrchestratorError,
  buildCommandFingerprint,
  cloneJsonValue,
  createOrchestratorStorage,
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
  queryAudit as buildAuditQuery,
  queryEvents as buildEventQuery,
  queryScores as buildScoreQuery,
  resolveRequestedActivityRunId as resolveRequestedActivityRunIdFromQuery,
} from "./orchestrator/query";
import {
  createAcceptedReceipt,
  createAuditRecord,
  createReplayError,
  createReplayReceipt,
} from "./orchestrator/audit";
import {
  buildHealthAgents,
  buildSnapshotEnvelope as createSnapshotEnvelope,
} from "./orchestrator/snapshot";
import {
  buildSeedProjection,
  loadProjection,
} from "./orchestrator/bootstrap";
import {
  applyEventToProjection,
  buildScoreSummary,
  computeRemainingMs,
} from "./orchestrator/projection";
import {
  createAuditedCommandExecutor,
  rebuildCommandJournal,
} from "./orchestrator/commandShell";
import { createOrchestratorServerHandlers } from "./orchestrator/server";
import { createRuntimeLoop } from "./orchestrator/runtimeLoop";
import { parseCommandEnvelope } from "./orchestrator/audit";
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
  "activity.finished",
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
  "vote.cast",
];

const clients = new Set<ServerWebSocket<WebSocketSessionData>>();
const sessions = new Map<string, SessionProjection>();

let projection = loadProjection({
  ensureDataDir,
  parseJsonFile,
  projectionFilePath,
  readEventLog,
  appendEventRecord,
  writeProjection,
  buildSeedProjection: () =>
    buildSeedProjection({
      defaultActivityRunId: localBootstrapConfig.defaultActivityRunId,
      bootstrapActivityPackage,
    }),
});

const resolveActivityPackage = (
  templateId?: string | null,
): ActivityPackage | undefined =>
  tryResolveActivityPackageByTemplateId(
    templateId ?? projection.activityRun.templateId,
  );

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

const { applyTransitionRuleAfterEvent, commitEvents, syncTimerSchedules } =
  createRuntimeLoop({
    getProjection: () => projection,
    setProjection: (nextProjection) => {
      projection = nextProjection;
    },
    appendEventRecord,
    writeProjection,
    applyEventToProjection,
    buildEvent: makeEvent,
    computeRemainingMs,
    findStage: commandHelpers.findStage,
    isSubmissionReadyForScoring: commandHelpers.isSubmissionReadyForScoring,
    broadcastEvent,
  });

syncTimerSchedules();

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
const { executeCommand } = createAuditedCommandExecutor({
  getCurrentActivityRunId: () => projection.activityRun.id,
  auditLog,
  appendAuditRecord,
  commandJournal,
  executeFreshCommand,
  createCommandError,
});

const { fetch, websocket } = createOrchestratorServerHandlers({
  authToken,
  dataDir,
  supportedRpcMethods,
  supportedEvents,
  clients,
  sessions,
  getProjection: () => projection,
  resolveRequestedActivityRunId,
  buildSnapshotEnvelope,
  queryEvents,
  queryAudit,
  queryScores,
  executeCommand,
  parseCommandEnvelope,
  broadcastHealth,
});

const server = Bun.serve<WebSocketSessionData>({
  hostname: host,
  port: Number.isFinite(port) ? port : 18791,
  fetch,
  websocket,
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
