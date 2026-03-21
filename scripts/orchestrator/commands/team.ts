import type {
  CommandEnvelope,
  EventEnvelope,
} from "../../../src/openclaw/platform/contracts";
import type { CommandHandlerContext, CommandHandlerResult } from "./support";

export const handleAssignTeamCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  const projection = context.getProjection();
  const payload = command.payload;
  const teamId =
    typeof payload.teamId === "string" ? payload.teamId.trim() : "";
  const memberIds = Array.isArray(payload.memberIds)
    ? payload.memberIds.filter(
        (memberId): memberId is string =>
          typeof memberId === "string" && memberId.trim().length > 0,
      )
    : [];
  const roomId =
    typeof payload.roomId === "string" && payload.roomId.trim().length > 0
      ? payload.roomId.trim()
      : undefined;

  if (!teamId) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "assign_team requires payload.teamId.",
    );
  }

  const existingTeam = projection.world.teams.find((team) => team.id === teamId);
  const resolvedMemberIds =
    memberIds.length > 0
      ? [...new Set(memberIds)]
      : existingTeam?.memberIds ?? [];

  if (
    roomId &&
    !projection.world.rooms.some((room) => room.id === roomId)
  ) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_ROOM",
      `Unknown room ${roomId}.`,
      404,
    );
  }

  const unknownMemberIds = resolvedMemberIds.filter(
    (memberId) =>
      !projection.world.entities.some((entity) => entity.id === memberId),
  );
  if (unknownMemberIds.length > 0) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_ENTITY",
      `Unknown team members: ${unknownMemberIds.join(", ")}.`,
      404,
    );
  }

  const confirmation = context.requireDangerousCommandConfirmation(
    command,
    handledAt,
  );

  const events: EventEnvelope[] = [
    context.queueEvent(
      "team.assigned",
      {
        team: {
          id: teamId,
          memberIds: resolvedMemberIds,
          roomId,
        },
      },
      handledAt,
    ),
  ];

  if (roomId) {
    for (const memberId of resolvedMemberIds) {
      const entity = projection.world.entities.find(
        (entry) => entry.id === memberId,
      );
      if (!entity || entity.roomId === roomId) {
        continue;
      }

      events.push(
        context.queueEvent(
          "entity.moved",
          {
            entityId: memberId,
            toRoomId: roomId,
            kind: entity.kind,
            fromRoomId: entity.roomId ?? null,
          },
          handledAt,
        ),
      );
    }
  }

  return {
    confirmation,
    events,
  };
};
