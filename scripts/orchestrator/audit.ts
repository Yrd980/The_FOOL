import { buildCommandConfirmation } from "../../src/openclaw/control";
import type {
  CommandConfirmationStatus,
  CommandEnvelope,
  EventEnvelope,
} from "../../src/openclaw/platform/contracts";
import {
  OrchestratorError,
  isRecord,
  type AuditRecord,
  type AuditStatus,
  type CommandReceipt,
  type StableErrorBody,
} from "./support";

export const parseCommandEnvelope = (value: unknown): CommandEnvelope | null => {
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

  const confirmation =
    value.confirmation === undefined
      ? undefined
      : (() => {
          if (!isRecord(value.confirmation)) {
            return null;
          }

          if (
            typeof value.confirmation.challenge !== "string" ||
            typeof value.confirmation.confirmedAt !== "number"
          ) {
            return null;
          }

          try {
            return buildCommandConfirmation(
              value.confirmation.challenge,
              value.confirmation.confirmedAt,
            );
          } catch {
            return null;
          }
        })();

  if (value.confirmation !== undefined && confirmation === null) {
    return null;
  }

  return {
    ...value,
    ...(confirmation ? { confirmation } : {}),
  } as CommandEnvelope;
};

export const createAuditRecord = ({
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
  currentActivityRunId,
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
  currentActivityRunId: string;
}): AuditRecord => ({
  auditId: `audit-${Date.now()}-${crypto.randomUUID()}`,
  commandId: command.id,
  sourceCommandId: sourceCommandId ?? command.id,
  commandType: command.type,
  activityRunId: command.activityRunId ?? currentActivityRunId,
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
          confirmation: error.confirmation,
        }
      : undefined,
  emittedEventIds: receipt?.eventIds ?? [],
  emittedSequences: receipt?.emittedSequences ?? [],
  receipt,
});

export const createAcceptedReceipt = ({
  command,
  handledAt,
  events,
  note,
  confirmation,
  snapshotId,
  lastSequence,
  currentActivityRunId,
}: {
  command: CommandEnvelope;
  handledAt: number;
  events: EventEnvelope[];
  note?: string;
  confirmation?: CommandConfirmationStatus;
  snapshotId: string;
  lastSequence: number;
  currentActivityRunId: string;
}): CommandReceipt => ({
  status: "accepted",
  accepted: true,
  replayed: false,
  commandId: command.id,
  requestCommandId: command.id,
  commandType: command.type,
  activityRunId: command.activityRunId ?? currentActivityRunId,
  issuedAt: command.issuedAt,
  handledAt,
  eventIds: events.map((event) => event.id),
  emittedSequences: events.map((event) => event.sequence),
  events,
  snapshotId,
  lastSequence,
  note,
  confirmation,
});

export const createReplayReceipt = ({
  storedReceipt,
  requestCommand,
  handledAt,
}: {
  storedReceipt: CommandReceipt;
  requestCommand: CommandEnvelope;
  handledAt: number;
}): CommandReceipt => ({
  ...storedReceipt,
  status: "replayed",
  replayed: true,
  replayedFromIdempotency: requestCommand.idempotencyKey,
  requestCommandId: requestCommand.id,
  handledAt,
});

export const createReplayError = ({
  storedError,
  requestCommand,
  handledAt,
}: {
  storedError: StableErrorBody;
  requestCommand: CommandEnvelope;
  handledAt: number;
}): OrchestratorError =>
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
