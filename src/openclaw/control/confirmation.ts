import type { CommandConfirmation, CommandEnvelope, VoteTargetType } from "../platform/contracts";
import type { DangerousCommandConfirmationRequirement } from "./types";
import { readNonEmptyPayloadString } from "./support";

export const normalizeCommandConfirmationChallenge = (
  value: string,
): string => value.trim().replace(/\s+/g, " ");

export const buildCommandConfirmation = (
  challenge: string,
  confirmedAt = Date.now(),
): CommandConfirmation => {
  const normalizedChallenge = normalizeCommandConfirmationChallenge(challenge);
  if (!normalizedChallenge) {
    throw new Error("Confirmation challenge is required.");
  }

  const normalizedConfirmedAt = Math.round(confirmedAt);
  if (!Number.isFinite(normalizedConfirmedAt) || normalizedConfirmedAt <= 0) {
    throw new Error("Confirmation timestamp must be a positive number.");
  }

  return {
    challenge: normalizedChallenge,
    confirmedAt: normalizedConfirmedAt,
  };
};

export const buildTransitionStageConfirmationChallenge = (
  targetStageId: string,
): string => {
  const normalizedStageId = targetStageId.trim();
  if (!normalizedStageId) {
    throw new Error("Target stage id is required.");
  }

  return normalizeCommandConfirmationChallenge(`PROMOTE ${normalizedStageId}`);
};

export const buildLockSubmissionConfirmationChallenge = (
  submissionId: string,
): string => {
  const normalizedSubmissionId = submissionId.trim();
  if (!normalizedSubmissionId) {
    throw new Error("Submission id is required.");
  }

  return normalizeCommandConfirmationChallenge(`LOCK ${normalizedSubmissionId}`);
};

export const buildGrantAwardConfirmationChallenge = ({
  awardId,
  entityId,
}: {
  awardId: string;
  entityId: string;
}): string => {
  const normalizedAwardId = awardId.trim();
  const normalizedEntityId = entityId.trim();
  if (!normalizedAwardId || !normalizedEntityId) {
    throw new Error("Award id and entity id are required.");
  }

  return normalizeCommandConfirmationChallenge(
    `AWARD ${normalizedAwardId} ${normalizedEntityId}`,
  );
};

export const buildMoveEntityConfirmationChallenge = ({
  entityId,
  toRoomId,
}: {
  entityId: string;
  toRoomId: string;
}): string => {
  const normalizedEntityId = entityId.trim();
  const normalizedRoomId = toRoomId.trim();
  if (!normalizedEntityId || !normalizedRoomId) {
    throw new Error("Entity id and destination room id are required.");
  }

  return normalizeCommandConfirmationChallenge(
    `MOVE ${normalizedEntityId} ${normalizedRoomId}`,
  );
};

export const buildAssignTeamConfirmationChallenge = (
  teamId: string,
): string => {
  const normalizedTeamId = teamId.trim();
  if (!normalizedTeamId) {
    throw new Error("Team id is required.");
  }

  return normalizeCommandConfirmationChallenge(`ASSIGN ${normalizedTeamId}`);
};

export const buildFinishActivityConfirmationChallenge = ({
  activityRunId,
  settlementMode = "winner",
  winningTargetType,
  winningTargetId,
}: {
  activityRunId: string;
  settlementMode?: "winner" | "push";
  winningTargetType?: VoteTargetType;
  winningTargetId?: string;
}): string => {
  const normalizedActivityRunId = activityRunId.trim();
  if (!normalizedActivityRunId) {
    throw new Error("Activity run id is required.");
  }

  if (settlementMode === "push") {
    return normalizeCommandConfirmationChallenge(
      `FINISH ${normalizedActivityRunId} push`,
    );
  }

  const normalizedTargetType = winningTargetType?.trim();
  const normalizedTargetId = winningTargetId?.trim();
  if (
    (normalizedTargetType !== "team" &&
      normalizedTargetType !== "entity" &&
      normalizedTargetType !== "submission") ||
    !normalizedTargetId
  ) {
    throw new Error(
      "Winner target type and target id are required for finish confirmation.",
    );
  }

  return normalizeCommandConfirmationChallenge(
    `FINISH ${normalizedActivityRunId} ${normalizedTargetType}:${normalizedTargetId}`,
  );
};

