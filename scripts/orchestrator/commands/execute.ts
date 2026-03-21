import type {
  CommandConfirmationStatus,
  CommandEnvelope,
  EventEnvelope,
} from "../../../src/openclaw/platform/contracts";
import type {
  CommandReceipt,
  OrchestratorError,
} from "../support";
import { handleGrantAwardCommand } from "./award";
import {
  handleDrawCommand,
  handleMoveEntityCommand,
} from "./entity";
import { handleSubmitScoreCommand } from "./score";
import {
  handleBetCommand,
  handleBroadcastCommand,
  handleReactionCommand,
  handleTalkCommand,
  handleVoteCommand,
} from "./social";
import {
  handleFinishActivityCommand,
  handleStartTimerCommand,
  handleTransitionStageCommand,
} from "./stageTimer";
import {
  type CommandHandlerContext,
  type CommandHandlerResult,
} from "./support";
import {
  handleLockSubmissionCommand,
  handleOpenSubmissionCommand,
  handleSubmitCommand,
} from "./submission";
import { handleAssignTeamCommand } from "./team";

export interface FreshCommandExecutionContext {
  resolveRequestedActivityRunId: (activityRunId?: string) => string;
  requireHostRole: (command: CommandEnvelope, handledAt: number) => void;
  requireParticipantRole: (command: CommandEnvelope, handledAt: number) => void;
  requireScoreRole: (command: CommandEnvelope, handledAt: number) => void;
  requireSubmissionRole: (command: CommandEnvelope, handledAt: number) => void;
  createCommandHandlerContext: (
    command: CommandEnvelope,
  ) => CommandHandlerContext;
  commitEvents: (events: EventEnvelope[]) => void;
  syncTimerSchedules: () => void;
  broadcastEvent: (event: EventEnvelope) => void;
  applyTransitionRuleAfterEvent: (
    triggerEventType: string,
  ) => EventEnvelope[];
  broadcastHealth: () => void;
  buildAcceptedReceipt: (
    command: CommandEnvelope,
    handledAt: number,
    events: EventEnvelope[],
    note?: string,
    confirmation?: CommandConfirmationStatus,
  ) => CommandReceipt;
  createCommandError: (
    command: CommandEnvelope,
    handledAt: number,
    code: string,
    message: string,
    status?: number,
  ) => OrchestratorError;
}

const transitionTriggerTypes = new Set([
  "submission.locked",
  "judge.score_submitted",
]);

const requireCommandRole = (
  command: CommandEnvelope,
  handledAt: number,
  context: FreshCommandExecutionContext,
): void => {
  if (
    command.type === "submit" ||
    command.type === "update_submission" ||
    command.type === "draw"
  ) {
    context.requireSubmissionRole(command, handledAt);
    return;
  }

  if (command.type === "submit_score") {
    context.requireScoreRole(command, handledAt);
    return;
  }

  if (
    command.type === "talk" ||
    command.type === "reaction" ||
    command.type === "bet" ||
    command.type === "vote"
  ) {
    context.requireParticipantRole(command, handledAt);
    return;
  }

  context.requireHostRole(command, handledAt);
};

const dispatchCommand = ({
  command,
  handledAt,
  commandHandlerContext,
  resolvedActivityRunId,
  context,
}: {
  command: CommandEnvelope;
  handledAt: number;
  commandHandlerContext: CommandHandlerContext;
  resolvedActivityRunId: string;
  context: FreshCommandExecutionContext;
}): CommandHandlerResult => {
  if (command.type === "transition_stage") {
    return handleTransitionStageCommand(
      command,
      handledAt,
      commandHandlerContext,
      resolvedActivityRunId,
    );
  }

  if (command.type === "start_timer") {
    return handleStartTimerCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "open_submission") {
    return handleOpenSubmissionCommand(
      command,
      handledAt,
      commandHandlerContext,
    );
  }

  if (command.type === "submit" || command.type === "update_submission") {
    return handleSubmitCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "lock_submission") {
    return handleLockSubmissionCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "submit_score") {
    return handleSubmitScoreCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "talk") {
    return handleTalkCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "broadcast") {
    return handleBroadcastCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "reaction") {
    return handleReactionCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "bet") {
    return handleBetCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "vote") {
    return handleVoteCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "grant_award") {
    return handleGrantAwardCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "draw") {
    return handleDrawCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "move_entity") {
    return handleMoveEntityCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "assign_team") {
    return handleAssignTeamCommand(command, handledAt, commandHandlerContext);
  }

  if (command.type === "finish_activity") {
    return handleFinishActivityCommand(command, handledAt, commandHandlerContext);
  }

  throw context.createCommandError(
    command,
    handledAt,
    "UNSUPPORTED_COMMAND",
    `Unsupported command type ${command.type}.`,
    400,
  );
};

export const executeFreshCommand = (
  command: CommandEnvelope,
  handledAt: number,
  context: FreshCommandExecutionContext,
): CommandReceipt => {
  const resolvedActivityRunId = context.resolveRequestedActivityRunId(
    command.activityRunId,
  );
  requireCommandRole(command, handledAt, context);

  const commandHandlerContext = context.createCommandHandlerContext(command);
  if (
    commandHandlerContext.getProjection().activityRun.status === "finished" &&
    command.type !== "finish_activity"
  ) {
    throw context.createCommandError(
      command,
      handledAt,
      "ACTIVITY_FINISHED",
      "Activity is already finished.",
      409,
    );
  }
  const result = dispatchCommand({
    command,
    handledAt,
    commandHandlerContext,
    resolvedActivityRunId,
    context,
  });

  if (result.finalizeEarly) {
    return context.buildAcceptedReceipt(
      command,
      handledAt,
      result.events,
      result.note,
      result.confirmation,
    );
  }

  const events = [...result.events];
  context.commitEvents(events);
  context.syncTimerSchedules();
  for (const event of events) {
    context.broadcastEvent(event);
  }

  const triggerEvent = events.find((event) => transitionTriggerTypes.has(event.type));
  if (triggerEvent) {
    const autoEvents = context.applyTransitionRuleAfterEvent(triggerEvent.type);
    if (autoEvents.length > 0) {
      context.commitEvents(autoEvents);
      context.syncTimerSchedules();
      for (const autoEvent of autoEvents) {
        context.broadcastEvent(autoEvent);
      }
      events.push(...autoEvents);
    }
  }

  context.broadcastHealth();

  return context.buildAcceptedReceipt(
    command,
    handledAt,
    events,
    undefined,
    result.confirmation,
  );
};
