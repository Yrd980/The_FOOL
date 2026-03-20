import type { CommandEnvelope } from "../../../src/openclaw/platform/contracts";
import type { CommandHandlerContext, CommandHandlerResult } from "./support";

export const handleSubmitScoreCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  const nextScore = context.buildScoreProjection(command, handledAt);
  return {
    events: [
      context.queueEvent(
        "judge.score_submitted",
        {
          stageId: nextScore.stageId,
          judgeScore: nextScore,
        },
        handledAt,
      ),
    ],
  };
};
