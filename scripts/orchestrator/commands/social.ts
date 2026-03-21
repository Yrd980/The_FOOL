import type {
  CommandEnvelope,
  WorldEntityProjection,
} from "../../../src/openclaw/platform/contracts";
import type { CommandHandlerContext, CommandHandlerResult } from "./support";

const isKnownRoom = (
  context: CommandHandlerContext,
  roomId: string | undefined,
): boolean =>
  typeof roomId === "string" &&
  context.getProjection().world.rooms.some((room) => room.id === roomId);

const requireKnownRoom = ({
  context,
  command,
  handledAt,
  roomId,
}: {
  context: CommandHandlerContext;
  command: CommandEnvelope;
  handledAt: number;
  roomId?: string;
}): void => {
  if (!roomId) {
    return;
  }

  if (!isKnownRoom(context, roomId)) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_ROOM",
      `Unknown room ${roomId}.`,
      404,
    );
  }
};

const findEntity = (
  entities: WorldEntityProjection[],
  entityId: string | undefined,
): WorldEntityProjection | undefined =>
  entityId ? entities.find((entity) => entity.id === entityId) : undefined;

const resolveActorRoomId = (
  context: CommandHandlerContext,
  actorId: string,
): string | undefined =>
  context
    .getProjection()
    .world.entities.find((entity) => entity.id === actorId)?.roomId;

export const handleTalkCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  context.requireStageActionAllowed({
    command,
    handledAt,
    action: "talk",
  });

  const projection = context.getProjection();
  const payload = command.payload;
  const message =
    typeof payload.message === "string" ? payload.message.trim() : "";
  const targetEntityId =
    typeof payload.targetEntityId === "string"
      ? payload.targetEntityId.trim()
      : undefined;
  const roomId =
    typeof payload.roomId === "string" && payload.roomId.trim().length > 0
      ? payload.roomId.trim()
      : resolveActorRoomId(context, command.actorId);
  const audienceScope =
    payload.audienceScope === "room" ||
    payload.audienceScope === "team" ||
    payload.audienceScope === "global"
      ? payload.audienceScope
      : roomId
        ? "room"
        : "global";

  if (!message) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "talk requires payload.message.",
    );
  }

  requireKnownRoom({ context, command, handledAt, roomId });

  if (targetEntityId && !findEntity(projection.world.entities, targetEntityId)) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_ENTITY",
      `Unknown target entity ${targetEntityId}.`,
      404,
    );
  }

  return {
    events: [
      context.queueEvent(
        "agent.talked",
        {
          stageId: projection.activityRun.currentStageId,
          message,
          roomId,
          audienceScope,
          ...(targetEntityId ? { targetEntityId } : {}),
        },
        handledAt,
      ),
    ],
  };
};

export const handleBroadcastCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  context.requireStageActionAllowed({
    command,
    handledAt,
    action: "broadcast",
  });

  const projection = context.getProjection();
  const payload = command.payload;
  const message =
    typeof payload.message === "string" ? payload.message.trim() : "";
  const roomId =
    typeof payload.roomId === "string" && payload.roomId.trim().length > 0
      ? payload.roomId.trim()
      : undefined;
  const teamId =
    typeof payload.teamId === "string" && payload.teamId.trim().length > 0
      ? payload.teamId.trim()
      : undefined;
  const audienceScope =
    payload.audienceScope === "room" ||
    payload.audienceScope === "team" ||
    payload.audienceScope === "global"
      ? payload.audienceScope
      : teamId
        ? "team"
        : roomId
          ? "room"
          : "global";

  if (!message) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "broadcast requires payload.message.",
    );
  }

  requireKnownRoom({ context, command, handledAt, roomId });

  if (teamId && !projection.world.teams.some((team) => team.id === teamId)) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_TEAM",
      `Unknown team ${teamId}.`,
      404,
    );
  }

  return {
    events: [
      context.queueEvent(
        "broadcast.sent",
        {
          stageId: projection.activityRun.currentStageId,
          message,
          audienceScope,
          ...(roomId ? { roomId } : {}),
          ...(teamId ? { teamId } : {}),
        },
        handledAt,
      ),
    ],
  };
};

