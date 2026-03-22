import type { CommandEnvelope } from "../../src/openclaw/platform/contracts";
import type {
  OrchestratorStageTemplate,
  OrchestratorSubmissionSchema,
} from "../../src/openclaw/orchestratorQueryClient";
import type {
  GatewayEventEnvelope,
  GatewaySnapshotEnvelope,
} from "../../src/openclaw/gateway/types";

export interface RpcEventPage {
  activityRunId: string;
  fromSequence: number | null;
  toSequence: number | null;
  lastSequence: number;
  hasMore: boolean;
  events: GatewayEventEnvelope[];
}

export interface RpcSnapshotPayload {
  snapshot: GatewaySnapshotEnvelope;
  stageTemplates?: OrchestratorStageTemplate[];
  submissionSchemas?: OrchestratorSubmissionSchema[];
}

interface RpcCommandPayload {
  receipt: {
    status: "accepted" | "replayed";
    commandId: string;
    commandType: string;
    emittedSequences: number[];
    replayed: boolean;
  };
  snapshot: GatewaySnapshotEnvelope;
}

interface RpcOkFrame<T> {
  type: "res";
  id: string;
  ok: true;
  payload: T;
}

interface RpcErrorFrame {
  type: "res";
  id: string;
  ok: false;
  error: {
    code?: string;
    message: string;
  };
}

interface RpcEventFrame {
  type: "event";
  event: string;
  payload: unknown;
}

type RpcFrame<T = unknown> = RpcOkFrame<T> | RpcErrorFrame | RpcEventFrame;

const toWsUrl = (baseUrl: string): string => baseUrl.replace(/^http/i, "ws");

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class OrchestratorRpcClient {
  private readonly authToken: string;

  private readonly instanceId: string;

  private readonly role: string;

  private readonly ws: WebSocket;

  private readonly pendingCalls = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  private readonly pendingEvents = new Map<
    string,
    Array<{
      resolve: (frame: RpcEventFrame) => void;
      reject: (error: Error) => void;
    }>
  >();

  private readonly bufferedEvents = new Map<string, RpcEventFrame[]>();

  private rpcId = 0;

  private connected = false;

  constructor(
    baseUrl: string,
    authToken: string,
    instanceId: string,
    role: string,
  ) {
    this.authToken = authToken;
    this.instanceId = instanceId;
    this.role = role;
    this.ws = new WebSocket(toWsUrl(baseUrl));
    this.ws.addEventListener("message", (event) => {
      const frame = JSON.parse(String(event.data)) as RpcFrame;
      if (frame.type === "event") {
        const queue = this.pendingEvents.get(frame.event);
        const next = queue?.shift();
        if (next) {
          next.resolve(frame);
          if (queue && queue.length === 0) {
            this.pendingEvents.delete(frame.event);
          }
          return;
        }

        const buffered = this.bufferedEvents.get(frame.event) ?? [];
        buffered.push(frame);
        this.bufferedEvents.set(frame.event, buffered);
        return;
      }

      const pending = this.pendingCalls.get(frame.id);
      if (!pending) {
        return;
      }

      this.pendingCalls.delete(frame.id);
      if (frame.ok) {
        pending.resolve(frame.payload);
        return;
      }

      pending.reject(
        new Error(
          frame.error.code
            ? `[${frame.error.code}] ${frame.error.message}`
            : frame.error.message,
        ),
      );
    });
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener(
        "error",
        () => reject(new Error("WebSocket connection failed.")),
        { once: true },
      );
    });

    await this.waitForEvent("connect.challenge", 10_000);
    await this.call("connect", {
      auth: { token: this.authToken },
      client: { instanceId: this.instanceId },
      role: this.role,
    });
    this.connected = true;
  }

  close(): void {
    for (const { reject } of this.pendingCalls.values()) {
      reject(new Error("RPC client closed."));
    }
    for (const queue of this.pendingEvents.values()) {
      for (const waiter of queue) {
        waiter.reject(new Error("RPC client closed."));
      }
    }
    this.pendingCalls.clear();
    this.pendingEvents.clear();
    this.bufferedEvents.clear();
    this.ws.close();
  }

  async fetchSnapshot(activityRunId?: string): Promise<RpcSnapshotPayload> {
    return this.call<RpcSnapshotPayload>("orchestrator.snapshot", {
      ...(activityRunId ? { activityRunId } : {}),
    });
  }

  async fetchEvents(args: {
    activityRunId?: string;
    afterSequence?: number;
    fromSequence?: number;
    toSequence?: number;
    limit?: number;
  }): Promise<RpcEventPage> {
    return this.call<RpcEventPage>("orchestrator.events", args);
  }

  async dispatchCommand(
    command: CommandEnvelope,
  ): Promise<RpcCommandPayload> {
    return this.call<RpcCommandPayload>("orchestrator.command", { command });
  }

  async waitForSequence(
    targetSequence: number,
    activityRunId?: string,
    timeoutMs = 10_000,
  ): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const snapshot = await this.fetchSnapshot(activityRunId);
      if ((snapshot.snapshot.lastSequence ?? 0) >= targetSequence) {
        return;
      }
      await delay(200);
    }
    throw new Error(
      `Timed out waiting for authority sequence ${targetSequence}.`,
    );
  }

  private async call<T>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const id = `rpc-${this.instanceId}-${++this.rpcId}`;
    return new Promise<T>((resolve, reject) => {
      this.pendingCalls.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.ws.send(
        JSON.stringify({
          type: "req",
          id,
          method,
          params,
        }),
      );
    });
  }

  private async waitForEvent(
    eventName: string,
    timeoutMs: number,
  ): Promise<RpcEventFrame> {
    const buffered = this.bufferedEvents.get(eventName);
    const nextBuffered = buffered?.shift();
    if (nextBuffered) {
      if (buffered && buffered.length === 0) {
        this.bufferedEvents.delete(eventName);
      }
      return nextBuffered;
    }

    return new Promise<RpcEventFrame>((resolve, reject) => {
      const queue = this.pendingEvents.get(eventName) ?? [];
      const timeout = setTimeout(() => {
        const liveQueue = this.pendingEvents.get(eventName) ?? [];
        const nextQueue = liveQueue.filter((entry) => entry.reject !== reject);
        if (nextQueue.length > 0) {
          this.pendingEvents.set(eventName, nextQueue);
        } else {
          this.pendingEvents.delete(eventName);
        }
        reject(new Error(`Timed out waiting for event ${eventName}.`));
      }, timeoutMs);

      queue.push({
        resolve: (frame) => {
          clearTimeout(timeout);
          resolve(frame);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.pendingEvents.set(eventName, queue);
    });
  }
}
