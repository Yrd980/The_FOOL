import type {
  CommandConfirmationStatus,
  CommandEnvelope,
  EventCommandContext,
  EventEnvelope,
  ScoreProjection,
  StageTemplate,
  SubmissionData,
  SubmissionProjection,
  SubmissionVersionRecord,
  TimerProjection,
} from "../../../src/openclaw/platform/contracts";
import type {
  OrchestratorError,
  ProjectionState,
  StableErrorBody,
  SubmissionCommandType,
} from "../support";

export interface CommandHandlerContext {
  getProjection: () => ProjectionState;
  queueEvent: <TPayload extends Record<string, unknown>>(
    type: string,
    payload: TPayload,
    now?: number,
  ) => EventEnvelope<TPayload>;
  commitEvents: (events: EventEnvelope[]) => void;
  findStage: (stageId: string) => StageTemplate | undefined;
  computeRemainingMs: (timer: TimerProjection, now?: number) => number;
  createCommandError: (
    command: CommandEnvelope,
    handledAt: number,
    code: string,
    message: string,
    status?: number,
    extra?: Partial<StableErrorBody>,
  ) => OrchestratorError;
  requireDangerousCommandConfirmation: (
    command: CommandEnvelope,
    handledAt: number,
  ) => CommandConfirmationStatus | undefined;
  requireStageActionAllowed: (args: {
    command: CommandEnvelope;
    handledAt: number;
    action: string;
  }) => void;
  requireSubmissionActionWindow: (args: {
    command: CommandEnvelope;
    handledAt: number;
    submission: SubmissionProjection;
    action: "open_submission" | "lock_submission" | SubmissionCommandType;
  }) => void;
  validateSubmissionDataForCommand: (
    command: CommandEnvelope,
    handledAt: number,
    schemaId: string,
    value: unknown,
  ) => SubmissionData;
  buildSubmissionVersionRecord: (args: {
    version: number;
    updatedAt: number;
    actorId: string;
    actorRole: CommandEnvelope["actorRole"];
    data: SubmissionData;
  }) => SubmissionVersionRecord;
  buildSubmissionProjection: (
    submissionId: string,
    now: number,
    options?: { requiredAction?: string },
  ) => SubmissionProjection;
  buildScoreProjection: (
    command: CommandEnvelope,
    handledAt: number,
  ) => ScoreProjection;
}

export interface CommandHandlerResult {
  events: EventEnvelope[];
  confirmation?: CommandConfirmationStatus;
  finalizeEarly?: boolean;
  note?: string;
}

export const buildEventCommandContext = (
  command: Pick<
    CommandEnvelope,
    "id" | "idempotencyKey" | "actorId" | "actorRole"
  >,
): EventCommandContext => ({
  commandId: command.id,
  idempotencyKey: command.idempotencyKey,
  actorId: command.actorId,
  actorRole: command.actorRole,
});