export const resolveDangerousCommandConfirmationRequirement = (
  command: Pick<CommandEnvelope, "type" | "payload" | "activityRunId">,
): DangerousCommandConfirmationRequirement | null => {
  if (command.type === "transition_stage") {
    const targetStageId = readNonEmptyPayloadString(command.payload, "targetStageId");
    return targetStageId
      ? {
          commandType: command.type,
          challenge: buildTransitionStageConfirmationChallenge(targetStageId),
          reason: "changing authority currentStageId",
        }
      : null;
  }

  if (command.type === "lock_submission") {
    const submissionId = readNonEmptyPayloadString(command.payload, "submissionId");
    return submissionId
      ? {
          commandType: command.type,
          challenge: buildLockSubmissionConfirmationChallenge(submissionId),
          reason: "locking the authoritative submission payload",
        }
      : null;
  }

  if (command.type === "grant_award") {
    const awardId = readNonEmptyPayloadString(command.payload, "awardId");
    const entityId = readNonEmptyPayloadString(command.payload, "entityId");
    return awardId && entityId
      ? {
          commandType: command.type,
          challenge: buildGrantAwardConfirmationChallenge({ awardId, entityId }),
          reason: "granting an authoritative award",
        }
      : null;
  }

  if (command.type === "move_entity") {
    const entityId = readNonEmptyPayloadString(command.payload, "entityId");
    const toRoomId = readNonEmptyPayloadString(command.payload, "toRoomId");
    return entityId && toRoomId
      ? {
          commandType: command.type,
          challenge: buildMoveEntityConfirmationChallenge({ entityId, toRoomId }),
          reason: "rewriting authority world entity placement",
        }
      : null;
  }

  if (command.type === "assign_team") {
    const teamId = readNonEmptyPayloadString(command.payload, "teamId");
    return teamId
      ? {
          commandType: command.type,
          challenge: buildAssignTeamConfirmationChallenge(teamId),
          reason: "rewriting authority world team membership/room state",
        }
      : null;
  }

  if (command.type === "finish_activity") {
    const activityRunId =
      command.activityRunId?.trim() ||
      readNonEmptyPayloadString(command.payload, "activityRunId") ||
      readNonEmptyPayloadString(command.payload, "runId") ||
      "activity-run";
    const settlementMode =
      readNonEmptyPayloadString(command.payload, "settlementMode") === "push"
        ? "push"
        : "winner";
    const winningTargetType = readNonEmptyPayloadString(
      command.payload,
      "winningTargetType",
    );
    const winningTargetId = readNonEmptyPayloadString(
      command.payload,
      "winningTargetId",
    );
    return {
      commandType: command.type,
      challenge: buildFinishActivityConfirmationChallenge({
        activityRunId,
        settlementMode,
        winningTargetType:
          winningTargetType === "team" ||
          winningTargetType === "entity" ||
          winningTargetType === "submission"
            ? winningTargetType
            : undefined,
        winningTargetId: winningTargetId ?? undefined,
      }),
      reason: "closing the authoritative activity runtime and settling bets",
    };
  }

  return null;
};

export const satisfiesDangerousCommandConfirmation = ({
  command,
  requirement,
}: {
  command: Pick<CommandEnvelope, "confirmation">;
  requirement: DangerousCommandConfirmationRequirement;
}): boolean => {
  const confirmation = command.confirmation;
  if (!confirmation || !Number.isFinite(confirmation.confirmedAt)) {
    return false;
  }

  return (
    normalizeCommandConfirmationChallenge(confirmation.challenge) ===
    requirement.challenge
  );
};
