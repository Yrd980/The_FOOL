import { reduceConnection } from "./connectionReducer";
import {
  GATEWAY_CONNECT_CLIENT_ID,
  GATEWAY_CONNECT_CLIENT_MODE,
  GATEWAY_OPERATOR_READ_SCOPE,
} from "../control";
import type {
  ConnectionState,
  GatewayConfig,
  GatewayEventEnvelope,
  GatewayHelloPayload,
  GatewayMessage,
  GatewaySessionEntry,
  GatewaySnapshotEnvelope,
  GatewayStatusResponse,
  Unsubscribe,
} from "./types";

interface HealthAgent {
  agentId: string;
  sessions?: {
    recent?: Array<{ key: string; updatedAt: number }>;
  };
}

type EventMap = {
  "connection-change": ConnectionState;
  "auth-error": string;
  hello: GatewayHelloPayload;
  warning: string;
  status: GatewaySessionEntry[];
  message: GatewayMessage;
  snapshot: GatewaySnapshotEnvelope;
  "orchestration-event": GatewayEventEnvelope;
};

const RESERVED_GATEWAY_EVENTS = new Set([
  "connect.challenge",
  "health",
  "chat",
  "message",
  "presence",
]);

const normalizeTimestamp = (value: number): number =>
  value < 1e12 ? value * 1000 : value;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const extractErrorMessage = (error: unknown): string => {
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "RPC error";
};

const looksLikeSnapshotEnvelope = (
  value: unknown,
): value is GatewaySnapshotEnvelope =>
  isRecord(value) &&
  [
    "snapshotId",
    "activityRun",
    "world",
    "timers",
    "skills",
    "submissions",
    "awards",
    "lastSequence",
  ].some((key) => key in value);

const looksLikeEventEnvelope = (
  value: unknown,
): value is GatewayEventEnvelope =>
  isRecord(value) &&
  typeof value.type === "string" &&
  (typeof value.timestamp === "number" ||
    typeof value.ts === "number" ||
    typeof value.occurredAt === "number");

const extractNestedRecord = (
  value: unknown,
  key: "snapshot" | "payload" | "data",
): Record<string, unknown> | null => {
  if (!isRecord(value)) {
    return null;
  }

  const nested = value[key];
  return isRecord(nested) ? nested : null;
};

const extractSnapshotEnvelope = (
  payload: unknown,
): GatewaySnapshotEnvelope | null => {
  if (looksLikeSnapshotEnvelope(payload)) {
    return payload;
  }

  const nestedSnapshot = extractNestedRecord(payload, "snapshot");
  if (looksLikeSnapshotEnvelope(nestedSnapshot)) {
    return nestedSnapshot;
  }

  const nestedPayload = extractNestedRecord(payload, "payload");
  if (looksLikeSnapshotEnvelope(nestedPayload)) {
    return nestedPayload;
  }

  const nestedData = extractNestedRecord(payload, "data");
  if (looksLikeSnapshotEnvelope(nestedData)) {
    return nestedData;
  }

  if (nestedPayload) {
    const fromNestedPayload = extractSnapshotEnvelope(nestedPayload);
    if (fromNestedPayload) {
      return fromNestedPayload;
    }
  }

  if (nestedData) {
    return extractSnapshotEnvelope(nestedData);
  }

  return null;
};

const extractEventTimestamp = (value: Record<string, unknown>): number => {
  const rawTimestamp =
    typeof value.timestamp === "number"
      ? value.timestamp
      : typeof value.ts === "number"
        ? value.ts
        : typeof value.occurredAt === "number"
          ? value.occurredAt
          : Date.now();

  return normalizeTimestamp(rawTimestamp);
};

export class OpenClawGatewayClient {
  private config: GatewayConfig;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = "idle";
  private listeners = new Map<keyof EventMap, Set<(data: unknown) => void>>();
  private pendingRpc = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private rpcIdCounter = 0;
  private syntheticEventCounter = 0;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;
  private lastSessions: GatewaySessionEntry[] = [];

  private static MAX_RETRIES = 3;
  private static BACKOFF_BASE_MS = 1000;
  private static STATUS_INTERVAL_MS = 5000;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  connect(): void {
    if (this.destroyed) return;
    this.transition({ type: "start" });
    this.openWebSocket();
  }

  on<K extends keyof EventMap>(event: K, cb: (data: EventMap[K]) => void): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listener = cb as (data: unknown) => void;
    this.listeners.get(event)?.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  destroy(): void {
    this.destroyed = true;
    this.cleanup();
    this.flushPendingRpc(new Error("Gateway client destroyed"));
    this.connectionState = "idle";
    this.listeners.clear();
  }

