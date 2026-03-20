import type { CommandEnvelope, SubmissionProjection } from "../../../src/openclaw/platform/contracts";
import type { CommandHandlerContext, CommandHandlerResult } from "./support";

export const handleOpenSubmissionCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  const projection = context.getProjection();
  const payload = command.payload;
  const submissionId =
    typeof payload.submissionId === "string"
      ? payload.submissionId.trim()
      : "";

  if (!submissionId) {
    throw context.createCommandError(
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
    throw context.createCommandError(
      command,
      handledAt,
      "SUBMISSION_ALREADY_OPENED",
      `Submission ${submissionId} is already opened.`,
      409,
    );
  }

  const nextSubmission = context.buildSubmissionProjection(submissionId, handledAt);
  return {
    events: [
      context.queueEvent(
        "submission.opened",
        {
          stageId: nextSubmission.stageId,
          submission: nextSubmission,
        },
        handledAt,
      ),
    ],
  };
};

export const handleSubmitCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  const payload = command.payload;
  const submissionId =
    typeof payload.submissionId === "string"
      ? payload.submissionId.trim()
      : "";

  if (!submissionId) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      `${command.type} requires payload.submissionId.`,
    );
  }

  const events = [];
  let existingSubmission = context
    .getProjection()
    .submissions.find((submission) => submission.id === submissionId);

  if (!existingSubmission && command.type === "submit") {
    const projection = context.getProjection();
    const currentStageId = projection.activityRun.currentStageId;
    const stage = currentStageId ? context.findStage(currentStageId) : undefined;
    if (stage && stage.allowedActions.includes("submit")) {
      const autoOpened = context.buildSubmissionProjection(submissionId, handledAt, {
        requiredAction: "submit",
      });
      const openEvent = context.queueEvent(
        "submission.opened",
        {
          stageId: autoOpened.stageId,
          submission: autoOpened,
          autoOpened: true,
        },
        handledAt,
      );
      events.push(openEvent);
      context.commitEvents([openEvent]);
      existingSubmission = context
        .getProjection()
        .submissions.find((submission) => submission.id === submissionId);
    }
  }

  if (!existingSubmission) {
    throw context.createCommandError(
      command,
      handledAt,
      "SUBMISSION_NOT_OPENED",
      `Submission ${submissionId} is not opened.`,
      409,
    );
  }

  context.requireSubmissionActionWindow({
    command,
    handledAt,
    submission: existingSubmission,
    action: command.type,
  });

  if (existingSubmission.locked) {
    throw context.createCommandError(
      command,
      handledAt,
      "SUBMISSION_LOCKED",
      `Submission ${submissionId} is locked and cannot be updated.`,
      409,
    );
  }

  if (command.type === "submit" && existingSubmission.version > 0) {
    throw context.createCommandError(
      command,
      handledAt,
      "SUBMISSION_ALREADY_SUBMITTED",
      `Submission ${submissionId} already has a structured payload. Use update_submission instead.`,
      409,
    );
  }

  if (
    command.type === "update_submission" &&
    existingSubmission.version === 0
  ) {
    throw context.createCommandError(
      command,
      handledAt,
      "SUBMISSION_NOT_SUBMITTED",
      `Submission ${submissionId} does not have an initial payload yet. Use submit first.`,
      409,
    );
  }

  const normalizedData = context.validateSubmissionDataForCommand(
    command,
    handledAt,
    existingSubmission.schemaId,
    payload.data,
  );
  const version = existingSubmission.version + 1;
  const versionRecord = context.buildSubmissionVersionRecord({
    version,
    updatedAt: handledAt,
    actorId: command.actorId,
    actorRole: command.actorRole,
    data: normalizedData,
  });
  const updatedSubmission: SubmissionProjection = {
    ...existingSubmission,
    data: normalizedData,
    version,
    versions: [...existingSubmission.versions, versionRecord],
    updatedAt: handledAt,
  };

  events.push(
    context.queueEvent(
      "submission.updated",
      {
        stageId: updatedSubmission.stageId,
        changeType: command.type,
        versionRecord,
        submission: updatedSubmission,
      },
      handledAt,
    ),
  );

  return { events };
};

export const handleLockSubmissionCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  const projection = context.getProjection();
  const payload = command.payload;
  const submissionId =
    typeof payload.submissionId === "string"
      ? payload.submissionId.trim()
      : "";

  if (!submissionId) {
    throw context.createCommandError(
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
    throw context.createCommandError(
      command,
      handledAt,
      "SUBMISSION_NOT_OPENED",
      `Submission ${submissionId} is not opened.`,
      409,
    );
  }

  if (existingSubmission.locked) {
    throw context.createCommandError(
      command,
      handledAt,
      "SUBMISSION_ALREADY_LOCKED",
      `Submission ${submissionId} is already locked.`,
      409,
    );
  }

  context.requireSubmissionActionWindow({
    command,
    handledAt,
    submission: existingSubmission,
    action: "lock_submission",
  });

  const confirmation = context.requireDangerousCommandConfirmation(
    command,
    handledAt,
  );

  return {
    confirmation,
    events: [
      context.queueEvent(
        "submission.locked",
        {
          stageId: existingSubmission.stageId,
          submission: {
            ...existingSubmission,
            locked: true,
            lockedAt: handledAt,
          },
        },
        handledAt,
      ),
    ],
  };
};
