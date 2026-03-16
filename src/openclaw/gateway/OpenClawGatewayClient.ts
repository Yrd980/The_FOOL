import { reduceConnection } from "./connectionReducer";
import type {
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
  GatewaySessionEntry,
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
  status: GatewaySessionEntry[];
  message: GatewayMessage;
};

export class OpenClawGatewayClient {
  private config: GatewayConfig;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = "idle";
  private connectionListeners = new Set<(data: ConnectionState) => void>();
  private authErrorListeners = new Set<(data: string) => void>();
  private statusListeners = new Set<(data: GatewaySessionEntry[]) => void>();
  private messageListeners = new Set<(data: GatewayMessage) => void>();
  private pendingRpc = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private rpcIdCounter = 0;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;

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
    if (event === "connection-change") {
      const listener = cb as (data: ConnectionState) => void;
      this.connectionListeners.add(listener);
      return () => this.connectionListeners.delete(listener);
    }

    if (event === "auth-error") {
      const listener = cb as (data: string) => void;
      this.authErrorListeners.add(listener);
      return () => this.authErrorListeners.delete(listener);
    }

    if (event === "status") {
      const listener = cb as (data: GatewaySessionEntry[]) => void;
      this.statusListeners.add(listener);
      return () => this.statusListeners.delete(listener);
    }

    const listener = cb as (data: GatewayMessage) => void;
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  destroy(): void {
    this.destroyed = true;
    this.cleanup();
    this.flushPendingRpc(new Error("Gateway client destroyed"));
    this.connectionState = "idle";
    this.connectionListeners.clear();
    this.authErrorListeners.clear();
    this.statusListeners.clear();
    this.messageListeners.clear();
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
            this.transition({ type: "auth-ok" });
            this.reconnectAttempt = 0;
            const helloPayload = frame.payload as {
              snapshot?: { health?: { agents?: HealthAgent[] } };
            };
            this.emitSessionsFromHealthAgents(
              helloPayload?.snapshot?.health?.agents,
            );
            this.startStatusPolling();
          }
          pending.resolve(frame.payload);
        } else {
          if (this.connectionState === "authenticating") {
            const reason = String(frame.error ?? "unknown");
            this.transition({ type: "auth-fail", reason });
            this.emit("auth-error", reason);
          }
          pending.reject(new Error(String(frame.error ?? "RPC error")));
        }
      }
      return;
    }

    if (frame.type === "event") {
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
      }
    }
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
          id: "molt-claw-gateway-client",
          instanceId: this.config.id,
          version: "0.1.0",
          platform: "web",
          mode: "operator",
        },
        auth: { token: this.config.token },
        role: "operator",
        scopes: ["operator.read"],
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
          this.emit("status", allSessions);
        } else if (Array.isArray(result.sessions.recent)) {
          this.emit("status", result.sessions.recent);
        }
      } catch {
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

    const content = this.extractTextFromChatMessage(chatPayload.message?.content);
    if (!content) {
      return;
    }

    const match = chatPayload.sessionKey.match(/^agent:([^:]+):/);
    const agentId = match?.[1] ?? chatPayload.sessionKey;
    const timestamp = chatPayload.message?.timestamp ?? Date.now();

    this.emit("message", {
      id: chatPayload.runId ?? `${chatPayload.sessionKey}-${timestamp}`,
      senderId: agentId,
      senderName: null,
      content,
      ts: timestamp,
    });
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
    let listeners:
      | Set<(data: ConnectionState) => void>
      | Set<(data: string) => void>
      | Set<(data: GatewaySessionEntry[]) => void>
      | Set<(data: GatewayMessage) => void>;

    if (event === "connection-change") {
      listeners = this.connectionListeners;
    } else if (event === "auth-error") {
      listeners = this.authErrorListeners;
    } else if (event === "status") {
      listeners = this.statusListeners;
    } else {
      listeners = this.messageListeners;
    }

    if (listeners.size === 0) {
      return;
    }

    for (const cb of listeners) {
      cb(data as never);
    }
  }
}