  async call<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = `rpc-${++this.rpcIdCounter}`;
      this.pendingRpc.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  private openWebSocket(): void {
    try {
      this.ws = new WebSocket(this.config.url);
    } catch {
      this.transition({ type: "ws-error" });
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.transition({ type: "ws-open" });
    };

    this.ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        this.handleFrame(frame);
      } catch {
        // Ignore malformed frames
      }
    };

    this.ws.onerror = () => {
      this.transition({ type: "ws-error" });
      this.scheduleReconnect();
    };

    this.ws.onclose = () => {
      this.stopStatusPolling();
      this.flushPendingRpc(new Error("WebSocket closed"));
      if (!this.destroyed && this.connectionState !== "disconnected") {
        this.transition({ type: "ws-close" });
        this.scheduleReconnect();
      }
    };
  }

  private handleFrame(frame: {
    type: string;
    id?: string;
    event?: string;
    ok?: boolean;
    payload?: unknown;
    error?: unknown;
  }): void {
    if (frame.type === "res" && frame.id) {
      const pending = this.pendingRpc.get(frame.id);
      if (pending) {
        this.pendingRpc.delete(frame.id);
        if (frame.ok) {
          const payload = frame.payload as { type?: string } | undefined;
          if (payload?.type === "hello-ok") {
            this.emit("hello", payload as GatewayHelloPayload);
            this.transition({ type: "auth-ok" });
            this.reconnectAttempt = 0;

            const snapshot = extractSnapshotEnvelope(frame.payload);
            if (snapshot) {
              this.emit("snapshot", snapshot);
            }

            const helloPayload = frame.payload as {
              snapshot?: { health?: { agents?: HealthAgent[] } };
            };
            this.emitSessionsFromHealthAgents(helloPayload?.snapshot?.health?.agents);
            this.startStatusPolling();
          } else {
            const snapshot = extractSnapshotEnvelope(frame.payload);
            if (snapshot) {
              this.emit("snapshot", snapshot);
            }
          }

          pending.resolve(frame.payload);
        } else {
          if (this.connectionState === "authenticating") {
            const reason = extractErrorMessage(frame.error);
            this.transition({ type: "auth-fail", reason });
            this.emit("auth-error", reason);
          }
          pending.reject(new Error(extractErrorMessage(frame.error)));
        }
      }
      return;
    }

    if (frame.type !== "event") {
      return;
    }

    if (frame.event === "connect.challenge") {
      this.sendConnectRequest();
      return;
    }

    if (frame.event === "health") {
      const healthPayload = frame.payload as { agents?: HealthAgent[] } | undefined;
      this.emitSessionsFromHealthAgents(healthPayload?.agents);
      return;
    }

    if (frame.event === "chat") {
      this.emitChatPayload(frame.payload);
      return;
    }

    const snapshot = extractSnapshotEnvelope(frame.payload);
    if (snapshot) {
      this.emit("snapshot", snapshot);
    }

    const orchestrationEvent = this.extractOrchestrationEvent(frame);
    if (orchestrationEvent) {
      this.emit("orchestration-event", orchestrationEvent);
    }
  }

  private extractOrchestrationEvent(frame: {
    event?: string;
    payload?: unknown;
  }): GatewayEventEnvelope | null {
    if (looksLikeEventEnvelope(frame.payload)) {
      const payload = frame.payload as GatewayEventEnvelope & Record<string, unknown>;
      return {
        id:
          typeof payload.id === "string"
            ? payload.id
            : `evt-${++this.syntheticEventCounter}`,
        sequence: typeof payload.sequence === "number" ? payload.sequence : undefined,
        type: payload.type,
        activityRunId:
          typeof payload.activityRunId === "string" ? payload.activityRunId : undefined,
        entityId: typeof payload.entityId === "string" ? payload.entityId : undefined,
        roomId: typeof payload.roomId === "string" ? payload.roomId : undefined,
        timestamp: extractEventTimestamp(payload),
        payload: isRecord(payload.payload)
          ? payload.payload
          : (payload.payload as Record<string, unknown> | undefined) ?? {},
      };
    }

    if (!frame.event || RESERVED_GATEWAY_EVENTS.has(frame.event) || !frame.event.includes(".")) {
      return null;
    }

    const payload = isRecord(frame.payload) ? frame.payload : {};
    return {
      id:
        typeof payload.id === "string"
          ? payload.id
          : `evt-${++this.syntheticEventCounter}`,
      sequence: typeof payload.sequence === "number" ? payload.sequence : undefined,
      type: frame.event,
      activityRunId:
        typeof payload.activityRunId === "string" ? payload.activityRunId : undefined,
      entityId: typeof payload.entityId === "string" ? payload.entityId : undefined,
      roomId: typeof payload.roomId === "string" ? payload.roomId : undefined,
      timestamp: extractEventTimestamp(payload),
      payload,
    };
  }

  private sendConnectRequest(): void {
    const id = `rpc-${++this.rpcIdCounter}`;
    const request = {
      type: "req",
      id,
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: GATEWAY_CONNECT_CLIENT_ID,
          instanceId: this.config.id,
          version: "0.1.0",
          platform: "web",
          mode: GATEWAY_CONNECT_CLIENT_MODE,
        },
        auth: { token: this.config.token },
        role: "operator",
        scopes: [GATEWAY_OPERATOR_READ_SCOPE],
      },
    };

    this.pendingRpc.set(id, {
      resolve: () => {},
      reject: () => {},
    });

    this.ws?.send(JSON.stringify(request));
  }

  private startStatusPolling(): void {
    this.stopStatusPolling();
    const poll = async () => {
      if (this.connectionState !== "connected" || this.destroyed) return;
      try {
        const result = await this.call<GatewayStatusResponse>("status");
        if (!result?.sessions) return;

        if (Array.isArray(result.sessions.byAgent)) {
          const allSessions: GatewaySessionEntry[] = [];
          for (const group of result.sessions.byAgent) {
            if (Array.isArray(group.recent) && group.recent.length > 0) {
              allSessions.push(group.recent[0]);
            }
          }
          this.lastSessions = allSessions;
          this.emit("status", allSessions);
        } else if (Array.isArray(result.sessions.recent)) {
          this.lastSessions = result.sessions.recent;
          this.emit("status", result.sessions.recent);
        }
      } catch (error) {
        if (error instanceof Error && error.message.trim()) {
          this.emit("warning", error.message);
        }
        this.stopStatusPolling();
      }
    };

    poll();
    this.statusTimer = setInterval(poll, OpenClawGatewayClient.STATUS_INTERVAL_MS);
  }

  private stopStatusPolling(): void {
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (
      this.destroyed ||
      this.connectionState === "disconnected" ||
      this.reconnectTimer
    ) {
      return;
    }

    this.reconnectAttempt++;
    if (this.reconnectAttempt > OpenClawGatewayClient.MAX_RETRIES) {
      this.transition({ type: "retry-exhausted" });
      return;
    }

    const delay =
      OpenClawGatewayClient.BACKOFF_BASE_MS *
      Math.pow(2, this.reconnectAttempt - 1);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed) {
        this.openWebSocket();
      }
    }, delay);
  }

  private cleanup(): void {
    this.stopStatusPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === 0 || this.ws.readyState === 1) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private flushPendingRpc(error: Error): void {
    for (const pending of this.pendingRpc.values()) {
      pending.reject(error);
    }
    this.pendingRpc.clear();
  }

  private emitSessionsFromHealthAgents(agents: HealthAgent[] | undefined): void {
    if (!Array.isArray(agents)) return;

    const sessions: GatewaySessionEntry[] = [];
    for (const agent of agents) {
      const recent = agent.sessions?.recent?.[0];
      if (!recent) continue;

      sessions.push({
        agentId: agent.agentId,
        key: recent.key,
        kind: "agent",
        updatedAt: recent.updatedAt,
        abortedLastRun: false,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        model: "",
        modelProvider: "",
        contextTokens: 0,
      });
    }

    if (sessions.length > 0) {
      this.lastSessions = sessions;
      this.emit("status", sessions);
    }
  }

  private emitChatPayload(payload: unknown): void {
    const chatPayload = payload as {
      runId?: string;
      sessionKey?: string;
      message?: { timestamp?: number; content?: unknown };
    } | undefined;

    if (!chatPayload?.sessionKey) {
      return;
    }

    this.touchSessionFromKey(chatPayload.sessionKey, chatPayload.message?.timestamp);

    const content = this.extractTextFromChatMessage(chatPayload.message?.content);
    if (!content) {
      return;
    }

    const match = chatPayload.sessionKey.match(/^agent:([^:]+):/);
    const agentId = match?.[1] ?? chatPayload.sessionKey;
    const timestamp = normalizeTimestamp(chatPayload.message?.timestamp ?? Date.now());

    this.emit("message", {
      id: chatPayload.runId ?? `${chatPayload.sessionKey}-${timestamp}`,
      senderId: agentId,
      senderName: null,
      content,
      ts: timestamp,
    });
  }

  private touchSessionFromKey(sessionKey: string, ts?: number): void {
    const match = sessionKey.match(/^agent:([^:]+):/);
    if (!match) {
      return;
    }

    const agentId = match[1];
    const updatedAt = normalizeTimestamp(ts ?? Date.now());
    const nextSessions = this.lastSessions.map((session) =>
      session.agentId === agentId
        ? { ...session, updatedAt, abortedLastRun: false }
        : session,
    );

    if (!nextSessions.some((session) => session.agentId === agentId)) {
      nextSessions.push({
        agentId,
        key: sessionKey,
        kind: "agent",
        updatedAt,
        abortedLastRun: false,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        model: "",
        modelProvider: "",
        contextTokens: 0,
      });
    }

    this.lastSessions = nextSessions;
    this.emit("status", nextSessions);
  }

  private extractTextFromChatMessage(content: unknown): string | null {
    if (typeof content === "string") {
      return content;
    }

    if (!Array.isArray(content)) {
      return null;
    }

    const parts = content
      .map((item) =>
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        (item as { type?: unknown }).type === "text" &&
        typeof (item as { text?: unknown }).text === "string"
          ? (item as { text: string }).text
          : null,
      )
      .filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join("\n") : null;
  }

  private transition(event: { type: string; reason?: string }): void {
    const next = reduceConnection(this.connectionState, event as never);
    if (next !== this.connectionState) {
      this.connectionState = next;
      this.emit("connection-change", next);
    }
  }

  private emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const cb of listeners) {
      cb(data);
    }
  }
}
