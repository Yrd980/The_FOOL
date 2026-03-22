import { describe, expect, test } from "bun:test";
import type { CommandEnvelope } from "../src/openclaw/platform/contracts";
import {
  createAuditedCommandExecutor,
  rebuildCommandJournal,
} from "../scripts/orchestrator/commandShell";
import {
  OrchestratorError,
  type AuditRecord,
  type CommandReceipt,
} from "../scripts/orchestrator/support";

const createCommand = (
  id: string,
  payload: Record<string, unknown>,
  idempotencyKey = "idem-1",
): CommandEnvelope => ({
  id,
  actorId: "host-01",
  actorRole: "host",
  activityRunId: "activity-run-01",
  type: "transition_stage",
  payload,
  idempotencyKey,
  issuedAt: 1_000,
});

const createReceipt = (command: CommandEnvelope): CommandReceipt => ({
  status: "accepted",
  accepted: true,
  replayed: false,
  commandId: command.id,
  requestCommandId: command.id,
  commandType: command.type,
  activityRunId: command.activityRunId,
  issuedAt: command.issuedAt,
  handledAt: 2_000,
  eventIds: ["evt-1"],
  emittedSequences: [1],
  events: [],
  snapshotId: "snapshot-1",
  lastSequence: 1,
});

const createCommandError = (
  command: CommandEnvelope,
  handledAt: number,
  code: string,
  message: string,
  status = 400,
) =>
  new OrchestratorError({
    code,
    message,
    status,
    commandId: command.id,
    sourceCommandId: command.id,
    commandType: command.type,
    activityRunId: command.activityRunId,
    issuedAt: command.issuedAt,
    handledAt,
  });

describe("orchestrator command shell", () => {
  test("replays identical idempotent commands from the command journal", () => {
    const auditLog: AuditRecord[] = [];
    const appendedAudit: AuditRecord[] = [];
    const acceptedCommand = createCommand("cmd-1", { targetStageId: "act-2" });
    const shell = createAuditedCommandExecutor({
      getCurrentActivityRunId: () => "activity-run-01",
      auditLog,
      appendAuditRecord: (record) => {
        appendedAudit.push(record);
      },
      commandJournal: new Map(),
      executeFreshCommand: (command) => createReceipt(command),
      createCommandError,
    });

    const firstReceipt = shell.executeCommand(acceptedCommand);
    const secondReceipt = shell.executeCommand(
      createCommand("cmd-2", { targetStageId: "act-2" }),
    );

    expect(firstReceipt.status).toBe("accepted");
    expect(secondReceipt.status).toBe("replayed");
    expect(secondReceipt.requestCommandId).toBe("cmd-2");
    expect(secondReceipt.replayedFromIdempotency).toBe("idem-1");
    expect(auditLog.map((record) => record.status)).toEqual(["accepted", "replayed"]);
    expect(appendedAudit).toHaveLength(2);
  });

  test("rejects conflicting payload reuse for the same idempotency key", () => {
    const auditLog: AuditRecord[] = [];
    const commandJournal = rebuildCommandJournal([
      {
        auditId: "audit-1",
        commandId: "cmd-1",
        sourceCommandId: "cmd-1",
        commandType: "transition_stage",
        activityRunId: "activity-run-01",
        actorId: "host-01",
        actorRole: "host",
        idempotencyKey: "idem-1",
        issuedAt: 1_000,
        handledAt: 2_000,
        fingerprint:
          '{"actorId":"host-01","actorRole":"host","activityRunId":"activity-run-01","payload":{"targetStageId":"act-2"},"type":"transition_stage"}',
        status: "accepted",
        accepted: true,
        replayed: false,
        emittedEventIds: ["evt-1"],
        emittedSequences: [1],
        receipt: createReceipt(createCommand("cmd-1", { targetStageId: "act-2" })),
      },
    ]);
    const shell = createAuditedCommandExecutor({
      getCurrentActivityRunId: () => "activity-run-01",
      auditLog,
      appendAuditRecord: () => {},
      commandJournal,
      executeFreshCommand: (command) => createReceipt(command),
      createCommandError,
    });

    expect(() =>
      shell.executeCommand(createCommand("cmd-2", { targetStageId: "act-9" })),
    ).toThrow("Idempotency key idem-1 is already bound to a different command payload.");
    expect(auditLog.at(-1)?.status).toBe("conflict");
  });

  test("replays cached rejected errors for repeated idempotency keys", () => {
    const auditLog: AuditRecord[] = [];
    const rejectedError = createCommandError(
      createCommand("cmd-1", { targetStageId: "act-2" }),
      2_000,
      "INVALID_COMMAND",
      "Bad command.",
    );
    const shell = createAuditedCommandExecutor({
      getCurrentActivityRunId: () => "activity-run-01",
      auditLog,
      appendAuditRecord: () => {},
      commandJournal: new Map(),
      executeFreshCommand: () => {
        throw rejectedError;
      },
      createCommandError,
    });

    expect(() =>
      shell.executeCommand(createCommand("cmd-1", { targetStageId: "act-2" })),
    ).toThrow("Bad command.");
    expect(() =>
      shell.executeCommand(createCommand("cmd-2", { targetStageId: "act-2" })),
    ).toThrow("Bad command.");
    expect(auditLog.map((record) => record.status)).toEqual(["rejected", "replayed"]);
  });
});
