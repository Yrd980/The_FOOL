import type { ServerWebSocket } from "bun";
import type { LiveViewAssets } from "../../src/openclaw/liveView/assets";
import type { CommandEnvelope } from "../../src/openclaw/platform/contracts";
import {
  parseLimit,
  parsePositiveInt,
  type OrchestratorEventQueryArgs,
} from "./query";
import {
  OrchestratorError,
  isRecord,
  type AuditQueryResult,
  type CommandReceipt,
  type EventQueryResult,
  type ProjectionState,
  type ScoreQueryResult,
  type SessionProjection,
  type WebSocketSessionData,
} from "./support";
import { sendErrorResponse, sendJson, sendRpcError } from "./transport";

interface OrchestratorServerContext {
  authToken: string;
  dataDir: string;
  supportedRpcMethods: string[];
  supportedEvents: string[];
  clients: Set<ServerWebSocket<WebSocketSessionData>>;
  sessions: Map<string, SessionProjection>;
  getProjection: () => ProjectionState;
  resolveRequestedActivityRunId: (activityRunId?: string) => string;
  buildSnapshotEnvelope: (now?: number) => unknown;
  queryEvents: (args: OrchestratorEventQueryArgs) => EventQueryResult;
  queryAudit: (args: {
    activityRunId?: string;
    limit: number;
  }) => AuditQueryResult;
  queryScores: (args: OrchestratorEventQueryArgs) => ScoreQueryResult;
  executeCommand: (command: CommandEnvelope) => CommandReceipt;
  parseCommandEnvelope: (value: unknown) => CommandEnvelope | null;
  broadcastHealth: () => void;
  liveView?: LiveViewAssets;
}

const extractBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const requireHttpAuth = (request: Request, authToken: string): void => {
  const bearer = extractBearerToken(request);
  if (bearer !== authToken) {
    throw new OrchestratorError({
      code: "UNAUTHORIZED",
      message: "Unauthorized.",
      status: 401,
      handledAt: Date.now(),
    });
  }
};

const parseRpcEventQueryParams = (
  params: Record<string, unknown>,
): OrchestratorEventQueryArgs => ({
  activityRunId:
    typeof params.activityRunId === "string"
      ? params.activityRunId
      : undefined,
  afterSequence:
    typeof params.afterSequence === "number"
      ? params.afterSequence
      : undefined,
  fromSequence:
    typeof params.fromSequence === "number"
      ? params.fromSequence
      : undefined,
  toSequence:
    typeof params.toSequence === "number" ? params.toSequence : undefined,
  limit:
    typeof params.limit === "number"
      ? Math.max(1, Math.min(200, Math.round(params.limit)))
      : 20,
});

const sendRpcResponse = (
  ws: ServerWebSocket<WebSocketSessionData>,
  id: string,
  payload: unknown,
): void => {
  ws.send(
    JSON.stringify({
      type: "res",
      id,
      ok: true,
      payload,
    }),
  );
};

const buildStatusPayload = (sessions: Map<string, SessionProjection>) => ({
  sessions: {
    recent: Array.from(sessions.values()).sort(
      (left, right) => right.updatedAt - left.updatedAt,
    ),
  },
});

const sendTextResponse = (
  body: string,
  contentType: string,
  cacheControl?: string,
): Response =>
  new Response(body, {
    headers: {
      "content-type": `${contentType}; charset=utf-8`,
      ...(cacheControl ? { "cache-control": cacheControl } : {}),
    },
  });

const resolveLiveViewResponse = (
  pathname: string,
  liveView?: LiveViewAssets,
): Response | null => {
  if (pathname === "/live") {
    return sendTextResponse(liveView?.html ?? "Live view unavailable.", "text/html");
  }

  if (pathname === "/live/app.js") {
    return sendTextResponse(
      liveView?.appJs ?? "",
      "text/javascript",
      "no-store",
    );
  }

  if (pathname === "/live/live.css") {
    return sendTextResponse(liveView?.css ?? "", "text/css", "no-store");
  }

  return null;
};

