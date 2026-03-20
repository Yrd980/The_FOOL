import type { CommandEnvelope } from "../../../src/openclaw/platform/contracts";
import type { CommandHandlerContext, CommandHandlerResult } from "./support";

export const handleGrantAwardCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  const projection = context.getProjection();
  const payload = command.payload;
  const awardId =
    typeof payload.awardId === "string" ? payload.awardId.trim() : "";
  const entityId =
    typeof payload.entityId === "string" ? payload.entityId.trim() : "";
  const label =
    typeof payload.label === "string" && payload.label.trim().length > 0
      ? payload.label.trim()
      : awardId;
  const reason =
    typeof payload.reason === "string" && payload.reason.trim().length > 0
      ? payload.reason.trim()
      : undefined;

  if (!awardId || !entityId) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "grant_award requires payload.awardId and payload.entityId.",
    );
  }

  const existingAward = projection.awards.find((award) => award.awardId === awardId);
  if (existingAward) {
    throw context.createCommandError(
      command,
      handledAt,
      "AWARD_ALREADY_GRANTED",
      `Award ${awardId} has already been granted.`,
      409,
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
        "award.granted",
        {
          award: {
            awardId,
            label,
            entityId,
            reason,
            grantedAt: handledAt,
          },
        },
        handledAt,
      ),
    ],
  };
};
