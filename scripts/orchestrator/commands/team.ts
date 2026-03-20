import type { CommandEnvelope } from "../../../src/openclaw/platform/contracts";
import type { CommandHandlerContext, CommandHandlerResult } from "./support";

export const handleAssignTeamCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
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

  const confirmation = context.requireDangerousCommandConfirmation(
    command,
    handledAt,
  );

  return {
    confirmation,
    events: [
      context.queueEvent(
        "team.assigned",
        {
          team: {
            id: teamId,
            memberIds,
            roomId,
          },
        },
        handledAt,
      ),
    ],
  };
};
