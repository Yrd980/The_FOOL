import type { ServerWebSocket } from "bun";
import {
  OrchestratorError,
  type StableErrorBody,
  type WebSocketSessionData,
} from "./support";

export const toErrorBody = (error: unknown): StableErrorBody =>
  error instanceof OrchestratorError
    ? error.body
    : {
        code: "INTERNAL_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Unexpected orchestrator error.",
        status: 500,
        handledAt: Date.now(),
      };

export const sendJson = (
  value: unknown,
  init: ResponseInit = {},
): Response =>
  new Response(JSON.stringify(value, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      ...(init.headers ?? {}),
    },
  });

export const sendErrorResponse = (error: unknown): Response => {
  const body = toErrorBody(error);

  return sendJson(
    {
      ok: false,
      error: body,
    },
    { status: body.status },
  );
};

export const sendRpcError = (
  ws: ServerWebSocket<WebSocketSessionData>,
  id: string,
  error: unknown,
): void => {
  const body = toErrorBody(error);

  ws.send(
    JSON.stringify({
      type: "res",
      id,
      ok: false,
      error: {
        code: body.code,
        message: body.message,
        handledAt: body.handledAt,
        replayed: body.replayed ?? false,
        replayedFromIdempotency: body.replayedFromIdempotency,
        commandId: body.commandId,
        sourceCommandId: body.sourceCommandId,
        commandType: body.commandType,
        activityRunId: body.activityRunId,
        issuedAt: body.issuedAt,
      },
    }),
  );
};
