import {
  createAuditRecord,
  createReplayError,
  createReplayReceipt,
} from "./audit";
import {
  OrchestratorError,
  buildCommandFingerprint,
  type AuditRecord,
  type CommandJournalEntry,
  type CommandReceipt,
  type StableErrorBody,
} from "./support";
import type { CommandEnvelope } from "../../src/openclaw/platform/contracts";

export const rebuildCommandJournal = (
  records: AuditRecord[],
): Map<string, CommandJournalEntry> => {
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

export const createAuditedCommandExecutor = ({
  getCurrentActivityRunId,
  auditLog,
  appendAuditRecord,
  commandJournal,
  executeFreshCommand,
  createCommandError,
}: {
  getCurrentActivityRunId: () => string;
  auditLog: AuditRecord[];
  appendAuditRecord: (record: AuditRecord) => void;
  commandJournal: Map<string, CommandJournalEntry>;
  executeFreshCommand: (
    command: CommandEnvelope,
    handledAt: number,
  ) => CommandReceipt;
  createCommandError: (
    command: CommandEnvelope,
    handledAt: number,
    code: string,
    message: string,
    status?: number,
    extra?: Partial<StableErrorBody>,
  ) => OrchestratorError;
}) => {
  const buildAuditEntry = ({
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
    status: AuditRecord["status"];
    accepted: boolean;
    replayed: boolean;
    replayedFromIdempotency?: string;
    sourceCommandId?: string;
    receipt?: CommandReceipt;
    error?: StableErrorBody;
  }): AuditRecord =>
    createAuditRecord({
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
      currentActivityRunId: getCurrentActivityRunId(),
    });

  const recordAudit = (record: AuditRecord): void => {
    auditLog.push(record);
    appendAuditRecord(record);
  };

  const replayStoredError = (
    storedError: StableErrorBody,
    requestCommand: CommandEnvelope,
    handledAt: number,
  ): OrchestratorError =>
    createReplayError({
      storedError,
      requestCommand,
      handledAt,
    });

  const replayStoredReceipt = (
    storedReceipt: CommandReceipt,
    requestCommand: CommandEnvelope,
    handledAt: number,
  ): CommandReceipt =>
    createReplayReceipt({
      storedReceipt,
      requestCommand,
      handledAt,
    });

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
        buildAuditEntry({
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
        const receipt = replayStoredReceipt(
          journalEntry.receipt,
          command,
          handledAt,
        );
        recordAudit(
          buildAuditEntry({
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
        const replayedError = replayStoredError(
          journalEntry.error,
          command,
          handledAt,
        );
        recordAudit(
          buildAuditEntry({
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
        buildAuditEntry({
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
        buildAuditEntry({
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

  return {
    executeCommand,
  };
};
