import { reduceConnection } from "./connectionReducer";
import type {
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
  GatewayPresenceEntry,
  Unsubscribe,
} from "./types";

type EventMap = {
  "connection-change": ConnectionState;
  "auth-error": string;
  presence: GatewayPresenceEntry[];
  message: GatewayMessage;
};

export class OpenClawGatewayClient {
  private config: GatewayConfig;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = "idle";
  private listeners = new Map<string, Set<Function>>();
  private pendingRpc = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private rpcIdCounter = 0;
  private presenceTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;

  private static MAX_RETRIES = 3;
  private static BACKOFF_BASE_MS = 1000;
  private static PRESENCE_INTERVAL_MS = 3000;

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
    this.connectionState = "idle";
    this.listeners.clear();
    this.pendingRpc.clear();
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
    };

    this.ws.onclose = () => {
      this.stopPresencePolling();
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
            this.startPresencePolling();
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
          id: `thefool-${this.config.id}`,
          version: "0.1.0",
          platform: "web",
          mode: "operator",
        },
        auth: { token: this.config.token },
        role: "operator",
        scopes: ["operator.read"],
        device: {
          id: `thefool-device-${this.config.id}`,
          platform: "web",
          deviceFamily: "browser",
        },
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
        // Polling failure is non-fatal
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

  private scheduleReconnect(): void {
    if (this.destroyed || this.connectionState === "disconnected") return;

    this.reconnectAttempt++;
    if (this.reconnectAttempt > OpenClawGatewayClient.MAX_RETRIES) {
      this.transition({ type: "retry-exhausted" });
      return;
    }

    const delay = OpenClawGatewayClient.BACKOFF_BASE_MS * Math.pow(2, this.reconnectAttempt - 1);
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) {
        this.openWebSocket();
      }
    }, delay);
  }

  private cleanup(): void {
    this.stopPresencePolling();
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
