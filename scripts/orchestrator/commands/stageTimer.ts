import type { CommandEnvelope } from "../../../src/openclaw/platform/contracts";
import {
  buildEventCommandContext,
  type CommandHandlerContext,
  type CommandHandlerResult,
} from "./support";

export const handleTransitionStageCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
  resolvedActivityRunId: string,
): CommandHandlerResult => {
  const projection = context.getProjection();
  const payload = command.payload;
  const targetStageId =
    typeof payload.targetStageId === "string"
      ? payload.targetStageId.trim()
      : "";

  if (!targetStageId) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "transition_stage requires payload.targetStageId.",
    );
  }

  if (!context.findStage(targetStageId)) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_STAGE",
      `Unknown stage ${targetStageId}.`,
    );
  }

  if (projection.activityRun.currentStageId === targetStageId) {
    return {
      events: [],
      finalizeEarly: true,
      note: `Stage already at ${targetStageId}.`,
    };
  }

  const confirmation = context.requireDangerousCommandConfirmation(
    command,
    handledAt,
  );
  const events = [];
  const commandContext = buildEventCommandContext(command);
  const activeTimers = projection.timers.filter((timer) => timer.state === "running");

  for (const timer of activeTimers) {
    events.push(
      context.queueEvent(
        "timer.paused",
        {
          stageId: timer.stageId,
          reason: "stage_transition",
          timer: {
            ...timer,
            remainingMs: context.computeRemainingMs(timer, handledAt),
            state: "paused",
            pausedAt: handledAt,
            commandContext,
          },
        },
        handledAt,
      ),
    );
  }

  events.push(
    context.queueEvent(
      "stage.changed",
      {
        activityRunId: resolvedActivityRunId,
        fromStageId: projection.activityRun.currentStageId,
        toStageId: targetStageId,
        stageId: targetStageId,
        changedBy: command.actorId,
      },
      handledAt,
    ),
  );

  return {
    events,
    confirmation,
  };
};

export const handleStartTimerCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  const projection = context.getProjection();
  const payload = command.payload;
  const stageId =
    typeof payload.stageId === "string" ? payload.stageId.trim() : "";
  const durationSec =
    typeof payload.durationSec === "number"
      ? Math.max(1, Math.round(payload.durationSec))
      : Number.NaN;

  if (!stageId || !Number.isFinite(durationSec)) {
    throw context.createCommandError(
      command,
      handledAt,
      "INVALID_COMMAND",
      "start_timer requires payload.stageId and payload.durationSec.",
    );
  }

  if (!context.findStage(stageId)) {
    throw context.createCommandError(
      command,
      handledAt,
      "UNKNOWN_STAGE",
      `Unknown stage ${stageId}.`,
    );
  }

  const timerId = `timer-${stageId}`;
  const previous = projection.timers.find((timer) => timer.id === timerId);
  const events = [];
  const commandContext = buildEventCommandContext(command);

  if (previous?.state === "running") {
    events.push(
      context.queueEvent(
        "timer.paused",
        {
          stageId,
          reason: "timer_restarted",
          timer: {
            ...previous,
            remainingMs: context.computeRemainingMs(previous, handledAt),
            state: "paused",
            pausedAt: handledAt,
            commandContext,
          },
        },
        handledAt,
      ),
    );
  }

  events.push(
    context.queueEvent(
      "timer.started",
      {
        stageId,
        timer: {
          id: timerId,
          stageId,
          durationSec,
          remainingMs: durationSec * 1_000,
          state: "running",
          kind: "countdown",
          startedAt: handledAt,
          endsAt: handledAt + durationSec * 1_000,
          commandContext,
        },
      },
      handledAt,
    ),
  );

  return { events };
};
