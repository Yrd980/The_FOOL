import { reduceConnection } from "./connectionReducer";
import type {
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
  GatewayPresenceEntry,
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
  presence: GatewayPresenceEntry[];
  message: GatewayMessage;
  status: GatewaySessionEntry[];
};

export class OpenClawGatewayClient {
  private config: GatewayConfig;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = "idle";
  private listeners = new Map<string, Set<Function>>();
  private pendingRpc = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private rpcIdCounter = 0;
  private presenceTimer: ReturnType<typeof setInterval> | null = null;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;
  private lastSessions: GatewaySessionEntry[] = [];

  private static MAX_RETRIES = 3;
  private static BACKOFF_BASE_MS = 1000;
  private static PRESENCE_INTERVAL_MS = 3000;
  private static STATUS_INTERVAL_MS = 5000;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  connect(): void {
    if (this.destroyed) return;
    this.transition({ type: "start" });
    this.openWebSocket();
  }

  disconnect(): void {
    this.transition({ type: "disconnect" });
    this.cleanup();
    this.flushPendingRpc(new Error("WebSocket disconnected"));
  }

  async call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = `rpc-${++this.rpcIdCounter}`;
      this.pendingRpc.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  on<K extends keyof EventMap>(event: K, cb: (data: EventMap[K]) => void): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  destroy(): void {
    this.destroyed = true;
    this.cleanup();
    this.flushPendingRpc(new Error("Gateway client destroyed"));
    this.connectionState = "idle";
    this.listeners.clear();
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
      this.stopPresencePolling();
      this.stopStatusPolling();
      this.flushPendingRpc(new Error("WebSocket closed"));
      if (!this.destroyed && this.connectionState !== "disconnected") {
        this.transition({ type: "ws-close" });
        this.scheduleReconnect();
      }
    };
  }

  private handleFrame(frame: { type: string; id?: string; event?: string; ok?: boolean; payload?: unknown; error?: unknown }): void {
    // Response to an RPC call
    if (frame.type === "res" && frame.id) {
      const pending = this.pendingRpc.get(frame.id);
      if (pending) {
        this.pendingRpc.delete(frame.id);
        if (frame.ok) {
          // Check if this is the connect response (hello-ok)
          const payload = frame.payload as { type?: string } | undefined;
          if (payload?.type === "hello-ok") {
            this.transition({ type: "auth-ok" });
            this.reconnectAttempt = 0;
            const helloPayload = frame.payload as {
              snapshot?: {
                presence?: GatewayPresenceEntry[];
                health?: { agents?: HealthAgent[] };
              };
            };
            this.emitPresenceFromPayload(helloPayload?.snapshot?.presence);
            this.emitSessionsFromHealthAgents(helloPayload?.snapshot?.health?.agents);
            this.startPresencePolling();
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

    // Server event
    if (frame.type === "event") {
      if (frame.event === "connect.challenge") {
        this.sendConnectRequest();
        return;
      }

      if (frame.event === "presence") {
        this.emitPresenceFromPayload(frame.payload);
        return;
      }

      if (frame.event === "message") {
        this.emitMessageFromPayload(frame.payload);
        return;
      }

      if (frame.event === "chat") {
        this.emitChatPayload(frame.payload);
        return;
      }

      if (frame.event === "health") {
        const healthPayload = frame.payload as { agents?: HealthAgent[] } | undefined;
        this.emitSessionsFromHealthAgents(healthPayload?.agents);
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
          id: "gateway-client",
          instanceId: this.config.id,
          version: "0.1.0",
          platform: "web",
          mode: "backend",
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

  private startPresencePolling(): void {
    this.stopPresencePolling();
    const poll = async () => {
      if (this.connectionState !== "connected" || this.destroyed) return;
      try {
        const result = await this.call<GatewayPresenceEntry[]>("system-presence");
        if (Array.isArray(result)) {
          this.emit("presence", result);
        }
      } catch {
        // Scope denied — stop polling, health events provide fallback data
        this.stopPresencePolling();
      }
    };

    poll();
    this.presenceTimer = setInterval(poll, OpenClawGatewayClient.PRESENCE_INTERVAL_MS);
  }

  private stopPresencePolling(): void {
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
  }

  private startStatusPolling(): void {
    this.stopStatusPolling();
    const poll = async () => {
      if (this.connectionState !== "connected" || this.destroyed) return;
      try {
        const result = await this.call<GatewayStatusResponse>("status");
        if (!result?.sessions) return;

        // Prefer byAgent (returns all agents) over recent (capped at 10)
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
      } catch {
        // Scope denied — stop polling, health events provide fallback data
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
    if (this.destroyed || this.connectionState === "disconnected" || this.reconnectTimer) return;

    this.reconnectAttempt++;
    if (this.reconnectAttempt > OpenClawGatewayClient.MAX_RETRIES) {
      this.transition({ type: "retry-exhausted" });
      return;
    }

    const delay = OpenClawGatewayClient.BACKOFF_BASE_MS * Math.pow(2, this.reconnectAttempt - 1);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed) {
        this.openWebSocket();
      }
    }, delay);
  }

  private cleanup(): void {
    this.stopPresencePolling();
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

    console.debug("[GW] health event — %d agents", agents.length);

    const sessions: GatewaySessionEntry[] = [];
    for (const agent of agents) {
      const recent = agent.sessions?.recent?.[0];
      if (!recent) continue;

      console.debug(
        "[GW]   agent=%s  updatedAt=%o  idleMs=%d",
        agent.agentId,
        recent.updatedAt,
        Date.now() - (recent.updatedAt < 1e12 ? recent.updatedAt * 1000 : recent.updatedAt),
      );

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

  private emitPresenceFromPayload(payload: unknown): void {
    if (Array.isArray(payload)) {
      this.emit("presence", payload as GatewayPresenceEntry[]);
      return;
    }

    const presence = (
      payload as { presence?: GatewayPresenceEntry[] } | undefined
    )?.presence;

    if (Array.isArray(presence)) {
      this.emit("presence", presence);
    }
  }

  private emitMessageFromPayload(payload: unknown): void {
    const message = payload as Partial<GatewayMessage> | undefined;

    if (
      typeof message?.id === "string" &&
      typeof message.senderId === "string" &&
      typeof message.content === "string" &&
      typeof message.ts === "number"
    ) {
      this.emit("message", {
        id: message.id,
        senderId: message.senderId,
        senderName: typeof message.senderName === "string" ? message.senderName : null,
        content: message.content,
        ts: message.ts,
      });
    }
  }

  private emitChatPayload(payload: unknown): void {
    const chatPayload = payload as {
      runId?: string;
      sessionKey?: string;
      message?: { timestamp?: number; content?: unknown };
    } | undefined;

    if (!chatPayload?.sessionKey) return;

    // Update session timestamp for real-time contestant state transitions
    this.touchSessionFromKey(chatPayload.sessionKey, chatPayload.message?.timestamp);

    const content = this.extractTextFromChatMessage(chatPayload?.message?.content);
    if (!content) return;

    this.emit("message", {
      id: chatPayload.runId ?? `${chatPayload.sessionKey}-${chatPayload.message?.timestamp ?? Date.now()}`,
      senderId: chatPayload.sessionKey,
      senderName: null,
      content,
      ts: chatPayload.message?.timestamp ?? Date.now(),
    });
  }

  private touchSessionFromKey(sessionKey: string, ts?: number): void {
    // Extract agentId from session key format: "agent:{agentId}:{channel}"
    const match = sessionKey.match(/^agent:([^:]+):/);
    if (!match) return;

    const agentId = match[1];
    const now = ts ?? Date.now();

    // Update existing session or create a new entry
    const updated = this.lastSessions.map((s) =>
      s.agentId === agentId ? { ...s, updatedAt: now, abortedLastRun: false } : s,
    );

    if (!updated.some((s) => s.agentId === agentId)) {
      updated.push({
        agentId,
        key: sessionKey,
        kind: "agent",
        updatedAt: now,
        abortedLastRun: false,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        model: "",
        modelProvider: "",
        contextTokens: 0,
      });
    }

    this.lastSessions = updated;
    this.emit("status", updated);
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
    const next = reduceConnection(this.connectionState, event as any);
    if (next !== this.connectionState) {
      this.connectionState = next;
      this.emit("connection-change", next);
    }
  }

  private emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        cb(data);
      }
    }
  }
}