const handleHttpCommand = async (
  request: Request,
  context: OrchestratorServerContext,
): Promise<Response> => {
  try {
    requireHttpAuth(request, context.authToken);
  } catch (error) {
    return sendErrorResponse(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return sendErrorResponse(
      new OrchestratorError({
        code: "INVALID_JSON",
        message: "Invalid JSON request body.",
        status: 400,
        handledAt: Date.now(),
      }),
    );
  }

  const payload = isRecord(body) ? body : null;
  const command = context.parseCommandEnvelope(payload?.command ?? payload);
  if (!command) {
    return sendErrorResponse(
      new OrchestratorError({
        code: "INVALID_COMMAND",
        message: "Missing command envelope.",
        status: 400,
        handledAt: Date.now(),
      }),
    );
  }

  try {
    const receipt = context.executeCommand(command);
    return sendJson({
      ok: true,
      receipt,
      snapshot: context.buildSnapshotEnvelope(),
    });
  } catch (error) {
    return sendErrorResponse(error);
  }
};

const handleRpcCommand = (
  ws: ServerWebSocket<WebSocketSessionData>,
  id: string,
  command: CommandEnvelope,
  context: OrchestratorServerContext,
): void => {
  try {
    const receipt = context.executeCommand(command);
    sendRpcResponse(ws, id, {
      receipt,
      snapshot: context.buildSnapshotEnvelope(),
    });
  } catch (error) {
    sendRpcError(ws, id, error);
  }
};

const handleWsMessage = (
  ws: ServerWebSocket<WebSocketSessionData>,
  rawMessage: string | Buffer | ArrayBuffer | Uint8Array,
  context: OrchestratorServerContext,
): void => {
  const source =
    typeof rawMessage === "string"
      ? rawMessage
      : rawMessage instanceof ArrayBuffer
        ? Buffer.from(rawMessage).toString("utf8")
        : Buffer.from(rawMessage).toString("utf8");

  let frame: Record<string, unknown>;
  try {
    frame = JSON.parse(source) as Record<string, unknown>;
  } catch {
    return;
  }

  if (frame.type !== "req" || typeof frame.id !== "string") {
    return;
  }

  if (frame.method === "connect") {
    const params = isRecord(frame.params) ? frame.params : {};
    const auth = isRecord(params.auth) ? params.auth : {};
    const token = typeof auth.token === "string" ? auth.token.trim() : "";
    if (token !== context.authToken) {
      sendRpcError(
        ws,
        frame.id,
        new OrchestratorError({
          code: "UNAUTHORIZED",
          message: "Unauthorized.",
          status: 401,
          handledAt: Date.now(),
        }),
      );
      return;
    }

    const client = isRecord(params.client) ? params.client : {};
    const instanceId =
      typeof client.instanceId === "string" ? client.instanceId : "unknown-client";
    const role = typeof params.role === "string" ? params.role : "operator";
    const updatedAt = Date.now();

    ws.data.authed = true;
    ws.data.agentId = instanceId;
    ws.data.role = role;
    ws.data.key = `${role}:${instanceId}`;

    context.sessions.set(ws.data.connectionId, {
      agentId: instanceId,
      key: ws.data.key,
      kind: role,
      updatedAt,
      abortedLastRun: false,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      model: "",
      modelProvider: "",
      contextTokens: 0,
    });

    sendRpcResponse(ws, frame.id, {
      type: "hello-ok",
      features: {
        methods: context.supportedRpcMethods,
        events: context.supportedEvents,
      },
      snapshot: context.buildSnapshotEnvelope(updatedAt),
    });
    context.broadcastHealth();
    return;
  }

  if (!ws.data.authed) {
    sendRpcError(
      ws,
      frame.id,
      new OrchestratorError({
        code: "CONNECT_REQUIRED",
        message: "Connect first.",
        status: 401,
        handledAt: Date.now(),
      }),
    );
    return;
  }

  const session = context.sessions.get(ws.data.connectionId);
  if (session) {
    session.updatedAt = Date.now();
    context.sessions.set(ws.data.connectionId, session);
  }

  if (frame.method === "status") {
    sendRpcResponse(ws, frame.id, buildStatusPayload(context.sessions));
    return;
  }

  if (frame.method === "orchestrator.command") {
    const params = isRecord(frame.params) ? frame.params : {};
    const command = context.parseCommandEnvelope(params.command);
    if (!command) {
      sendRpcError(
        ws,
        frame.id,
        new OrchestratorError({
          code: "INVALID_COMMAND",
          message: "Missing command envelope.",
          status: 400,
          handledAt: Date.now(),
        }),
      );
      return;
    }

    handleRpcCommand(ws, frame.id, command, context);
    return;
  }

  if (frame.method === "orchestrator.snapshot") {
    const params = isRecord(frame.params) ? frame.params : {};
    try {
      context.resolveRequestedActivityRunId(
        typeof params.activityRunId === "string"
          ? params.activityRunId
          : undefined,
      );
      const projection = context.getProjection();
      sendRpcResponse(ws, frame.id, {
        snapshot: context.buildSnapshotEnvelope(),
        stageTemplates: projection.stageTemplates,
        submissionSchemas: projection.submissionSchemas,
      });
    } catch (error) {
      sendRpcError(ws, frame.id, error);
    }
    return;
  }

  if (frame.method === "orchestrator.events") {
    const params = isRecord(frame.params) ? frame.params : {};
    try {
      sendRpcResponse(
        ws,
        frame.id,
        context.queryEvents(parseRpcEventQueryParams(params)),
      );
    } catch (error) {
      sendRpcError(ws, frame.id, error);
    }
    return;
  }

  if (frame.method === "orchestrator.replay") {
    const params = isRecord(frame.params) ? frame.params : {};
    try {
      sendRpcResponse(
        ws,
        frame.id,
        context.queryEvents(parseRpcEventQueryParams(params)),
      );
    } catch (error) {
      sendRpcError(ws, frame.id, error);
    }
    return;
  }

  if (frame.method === "orchestrator.audit") {
    const params = isRecord(frame.params) ? frame.params : {};
    try {
      const activityRunId =
        typeof params.activityRunId === "string"
          ? params.activityRunId
          : undefined;
      const limit =
        typeof params.limit === "number"
          ? Math.max(1, Math.min(200, Math.round(params.limit)))
          : 20;

      sendRpcResponse(ws, frame.id, context.queryAudit({ activityRunId, limit }));
    } catch (error) {
      sendRpcError(ws, frame.id, error);
    }
    return;
  }

  if (frame.method === "orchestrator.scores") {
    const params = isRecord(frame.params) ? frame.params : {};
    try {
      sendRpcResponse(
        ws,
        frame.id,
        context.queryScores(parseRpcEventQueryParams(params)),
      );
    } catch (error) {
      sendRpcError(ws, frame.id, error);
    }
    return;
  }

  sendRpcError(
    ws,
    frame.id,
    new OrchestratorError({
      code: "UNSUPPORTED_METHOD",
      message: `Unsupported RPC method ${String(frame.method)}.`,
      status: 400,
      handledAt: Date.now(),
    }),
  );
};

export const createOrchestratorServerHandlers = (
  context: OrchestratorServerContext,
): {
  fetch: (
    request: Request,
    runtime: Bun.Server<WebSocketSessionData>,
  ) => Response | undefined | Promise<Response | undefined>;
  websocket: Bun.WebSocketHandler<WebSocketSessionData>;
} => ({
  fetch(request, runtime) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      const liveViewResponse = resolveLiveViewResponse(
        url.pathname,
        context.liveView,
      );
      if (liveViewResponse) {
        return liveViewResponse;
      }
    }

    if (request.method === "OPTIONS") {
      return sendJson({ ok: true });
    }

    if (
      (url.pathname === "/" || url.pathname === "/ws") &&
      runtime.upgrade(request, {
        data: {
          connectionId: crypto.randomUUID(),
          agentId: null,
          role: null,
          key: "pending",
          authed: false,
        },
      })
    ) {
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const projection = context.getProjection();
      return sendJson({
        ok: true,
        service: "molt-claw-authoritative-orchestrator",
        activityRunId: projection.activityRun.id,
        currentStageId: projection.activityRun.currentStageId,
        lastSequence: projection.lastSequence,
        dataDir: context.dataDir,
      });
    }

    if (request.method === "GET" && url.pathname === "/api/orchestrator/snapshot") {
      try {
        requireHttpAuth(request, context.authToken);
        context.resolveRequestedActivityRunId(
          url.searchParams.get("activityRunId") ?? undefined,
        );
        const projection = context.getProjection();
        return sendJson({
          ok: true,
          snapshot: context.buildSnapshotEnvelope(),
          stageTemplates: projection.stageTemplates,
          submissionSchemas: projection.submissionSchemas,
        });
      } catch (error) {
        return sendErrorResponse(error);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/orchestrator/events") {
      try {
        requireHttpAuth(request, context.authToken);
        return sendJson({
          ok: true,
          ...context.queryEvents({
            activityRunId: url.searchParams.get("activityRunId") ?? undefined,
            afterSequence: parsePositiveInt(
              url.searchParams.get("afterSequence"),
              "afterSequence",
            ),
            fromSequence: parsePositiveInt(
              url.searchParams.get("fromSequence"),
              "fromSequence",
            ),
            toSequence: parsePositiveInt(
              url.searchParams.get("toSequence"),
              "toSequence",
            ),
            limit: parseLimit(url.searchParams.get("limit"), 20),
          }),
        });
      } catch (error) {
        return sendErrorResponse(error);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/orchestrator/replay") {
      try {
        requireHttpAuth(request, context.authToken);
        return sendJson({
          ok: true,
          ...context.queryEvents({
            activityRunId: url.searchParams.get("activityRunId") ?? undefined,
            afterSequence: parsePositiveInt(
              url.searchParams.get("afterSequence"),
              "afterSequence",
            ),
            fromSequence: parsePositiveInt(
              url.searchParams.get("fromSequence"),
              "fromSequence",
            ),
            toSequence: parsePositiveInt(
              url.searchParams.get("toSequence"),
              "toSequence",
            ),
            limit: parseLimit(url.searchParams.get("limit"), 20),
          }),
        });
      } catch (error) {
        return sendErrorResponse(error);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/orchestrator/audit") {
      try {
        requireHttpAuth(request, context.authToken);
        return sendJson({
          ok: true,
          ...context.queryAudit({
            activityRunId: url.searchParams.get("activityRunId") ?? undefined,
            limit: parseLimit(url.searchParams.get("limit"), 20),
          }),
        });
      } catch (error) {
        return sendErrorResponse(error);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/orchestrator/scores") {
      try {
        requireHttpAuth(request, context.authToken);
        return sendJson({
          ok: true,
          ...context.queryScores({
            activityRunId: url.searchParams.get("activityRunId") ?? undefined,
            afterSequence: parsePositiveInt(
              url.searchParams.get("afterSequence"),
              "afterSequence",
            ),
            fromSequence: parsePositiveInt(
              url.searchParams.get("fromSequence"),
              "fromSequence",
            ),
            toSequence: parsePositiveInt(
              url.searchParams.get("toSequence"),
              "toSequence",
            ),
            limit: parseLimit(url.searchParams.get("limit"), 20),
          }),
        });
      } catch (error) {
        return sendErrorResponse(error);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/orchestrator/commands") {
      return handleHttpCommand(request, context);
    }

    return sendErrorResponse(
      new OrchestratorError({
        code: "NOT_FOUND",
        message: `Unknown route ${url.pathname}.`,
        status: 404,
        handledAt: Date.now(),
      }),
    );
  },
  websocket: {
    open(ws) {
      context.clients.add(ws);
      ws.send(
        JSON.stringify({
          type: "event",
          event: "connect.challenge",
          payload: {
            minProtocol: 3,
            maxProtocol: 3,
          },
        }),
      );
    },
    message(ws, message) {
      handleWsMessage(ws, message, context);
    },
    close(ws) {
      context.clients.delete(ws);
      context.sessions.delete(ws.data.connectionId);
      context.broadcastHealth();
    },
  },
});
