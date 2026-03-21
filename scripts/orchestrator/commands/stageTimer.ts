import type {
  BetProjection,
  BetSettlementItem,
  CommandEnvelope,
  EventEnvelope,
} from "../../../src/openclaw/platform/contracts";
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

const buildBetSettlement = ({
  bet,
  settledAt,
  settlementMode,
  winningTargetType,
  winningTargetId,
}: {
  bet: BetProjection;
  settledAt: number;
  settlementMode: "winner" | "push";
  winningTargetType?: "team" | "entity" | "submission";
  winningTargetId?: string;
}): BetSettlementItem => {
  if (settlementMode === "push") {
    return {
      betId: bet.id,
      actorId: bet.actorId,
      actorRole: bet.actorRole,
      targetType: bet.targetType,
      targetId: bet.targetId,
      amount: bet.amount,
      odds: bet.odds,
      stance: bet.stance,
      result: "push",
      payout: bet.amount,
      settledAt,
    };
  }

  const isWinner =
    winningTargetType === bet.targetType && winningTargetId === bet.targetId;
  const payout = isWinner
    ? bet.amount !== undefined
      ? bet.odds !== undefined
        ? Number((bet.amount * bet.odds).toFixed(2))
        : bet.amount
      : undefined
    : 0;

  return {
    betId: bet.id,
    actorId: bet.actorId,
    actorRole: bet.actorRole,
    targetType: bet.targetType,
    targetId: bet.targetId,
    amount: bet.amount,
    odds: bet.odds,
    stance: bet.stance,
    result: isWinner ? "won" : "lost",
    payout,
    settledAt,
    winningTargetType,
    winningTargetId,
  };
};

export const handleFinishActivityCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: CommandHandlerContext,
): CommandHandlerResult => {
  const projection = context.getProjection();
  if (projection.activityRun.status === "finished") {
    return {
      events: [],
      finalizeEarly: true,
      note: "Activity already finished.",
    };
  }

  const payload = command.payload;
  const settlementMode = payload.settlementMode === "push" ? "push" : "winner";
  const winningTargetType =
    payload.winningTargetType === "team" ||
    payload.winningTargetType === "entity" ||
    payload.winningTargetType === "submission"
      ? payload.winningTargetType
      : undefined;
  const winningTargetId =
    typeof payload.winningTargetId === "string"
      ? payload.winningTargetId.trim()
      : undefined;
  const note =
    typeof payload.note === "string" && payload.note.trim().length > 0
      ? payload.note.trim()
      : undefined;
  const endedAt =
    typeof payload.endedAt === "number" && Number.isFinite(payload.endedAt)
      ? Math.max(handledAt, Math.round(payload.endedAt))
      : handledAt;

  if (settlementMode !== "push") {
    if (!winningTargetType || !winningTargetId) {
      throw context.createCommandError(
        command,
        handledAt,
        "INVALID_COMMAND",
        "finish_activity requires winningTargetType and winningTargetId unless settlementMode=push.",
      );
    }

    if (
      winningTargetType === "team" &&
      !projection.world.teams.some((team) => team.id === winningTargetId)
    ) {
      throw context.createCommandError(
        command,
        handledAt,
        "UNKNOWN_TEAM",
        `Unknown winning team ${winningTargetId}.`,
        404,
      );
    }

    if (
      winningTargetType === "entity" &&
      !projection.world.entities.some((entity) => entity.id === winningTargetId)
    ) {
      throw context.createCommandError(
        command,
        handledAt,
        "UNKNOWN_ENTITY",
        `Unknown winning entity ${winningTargetId}.`,
        404,
      );
    }

    if (
      winningTargetType === "submission" &&
      !projection.submissions.some((submission) => submission.id === winningTargetId)
    ) {
      throw context.createCommandError(
        command,
        handledAt,
        "SUBMISSION_NOT_FOUND",
        `Winning submission ${winningTargetId} does not exist.`,
        404,
      );
    }
  }

  const confirmation = context.requireDangerousCommandConfirmation(
    command,
    handledAt,
  );
  const commandContext = buildEventCommandContext(command);
  const activeTimers = projection.timers.filter((timer) => timer.state === "running");
  const events: EventEnvelope[] = activeTimers.map((timer) =>
    context.queueEvent(
      "timer.ended",
      {
        stageId: timer.stageId,
        reason: "activity_finished",
        timer: {
          ...timer,
          remainingMs: 0,
          state: "ended",
          endedAt,
          commandContext,
        },
      },
      endedAt,
    ),
  );
  const betSettlements = projection.bets.map((bet) =>
    buildBetSettlement({
      bet,
      settledAt: endedAt,
      settlementMode,
      winningTargetType,
      winningTargetId,
    }),
  );

  events.push(
    context.queueEvent(
      "activity.finished",
      {
        activityRunId: projection.activityRun.id,
        stageId: projection.activityRun.currentStageId,
        endedAt,
        settlementMode,
        ...(winningTargetType ? { winningTargetType } : {}),
        ...(winningTargetId ? { winningTargetId } : {}),
        ...(note ? { note } : {}),
        betSettlements,
      },
      endedAt,
    ),
  );

  return {
    events,
    confirmation,
  };
};
