import { normalizeActivityScoreAnnotations } from "../../../src/openclaw/activityRuntime";
import {
  resolveDangerousCommandConfirmationRequirement,
  satisfiesDangerousCommandConfirmation,
} from "../../../src/openclaw/control";
import type { ActivityPackage } from "../../../src/openclaw/platform/activityRegistry";
import type {
  CommandConfirmationStatus,
  CommandEnvelope,
  ScoreAnnotations,
  ScoreProjection,
  StageTemplate,
  SubmissionData,
  SubmissionProjection,
  SubmissionVersionRecord,
} from "../../../src/openclaw/platform/contracts";
import {
  OrchestratorError,
  cloneJsonValue,
  isRecord,
  type ProjectionState,
  type Role,
  type StableErrorBody,
  type SubmissionCommandType,
} from "../support";

interface CommandHelperContext {
  getProjection: () => ProjectionState;
  resolveActivityPackage: (
    templateId?: string | null,
  ) => ActivityPackage | undefined;
  createCommandError: (
    command: CommandEnvelope,
    handledAt: number,
    code: string,
    message: string,
    status?: number,
    extra?: Partial<StableErrorBody>,
  ) => OrchestratorError;
}

const readScoreAnnotations = (
  value: unknown,
  activityPackageId: string,
): ScoreAnnotations => {
  const rawScore = isRecord(value) ? value : {};
  return normalizeActivityScoreAnnotations(rawScore, activityPackageId);
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

export const createCommandHelpers = ({
  getProjection,
  resolveActivityPackage,
  createCommandError,
}: CommandHelperContext) => {
  const findStage = (stageId: string): StageTemplate | undefined =>
    getProjection().stageTemplates.find((stage) => stage.id === stageId);

  const findTeam = (teamId: string) =>
    getProjection().world.teams.find((team) => team.id === teamId);

  const inferSubmissionSchemaId = (stageId: string | null): string | null => {
    const stage = stageId ? findStage(stageId) : undefined;
    return stage?.submissionSchemaIds?.[0] ?? null;
  };

  const inferSubmissionTeamId = (
    submissionId: string,
  ): string | undefined => {
    return resolveActivityPackage()?.inferSubmissionTeamId?.(submissionId);
  };

  const buildDangerousCommandConfirmationStatus = ({
    command,
  }: {
    command: Pick<
      CommandEnvelope,
      "type" | "payload" | "confirmation" | "activityRunId"
    >;
  }): CommandConfirmationStatus | null => {
    const requirement = resolveDangerousCommandConfirmationRequirement(command);
    if (!requirement) {
      return null;
    }

    return {
      required: true,
      challenge: requirement.challenge,
      confirmedAt: command.confirmation?.confirmedAt,
      providedChallenge: command.confirmation?.challenge,
    };
  };

  const requireSubmissionRole = (
    command: CommandEnvelope,
    handledAt: number,
  ): void => {
    if (
      command.actorRole === "agent" ||
      command.actorRole === "host" ||
      command.actorRole === "admin"
    ) {
      return;
    }

    throw createCommandError(
      command,
      handledAt,
      "FORBIDDEN",
      `Command ${command.type} requires agent/host/admin role.`,
      403,
    );
  };

  const requireDangerousCommandConfirmation = (
    command: CommandEnvelope,
    handledAt: number,
  ): CommandConfirmationStatus | undefined => {
    const status = buildDangerousCommandConfirmationStatus({ command });
    if (!status) {
      return undefined;
    }

    const requirement = resolveDangerousCommandConfirmationRequirement(command);
    if (
      requirement &&
      satisfiesDangerousCommandConfirmation({
        command,
        requirement,
      })
    ) {
      return status;
    }

    throw createCommandError(
      command,
      handledAt,
      "CONFIRMATION_REQUIRED",
      `Command ${command.type} requires confirmation ${JSON.stringify(status.challenge)} before it can mutate authoritative state.`,
      409,
      {
        confirmation: status,
      },
    );
  };

  const requireStageActionAllowed = ({
    command,
    handledAt,
    action,
  }: {
    command: CommandEnvelope;
    handledAt: number;
    action: string;
  }): void => {
    const projection = getProjection();
    if (projection.activityRun.status === "finished") {
      throw createCommandError(
        command,
        handledAt,
        "ACTIVITY_FINISHED",
        "Activity is already finished.",
        409,
      );
    }

    const currentStageId = projection.activityRun.currentStageId;
    if (!currentStageId) {
      throw createCommandError(
        command,
        handledAt,
        "STAGE_ACTION_NOT_ALLOWED",
        `${action} requires an active stage.`,
        409,
      );
    }

    const stage = findStage(currentStageId);
    if (!stage || !stage.allowedActions.includes(action)) {
      throw createCommandError(
        command,
        handledAt,
        "STAGE_ACTION_NOT_ALLOWED",
        `Stage ${currentStageId} does not allow ${action}.`,
        409,
      );
    }
  };

  const findSubmissionSchema = (schemaId: string) =>
    getProjection().submissionSchemas.find((schema) => schema.id === schemaId);

  const validateSubmissionDataByPlatformSchema = (
    schemaId: string,
    rawData: SubmissionData,
  ): SubmissionData => {
    const schema = findSubmissionSchema(schemaId);
    if (!schema) {
      throw new Error(`Unknown submission schema ${schemaId}.`);
    }

    const allowedKeys = new Set(schema.fields.map((field) => field.key));
    const unknownKeys = Object.keys(rawData).filter((key) => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
      throw new Error(
        `payload.data contains unsupported fields: ${unknownKeys.join(", ")}.`,
      );
    }

    const normalizedData: SubmissionData = {};
    for (const field of schema.fields) {
      const fieldValue = rawData[field.key];
      if (fieldValue === undefined || fieldValue === null) {
        if (field.required) {
          throw new Error(`payload.data.${field.key} is required.`);
        }
        continue;
      }

      if (
        field.type === "text" ||
        field.type === "file" ||
        field.type === "link"
      ) {
        if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
          throw new Error(
            `payload.data.${field.key} must be a non-empty string.`,
          );
        }
        normalizedData[field.key] = fieldValue.trim();
        continue;
      }

      normalizedData[field.key] = cloneJsonValue(fieldValue);
    }

    return normalizedData;
  };

  const normalizeSubmissionDataForSchema = (
    schemaId: string,
    rawData: SubmissionData,
  ): SubmissionData => {
    const activityPackage = resolveActivityPackage();
    if (activityPackage) {
      try {
        return activityPackage.normalizeSubmissionData(schemaId, rawData);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const isUnknownSchema =
          message.includes("Unknown submission schema") ||
          message.includes("unknown schema");
        if (!isUnknownSchema) {
          throw error;
        }
      }
    }

    return validateSubmissionDataByPlatformSchema(schemaId, rawData);
  };

  const isSubmissionReadyForScoring = (
    submission: SubmissionProjection,
  ): boolean => {
    if (submission.version < 1 || submission.versions.length === 0) {
      return false;
    }

    try {
      normalizeSubmissionDataForSchema(submission.schemaId, submission.data);
      return true;
    } catch {
      return false;
    }
  };

  const validateSubmissionDataForCommand = (
    command: CommandEnvelope,
    handledAt: number,
    schemaId: string,
    value: unknown,
  ): SubmissionData => {
    if (!isRecord(value)) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        `${command.type} requires payload.data as an object.`,
      );
    }

    try {
      return normalizeSubmissionDataForSchema(schemaId, value);
    } catch (error) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        error instanceof Error ? error.message : "Invalid submission payload.",
      );
    }
  };

  const buildSubmissionVersionRecord = ({
    version,
    updatedAt,
    actorId,
    actorRole,
    data,
  }: {
    version: number;
    updatedAt: number;
    actorId: string;
    actorRole: Role;
    data: SubmissionData;
  }): SubmissionVersionRecord => ({
    version,
    updatedAt,
    actorId,
    actorRole,
    data: cloneJsonValue(data),
  });

  const requireSubmissionActionWindow = ({
    command,
    handledAt,
    submission,
    action,
  }: {
    command: CommandEnvelope;
    handledAt: number;
    submission: SubmissionProjection;
    action: "open_submission" | "lock_submission" | SubmissionCommandType;
  }): void => {
    const projection = getProjection();
    const currentStageId = projection.activityRun.currentStageId;
    if (!currentStageId) {
      throw createCommandError(
        command,
        handledAt,
        "SUBMISSION_STAGE_REQUIRED",
        `${action} requires an active submission stage.`,
        409,
      );
    }

    if (submission.stageId && submission.stageId !== currentStageId) {
      throw createCommandError(
        command,
        handledAt,
        "SUBMISSION_STAGE_CLOSED",
        `${action} is only allowed while ${submission.stageId} is current. Current stage is ${currentStageId}.`,
        409,
      );
    }

    const stage = findStage(currentStageId);
    if (!stage || !stage.allowedActions.includes(action)) {
      throw createCommandError(
        command,
        handledAt,
        "SUBMISSION_ACTION_NOT_ALLOWED",
        `Stage ${currentStageId} does not allow ${action}.`,
        409,
      );
    }
  };

  const assertSubmissionReadyForScoring = (
    command: CommandEnvelope,
    handledAt: number,
    submission: SubmissionProjection,
  ): void => {
    if (submission.version < 1 || submission.versions.length === 0) {
      throw createCommandError(
        command,
        handledAt,
        "SUBMISSION_PAYLOAD_REQUIRED",
        `Submission ${submission.id} must contain a structured payload before scoring.`,
        409,
      );
    }

    try {
      normalizeSubmissionDataForSchema(submission.schemaId, submission.data);
    } catch (error) {
      throw createCommandError(
        command,
        handledAt,
        "SUBMISSION_INVALID_PAYLOAD",
        error instanceof Error
          ? `Submission ${submission.id} has invalid payload: ${error.message}`
          : `Submission ${submission.id} has invalid payload.`,
        409,
      );
    }
  };

  const buildSubmissionProjection = (
    submissionId: string,
    now: number,
    options: { requiredAction?: string } = {},
  ): SubmissionProjection => {
    const projection = getProjection();
    const currentStageId = projection.activityRun.currentStageId;
    const stage = currentStageId ? findStage(currentStageId) : undefined;
    const schemaId = inferSubmissionSchemaId(currentStageId);
    const requiredAction = options.requiredAction ?? "open_submission";
    if (!stage || !schemaId || !stage.allowedActions.includes(requiredAction)) {
      throw new OrchestratorError({
        code: "SUBMISSION_STAGE_REQUIRED",
        message:
          `${requiredAction} requires the current stage to expose a submission schema and allow ${requiredAction}.`,
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
      version: 0,
      versions: [],
      locked: false,
      teamId,
      stageId: currentStageId ?? undefined,
      openedAt: now,
      updatedAt: now,
    };
  };

  const buildScoreProjection = (
    command: CommandEnvelope,
    handledAt: number,
  ): ScoreProjection => {
    const projection = getProjection();
    const currentStageId = projection.activityRun.currentStageId;
    const scoreConfig = resolveActivityPackage()?.scoreConfig;
    const allowedStageIds = scoreConfig?.allowedStageIds ?? [];

    if (
      !currentStageId ||
      (allowedStageIds.length > 0 && !allowedStageIds.includes(currentStageId))
    ) {
      throw createCommandError(
        command,
        handledAt,
        "SCORE_STAGE_REQUIRED",
        allowedStageIds.length > 0
          ? `submit_score is only allowed during ${allowedStageIds.join(", ")}.`
          : "submit_score is not enabled for the current activity.",
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
    let annotations: ScoreAnnotations;
    try {
      annotations = readScoreAnnotations(payload, projection.activityRun.templateId);
    } catch (error) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        error instanceof Error ? error.message : "Invalid score annotations.",
      );
    }

    if (!submissionId && !teamId) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        "submit_score requires payload.submissionId or payload.teamId.",
      );
    }

    if (!Number.isFinite(scoreValue) || scoreValue < 1 || scoreValue > 10) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        "submit_score requires payload.score as an integer between 1 and 10.",
      );
    }

    const requiredAnnotations = scoreConfig?.requiredAnnotations ?? [];
    const missingAnnotations = requiredAnnotations.filter(
      (key) => !annotations[key],
    );

    if (!reason || missingAnnotations.length > 0) {
      throw createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        !reason
          ? "submit_score requires non-empty payload.reason."
          : `submit_score requires annotations: ${missingAnnotations.join(", ")}.`,
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

    assertSubmissionReadyForScoring(command, handledAt, resolvedSubmission);

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
      annotations,
      submittedAt: handledAt,
    };
  };

  return {
    findStage,
    requireSubmissionRole,
    requireDangerousCommandConfirmation,
    requireStageActionAllowed,
    isSubmissionReadyForScoring,
    validateSubmissionDataForCommand,
    buildSubmissionVersionRecord,
    requireSubmissionActionWindow,
    buildSubmissionProjection,
    buildScoreProjection,
  };
};
