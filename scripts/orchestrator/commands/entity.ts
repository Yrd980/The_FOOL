import { cloneJsonValue, isRecord } from "../support";
import type { CommandEnvelope } from "../../../src/openclaw/platform/contracts";
import type { CommandHandlerContext, CommandHandlerResult } from "./support";

export const handleDrawCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  const projection = context.getProjection();
  context.requireStageActionAllowed({
    command,
    handledAt,
    action: "draw",
  });

  const payload = command.payload;
  const entityId =
    typeof payload.entityId === "string"
      ? payload.entityId.trim()
      : command.actorId;
  const drawData = isRecord(payload.data) ? payload.data : {};

  return {
    events: [
      context.queueEvent(
        "draw.submitted",
        {
          stageId: projection.activityRun.currentStageId,
          entityId,
          data: cloneJsonValue(drawData),
        },
        handledAt,
      ),
    ],
  };
};

export const handleMoveEntityCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  const projection = context.getProjection();
  const payload = command.payload;
  const entityId =
    typeof payload.entityId === "string" ? payload.entityId.trim() : "";
  const toRoomId =
    typeof payload.toRoomId === "string" ? payload.toRoomId.trim() : "";
  const kind =
    typeof payload.kind === "string" ? payload.kind.trim() : "agent";

  if (!entityId || !toRoomId) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "move_entity requires payload.entityId and payload.toRoomId.",
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
        "entity.moved",
        {
          entityId,
          toRoomId,
          kind,
          fromRoomId:
            projection.world.entities.find((entity) => entity.id === entityId)?.roomId ??
            null,
        },
        handledAt,
      ),
    ],
  };
};