export const handleReactionCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  context.requireStageActionAllowed({
    command,
    handledAt,
    action: "reaction",
  });

  const projection = context.getProjection();
  const payload = command.payload;
  const reaction =
    typeof payload.reaction === "string" ? payload.reaction.trim() : "";
  const roomId =
    typeof payload.roomId === "string" && payload.roomId.trim().length > 0
      ? payload.roomId.trim()
      : resolveActorRoomId(context, command.actorId);
  const targetEntityId =
    typeof payload.targetEntityId === "string"
      ? payload.targetEntityId.trim()
      : undefined;
  const targetTeamId =
    typeof payload.targetTeamId === "string"
      ? payload.targetTeamId.trim()
      : undefined;
  const note =
    typeof payload.note === "string" && payload.note.trim().length > 0
      ? payload.note.trim()
      : undefined;

  if (!reaction) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "reaction requires payload.reaction.",
    );
  }

  requireKnownRoom({ context, command, handledAt, roomId });

  if (targetEntityId && !findEntity(projection.world.entities, targetEntityId)) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_ENTITY",
      `Unknown target entity ${targetEntityId}.`,
      404,
    );
  }

  if (targetTeamId && !projection.world.teams.some((team) => team.id === targetTeamId)) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_TEAM",
      `Unknown target team ${targetTeamId}.`,
      404,
    );
  }

  return {
    events: [
      context.queueEvent(
        "reaction.added",
        {
          stageId: projection.activityRun.currentStageId,
          reaction,
          ...(roomId ? { roomId } : {}),
          ...(targetEntityId ? { targetEntityId } : {}),
          ...(targetTeamId ? { targetTeamId } : {}),
          ...(note ? { note } : {}),
        },
        handledAt,
      ),
    ],
  };
};

export const handleBetCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  context.requireStageActionAllowed({
    command,
    handledAt,
    action: "bet",
  });

  const projection = context.getProjection();
  const payload = command.payload;
  const targetId =
    typeof payload.targetId === "string" ? payload.targetId.trim() : "";
  const targetType = payload.targetType;
  const roomId =
    typeof payload.roomId === "string" && payload.roomId.trim().length > 0
      ? payload.roomId.trim()
      : resolveActorRoomId(context, command.actorId);
  const amount =
    typeof payload.amount === "number" && Number.isFinite(payload.amount)
      ? Math.max(1, Math.round(payload.amount))
      : undefined;
  const odds =
    typeof payload.odds === "number" && Number.isFinite(payload.odds) && payload.odds > 0
      ? Number(payload.odds.toFixed(2))
      : undefined;
  const stance =
    typeof payload.stance === "string" && payload.stance.trim().length > 0
      ? payload.stance.trim()
      : undefined;
  const note =
    typeof payload.note === "string" && payload.note.trim().length > 0
      ? payload.note.trim()
      : undefined;

  if (!targetId) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "bet requires payload.targetId.",
    );
  }

  if (
    targetType !== "team" &&
    targetType !== "entity" &&
    targetType !== "submission"
  ) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "bet requires payload.targetType as team, entity, or submission.",
    );
  }

  requireKnownRoom({ context, command, handledAt, roomId });

  if (
    targetType === "team" &&
    !projection.world.teams.some((team) => team.id === targetId)
  ) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_TEAM",
      `Unknown team ${targetId}.`,
      404,
    );
  }

  if (
    targetType === "entity" &&
    !findEntity(projection.world.entities, targetId)
  ) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_ENTITY",
      `Unknown entity ${targetId}.`,
      404,
    );
  }

  if (
    targetType === "submission" &&
    !projection.submissions.some((submission) => submission.id === targetId)
  ) {
    throw context.createCommandError(
      command,
      handledAt,
      "SUBMISSION_NOT_FOUND",
      `Submission ${targetId} does not exist.`,
      404,
    );
  }

  return {
    events: [
      context.queueEvent(
        "bet.placed",
        {
          stageId: projection.activityRun.currentStageId,
          targetType,
          targetId,
          ...(roomId ? { roomId } : {}),
          ...(amount !== undefined ? { amount } : {}),
          ...(odds !== undefined ? { odds } : {}),
          ...(stance ? { stance } : {}),
          ...(note ? { note } : {}),
        },
        handledAt,
      ),
    ],
  };
};
