# OpenClaw Gateway Adapter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the room UI to a running OpenClaw gateway via WebSocket, with build-time switching between the existing seed source and the new gateway source.

**Architecture:** A layered adapter pattern — standalone `OpenClawGatewayClient` class (no React) handles WebSocket lifecycle and auth, pure `gatewayAdapter` functions map gateway presence/messages to room domain types, and `useGatewayRoomSource` hook feeds the adapter output through the existing derivation pipeline. A `useRoomSource` module-level selector picks between seed and gateway based on `VITE_ROOM_SOURCE` env var.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, WebSocket (browser native)

---

## File Structure

- Create: `src/room/gateway/types.ts`
  Responsibility: Gateway-specific types (ConnectionState, ConnectionEvent, GatewayPresenceEntry, GatewayMessage, GatewayConfig, AgentPresenceMap)
- Create: `src/room/gateway/connectionReducer.ts`
  Responsibility: Pure connection state machine reducer
- Create: `src/room/gateway/connectionReducer.test.ts`
  Responsibility: Full state transition coverage
- Create: `src/room/gateway/gatewayAdapter.ts`
  Responsibility: Pure functions mapping gateway data → room domain types
- Create: `src/room/gateway/gatewayAdapter.test.ts`
  Responsibility: Presence mapping, activity heuristics, message classification tests
- Create: `src/room/gateway/OpenClawGatewayClient.ts`
  Responsibility: WebSocket client class with auth, RPC, presence polling, reconnect
- Create: `src/room/gateway/OpenClawGatewayClient.test.ts`
  Responsibility: Unit tests with mock WebSocket
- Create: `src/room/gateway/index.ts`
  Responsibility: Barrel exports for gateway submodule
- Create: `src/room/useGatewayRoomSource.ts`
  Responsibility: React hook wrapping gateway client + derivation pipeline
- Create: `src/room/useRoomSource.ts`
  Responsibility: Build-time source selector (seed | gateway)
- Modify: `src/room/types.ts`
  Responsibility: Add optional `connectionStatus` field to `RoomSourceSnapshot`
- Modify: `src/room/index.ts`
  Responsibility: Export `useRoomSource` and gateway types
- Modify: `src/App.tsx`
  Responsibility: Import `useRoomSource` instead of `useSeedRoomSource`
- Modify: `src/components/DemoControlPanel.tsx`
  Responsibility: Add connection status indicator for gateway mode

## Constraints

- All 48 existing tests must continue to pass unchanged
- `npm run build` must succeed with default `VITE_ROOM_SOURCE=seed`
- Seed source files (`useSeedRoomSource.ts`, `seedRoomSource.ts`) are NOT modified
- The gateway client must handle the full challenge/auth flow per OpenClaw 2026.3.8 protocol

## Protocol Errata (verified 2026-03-12 against gateway source)

These corrections were discovered by auditing the installed OpenClaw 2026.3.8 gateway binary (`gateway-cli-*.js`, `gateway-rpc-*.js`). All code in this plan already reflects these fixes.

1. **`hello-ok` is at `payload.type`, not `payload.event`** — The connect response is `{type:"res", ok:true, payload:{type:"hello-ok", protocol:3, ...}}`.
2. **Connect request needs `minProtocol`/`maxProtocol`** — Set both to `3`. Include a `client` object with `{id, version, platform, mode}`.
3. **Presence `mode` is freeform** — Known values: `"gateway"`, `"agent"`, `"operator"`, `"node"`, `"cli"`. Use substring match for agent detection, not strict equality.
4. **Presence fields are mostly optional** — Only `ts` is guaranteed. Use defensive access (`?.`) for all other fields. See updated `GatewayPresenceEntry` type.
5. **`"presence"` event exists** — The gateway broadcasts presence snapshots via `event:"presence"`. Polling `system-presence` works but event subscription is more efficient. Plan uses polling; future optimization can subscribe to the event.

---

## Chunk 1: Pure Gateway Logic (No React, No Network)

### Task 1: Gateway Types and Connection State Machine

**Files:**
- Create: `src/room/gateway/types.ts`
- Create: `src/room/gateway/connectionReducer.ts`
- Test: `src/room/gateway/connectionReducer.test.ts`

- [ ] **Step 1: Write the gateway types**

```ts
// src/room/gateway/types.ts
export type ConnectionState =
  | "idle"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type ConnectionEvent =
  | { type: "start" }
  | { type: "ws-open" }
  | { type: "auth-ok" }
  | { type: "auth-fail"; reason: string }
  | { type: "ws-close" }
  | { type: "ws-error" }
  | { type: "retry-exhausted" }
  | { type: "disconnect" };

export interface GatewayPresenceEntry {
  instanceId?: string;
  deviceId?: string;
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode?: string;          // freeform — known: "gateway", "agent", "operator", "node", "cli"
  lastInputSeconds?: number;
  reason?: string;
  roles?: string[];
  scopes?: string[];
  tags?: string[];
  text?: string;          // e.g. "Node: host (ip) · app ver · last input Xs ago · mode M · reason R"
  ts: number;
}

export interface GatewayMessage {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  ts: number;
}

export interface GatewayConfig {
  id: string;    // gateway identity, e.g. "local" — enables multi-gateway keying later
  url: string;
  token: string;
}

export interface AgentPresenceMapping {
  contestantId: string;
  name: string;
  teamIndex: number;
}

export type AgentPresenceMap = Record<string, AgentPresenceMapping>;

export type Unsubscribe = () => void;
```

- [ ] **Step 2: Write failing connection reducer tests**

```ts
// src/room/gateway/connectionReducer.test.ts
import { describe, expect, it } from "vitest";

import { reduceConnection } from "./connectionReducer";
import type { ConnectionState } from "./types";

describe("reduceConnection", () => {
  it("idle → connecting on start", () => {
    expect(reduceConnection("idle", { type: "start" })).toBe("connecting");
  });

  it("connecting → authenticating on ws-open", () => {
    expect(reduceConnection("connecting", { type: "ws-open" })).toBe("authenticating");
  });

  it("authenticating → connected on auth-ok", () => {
    expect(reduceConnection("authenticating", { type: "auth-ok" })).toBe("connected");
  });

  it("authenticating → disconnected on auth-fail", () => {
    expect(reduceConnection("authenticating", { type: "auth-fail", reason: "bad token" })).toBe("disconnected");
  });

  it("connected → reconnecting on ws-close", () => {
    expect(reduceConnection("connected", { type: "ws-close" })).toBe("reconnecting");
  });

  it("connected → disconnected on disconnect", () => {
    expect(reduceConnection("connected", { type: "disconnect" })).toBe("disconnected");
  });

  it("reconnecting → authenticating on ws-open", () => {
    expect(reduceConnection("reconnecting", { type: "ws-open" })).toBe("authenticating");
  });

  it("reconnecting → disconnected on retry-exhausted", () => {
    expect(reduceConnection("reconnecting", { type: "retry-exhausted" })).toBe("disconnected");
  });

  it("disconnected → connecting on start", () => {
    expect(reduceConnection("disconnected", { type: "start" })).toBe("connecting");
  });

  it("ws-error from connecting → reconnecting", () => {
    expect(reduceConnection("connecting", { type: "ws-error" })).toBe("reconnecting");
  });

  it("ws-error from connected → reconnecting", () => {
    expect(reduceConnection("connected", { type: "ws-error" })).toBe("reconnecting");
  });

  it("ws-error from authenticating → reconnecting", () => {
    expect(reduceConnection("authenticating", { type: "ws-error" })).toBe("reconnecting");
  });

  it("ws-close from connecting → reconnecting", () => {
    expect(reduceConnection("connecting", { type: "ws-close" })).toBe("reconnecting");
  });

  it("ws-close from authenticating → reconnecting", () => {
    expect(reduceConnection("authenticating", { type: "ws-close" })).toBe("reconnecting");
  });

  it("ignores unknown transitions", () => {
    expect(reduceConnection("idle", { type: "ws-open" })).toBe("idle");
    expect(reduceConnection("idle", { type: "auth-ok" })).toBe("idle");
    expect(reduceConnection("disconnected", { type: "ws-close" })).toBe("disconnected");
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

Run: `npm test -- src/room/gateway/connectionReducer.test.ts`
Expected: FAIL with module resolution error

- [ ] **Step 4: Implement the connection reducer**

```ts
// src/room/gateway/connectionReducer.ts
import type { ConnectionEvent, ConnectionState } from "./types";

const transitions: Record<ConnectionState, Partial<Record<ConnectionEvent["type"], ConnectionState>>> = {
  idle: { start: "connecting" },
  connecting: { "ws-open": "authenticating", "ws-close": "reconnecting", "ws-error": "reconnecting" },
  authenticating: { "auth-ok": "connected", "auth-fail": "disconnected", "ws-close": "reconnecting", "ws-error": "reconnecting" },
  connected: { "ws-close": "reconnecting", "ws-error": "reconnecting", disconnect: "disconnected" },
  reconnecting: { "ws-open": "authenticating", "retry-exhausted": "disconnected" },
  disconnected: { start: "connecting" },
};

export const reduceConnection = (
  state: ConnectionState,
  event: ConnectionEvent,
): ConnectionState => transitions[state][event.type] ?? state;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/room/gateway/connectionReducer.test.ts`
Expected: PASS with 15 passing tests

- [ ] **Step 6: Commit**

```bash
git add src/room/gateway/types.ts src/room/gateway/connectionReducer.ts src/room/gateway/connectionReducer.test.ts
git commit -m "feat: add gateway connection state machine"
```

### Task 2: Gateway Adapter — Presence and Message Mapping

**Files:**
- Create: `src/room/gateway/gatewayAdapter.ts`
- Test: `src/room/gateway/gatewayAdapter.test.ts`

- [ ] **Step 1: Write failing adapter tests**

```ts
// src/room/gateway/gatewayAdapter.test.ts
import { describe, expect, it } from "vitest";

import {
  classifyInteractionType,
  deriveContestantState,
  mapGatewayMessage,
  mapPresenceToContestantStates,
} from "./gatewayAdapter";
import type { GatewayPresenceEntry, AgentPresenceMap } from "./types";

const makePresence = (overrides: Partial<GatewayPresenceEntry> = {}): GatewayPresenceEntry => ({
  instanceId: "inst-1",
  deviceId: "dev-1",
  host: "localhost",
  version: "2026.3.8",
  deviceFamily: "cli",
  mode: "agent",
  lastInputSeconds: 5,
  text: "Node: localhost (127.0.0.1) · app 2026.3.8 · last input 5s ago · mode agent · reason heartbeat",
  ts: Date.now(),
  ...overrides,
});

describe("deriveContestantState", () => {
  it("0-10s → speaking", () => {
    expect(deriveContestantState(5)).toBe("speaking");
  });

  it("10-30s → raised-hand", () => {
    expect(deriveContestantState(15)).toBe("raised-hand");
  });

  it("30-120s → listening", () => {
    expect(deriveContestantState(60)).toBe("listening");
  });

  it("120s+ → muted", () => {
    expect(deriveContestantState(300)).toBe("muted");
  });

  it("boundary: exactly 10s → raised-hand", () => {
    expect(deriveContestantState(10)).toBe("raised-hand");
  });

  it("boundary: exactly 30s → listening", () => {
    expect(deriveContestantState(30)).toBe("listening");
  });

  it("boundary: exactly 120s → muted", () => {
    expect(deriveContestantState(120)).toBe("muted");
  });
});

describe("mapPresenceToContestantStates", () => {
  const contestantIds = ["c-1", "c-2", "c-3"];

  it("maps agent presences to contestants by ts order", () => {
    const presences = [
      makePresence({ instanceId: "b", ts: 200, lastInputSeconds: 5 }),
      makePresence({ instanceId: "a", ts: 100, lastInputSeconds: 60 }),
    ];

    const result = mapPresenceToContestantStates(presences, contestantIds, {});

    // sorted by ts: a (100) → c-1, b (200) → c-2
    expect(result.get("c-1")).toBe("listening");
    expect(result.get("c-2")).toBe("speaking");
    expect(result.get("c-3")).toBe("muted"); // no presence → muted
  });

  it("uses config map when provided", () => {
    const presences = [makePresence({ instanceId: "x", lastInputSeconds: 5 })];
    const configMap: AgentPresenceMap = {
      x: { contestantId: "c-3", name: "Test", teamIndex: 0 },
    };

    const result = mapPresenceToContestantStates(presences, contestantIds, configMap);

    expect(result.get("c-3")).toBe("speaking");
    expect(result.get("c-1")).toBe("muted"); // unmapped
  });

  it("filters out cli and gateway mode presences", () => {
    const presences = [
      makePresence({ mode: "cli", lastInputSeconds: 5 }),
      makePresence({ instanceId: "gw", mode: "gateway", lastInputSeconds: 0 }),
    ];
    const result = mapPresenceToContestantStates(presences, contestantIds, {});

    // cli and gateway filtered out, all contestants muted
    expect(result.get("c-1")).toBe("muted");
  });

  it("treats operator/node as listeners, not contestants", () => {
    const presences = [makePresence({ mode: "operator", lastInputSeconds: 5 })];
    const result = mapPresenceToContestantStates(presences, contestantIds, {});

    // operator doesn't map to a contestant
    expect(result.get("c-1")).toBe("muted");
  });
});

describe("classifyInteractionType", () => {
  it("classifies bet patterns", () => {
    expect(classifyInteractionType("下注 50 点")).toBe("bet");
    expect(classifyInteractionType("bet 100")).toBe("bet");
  });

  it("classifies positive as like", () => {
    expect(classifyInteractionType("👍")).toBe("like");
    expect(classifyInteractionType("太棒了")).toBe("like");
  });

  it("classifies negative as boo", () => {
    expect(classifyInteractionType("👎")).toBe("boo");
    expect(classifyInteractionType("不行")).toBe("boo");
  });

  it("defaults to danmaku", () => {
    expect(classifyInteractionType("随便说点什么")).toBe("danmaku");
  });
});

describe("mapGatewayMessage", () => {
  it("maps a gateway message to AudienceInteraction", () => {
    const result = mapGatewayMessage(
      { id: "msg-1", senderId: "user-1", senderName: "Alice", content: "好厉害", ts: 1710000000000 },
      "c-1",
    );

    expect(result.id).toBe("gw-msg-1");
    expect(result.contestantId).toBe("c-1");
    expect(result.source).toBe("Alice");
    expect(result.type).toBe("like");
    expect(result.amount).toBe(1);
  });

  it("uses senderId when senderName is null", () => {
    const result = mapGatewayMessage(
      { id: "msg-2", senderId: "user-2", senderName: null, content: "test", ts: 1710000000000 },
      "c-1",
    );

    expect(result.source).toBe("user-2");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- src/room/gateway/gatewayAdapter.test.ts`
Expected: FAIL with module resolution error

- [ ] **Step 3: Implement the gateway adapter**

```ts
// src/room/gateway/gatewayAdapter.ts
import type { AudienceInteraction, AudienceEventType, OpenClawContestantState } from "../../types";
import type { AgentPresenceMap, GatewayMessage, GatewayPresenceEntry } from "./types";

export const deriveContestantState = (lastInputSeconds: number | undefined): OpenClawContestantState => {
  if (lastInputSeconds === undefined) return "muted";
  if (lastInputSeconds < 10) return "speaking";
  if (lastInputSeconds < 30) return "raised-hand";
  if (lastInputSeconds < 120) return "listening";
  return "muted";
};

export const mapPresenceToContestantStates = (
  presences: GatewayPresenceEntry[],
  contestantIds: string[],
  configMap: AgentPresenceMap,
): Map<string, OpenClawContestantState> => {
  const stateMap = new Map<string, OpenClawContestantState>();

  // Default all contestants to muted
  for (const id of contestantIds) {
    stateMap.set(id, "muted");
  }

  // Filter to agent-mode presences only (mode is freeform; match substring)
  const isAgentMode = (mode?: string) => mode !== undefined && mode.includes("agent");
  const agentPresences = presences
    .filter((p) => isAgentMode(p.mode))
    .sort((a, b) => a.ts - b.ts);

  let autoIndex = 0;

  for (const presence of agentPresences) {
    const state = deriveContestantState(presence.lastInputSeconds);

    // Try config map first
    const mapped = configMap[presence.instanceId];
    if (mapped && contestantIds.includes(mapped.contestantId)) {
      stateMap.set(mapped.contestantId, state);
      continue;
    }

    // Auto-assign by order
    if (autoIndex < contestantIds.length) {
      stateMap.set(contestantIds[autoIndex], state);
      autoIndex++;
    }
  }

  return stateMap;
};

const BET_PATTERN = /(?:下注|bet|押注)\s*(\d+)/i;
const POSITIVE_PATTERNS = /👍|太棒|厉害|赞|好|nice|great|amazing|awesome/i;
const NEGATIVE_PATTERNS = /👎|不行|差|烂|bad|terrible|awful/i;

export const classifyInteractionType = (content: string): AudienceEventType => {
  if (BET_PATTERN.test(content)) return "bet";
  if (POSITIVE_PATTERNS.test(content)) return "like";
  if (NEGATIVE_PATTERNS.test(content)) return "boo";
  return "danmaku";
};

const extractBetAmount = (content: string): number => {
  const match = content.match(BET_PATTERN);
  return match ? parseInt(match[1], 10) : 1;
};

const formatTimestamp = (ts: number): string => {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export const mapGatewayMessage = (
  msg: GatewayMessage,
  contestantId: string,
): AudienceInteraction => ({
  id: `gw-${msg.id}`,
  contestantId,
  type: classifyInteractionType(msg.content),
  source: msg.senderName ?? msg.senderId,
  content: msg.content,
  amount: extractBetAmount(msg.content),
  timestampLabel: formatTimestamp(msg.ts),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/room/gateway/gatewayAdapter.test.ts`
Expected: PASS with all adapter tests green

- [ ] **Step 5: Commit**

```bash
git add src/room/gateway/gatewayAdapter.ts src/room/gateway/gatewayAdapter.test.ts
git commit -m "feat: add gateway presence and message adapter"
```

### Task 3: Gateway Client — WebSocket, Auth, Presence Polling

**Files:**
- Create: `src/room/gateway/OpenClawGatewayClient.ts`
- Test: `src/room/gateway/OpenClawGatewayClient.test.ts`
- Create: `src/room/gateway/index.ts`

- [ ] **Step 1: Write failing client tests**

```ts
// src/room/gateway/OpenClawGatewayClient.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenClawGatewayClient } from "./OpenClawGatewayClient";
import type { ConnectionState } from "./types";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  triggerOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1000 });
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }
}

describe("OpenClawGatewayClient", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in idle state", () => {
    const client = new OpenClawGatewayClient({ url: "ws://localhost:18789", token: "test-token" });
    expect(client.getConnectionState()).toBe("idle");
    client.destroy();
  });

  it("transitions to connecting on connect()", async () => {
    const client = new OpenClawGatewayClient({ url: "ws://localhost:18789", token: "test-token" });
    const states: ConnectionState[] = [];
    client.on("connection-change", (s) => states.push(s));

    client.connect();
    expect(client.getConnectionState()).toBe("connecting");

    client.destroy();
  });

  it("responds to challenge with auth token", () => {
    const client = new OpenClawGatewayClient({ url: "ws://localhost:18789", token: "my-token" });
    client.connect();

    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();

    // Simulate challenge
    ws.simulateMessage({
      type: "event",
      event: "connect.challenge",
      payload: { nonce: "abc123", ts: Date.now() },
    });

    // Client should have sent a connect request
    expect(ws.sent.length).toBeGreaterThan(0);
    const sent = JSON.parse(ws.sent[0]);
    expect(sent.type).toBe("req");
    expect(sent.method).toBe("connect");
    expect(sent.params.auth.token).toBe("my-token");

    client.destroy();
  });

  it("transitions to connected on hello-ok", () => {
    const client = new OpenClawGatewayClient({ url: "ws://localhost:18789", token: "test-token" });
    const states: ConnectionState[] = [];
    client.on("connection-change", (s) => states.push(s));

    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();

    // Challenge → connect → hello-ok
    ws.simulateMessage({ type: "event", event: "connect.challenge", payload: { nonce: "n", ts: 1 } });
    const connectReqId = JSON.parse(ws.sent[0]).id;
    ws.simulateMessage({ type: "res", id: connectReqId, ok: true, payload: { type: "hello-ok", protocol: 3 } });

    expect(client.getConnectionState()).toBe("connected");

    client.destroy();
  });

  it("cleans up on destroy", () => {
    const client = new OpenClawGatewayClient({ url: "ws://localhost:18789", token: "test-token" });
    client.connect();
    client.destroy();
    // Should not throw
    expect(client.getConnectionState()).toBe("idle");
  });

  it("emits auth-error on auth failure", () => {
    const client = new OpenClawGatewayClient({ url: "ws://localhost:18789", token: "bad-token" });
    let authError: string | null = null;
    client.on("auth-error", (reason) => { authError = reason; });

    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();

    ws.simulateMessage({ type: "event", event: "connect.challenge", payload: { nonce: "n", ts: 1 } });
    const connectReqId = JSON.parse(ws.sent[0]).id;
    ws.simulateMessage({ type: "res", id: connectReqId, ok: false, error: "invalid token" });

    expect(client.getConnectionState()).toBe("disconnected");
    expect(authError).toBe("invalid token");

    client.destroy();
  });

  it("reconnects after unexpected close with backoff", () => {
    vi.useFakeTimers();
    const client = new OpenClawGatewayClient({ url: "ws://localhost:18789", token: "test-token" });
    client.connect();
    const ws1 = MockWebSocket.instances[0];
    ws1.triggerOpen();

    // Authenticate
    ws1.simulateMessage({ type: "event", event: "connect.challenge", payload: { nonce: "n", ts: 1 } });
    const reqId = JSON.parse(ws1.sent[0]).id;
    ws1.simulateMessage({ type: "res", id: reqId, ok: true, payload: { event: "hello-ok" } });
    expect(client.getConnectionState()).toBe("connected");

    // Simulate unexpected close
    ws1.onclose?.({ code: 1006 });
    expect(client.getConnectionState()).toBe("reconnecting");

    // 1st retry after 1s backoff
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances.length).toBe(2);

    client.destroy();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- src/room/gateway/OpenClawGatewayClient.test.ts`
Expected: FAIL with module resolution error

- [ ] **Step 3: Implement the gateway client**

```ts
// src/room/gateway/OpenClawGatewayClient.ts
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
```

- [ ] **Step 4: Write the barrel exports**

```ts
// src/room/gateway/index.ts
export { OpenClawGatewayClient } from "./OpenClawGatewayClient";
export { reduceConnection } from "./connectionReducer";
export {
  classifyInteractionType,
  deriveContestantState,
  mapGatewayMessage,
  mapPresenceToContestantStates,
} from "./gatewayAdapter";
export type {
  AgentPresenceMap,
  AgentPresenceMapping,
  ConnectionEvent,
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
  GatewayPresenceEntry,
  Unsubscribe,
} from "./types";
```

- [ ] **Step 5: Run all gateway tests**

Run: `npm test -- src/room/gateway/`
Expected: PASS for connectionReducer, gatewayAdapter, and OpenClawGatewayClient

- [ ] **Step 6: Commit**

```bash
git add src/room/gateway/
git commit -m "feat: add OpenClaw gateway WebSocket client"
```

## Chunk 2: React Integration and App Wiring

### Task 4: Gateway Room Source Hook

**Files:**
- Create: `src/room/useGatewayRoomSource.ts`
- Modify: `src/room/types.ts`

- [ ] **Step 1: Add connectionStatus to RoomSourceSnapshot**

Add the optional field to `src/room/types.ts`:

```ts
// In RoomSourceSnapshot interface, add after currentUserMode:
  connectionStatus?: import("./gateway/types").ConnectionState;
```

- [ ] **Step 2: Implement useGatewayRoomSource**

```ts
// src/room/useGatewayRoomSource.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveConversationState } from "./deriveConversationState";
import { buildRoomViewModel } from "./buildRoomViewModel";
import { buildRoomDirectory } from "./rooms";
import {
  OpenClawGatewayClient,
  mapPresenceToContestantStates,
  mapGatewayMessage,
} from "./gateway";
import type {
  AudioMode,
  RoomActionApi,
  RoomSourceSnapshot,
  SeedRoomSourceInputs,
  SeedRoomSourceResult,
  ScenarioOverride,
} from "./types";
import type { ConnectionState, GatewayConfig, GatewayPresenceEntry } from "./gateway/types";
import type { AudienceInteraction, OpenClawContestantState } from "../types";

const ZERO_PRESENCE_CALLOUT = "Waiting for gateway connections...";
const AUTH_FAIL_CALLOUT = "Gateway authentication failed. Check VITE_OPENCLAW_TOKEN.";

export const useGatewayRoomSource = (
  inputs: SeedRoomSourceInputs,
  config: GatewayConfig,
): SeedRoomSourceResult => {
  const clientRef = useRef<OpenClawGatewayClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>("idle");
  const [presences, setPresences] = useState<GatewayPresenceEntry[]>([]);
  const [interactions, setInteractions] = useState<AudienceInteraction[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState("main-stage");
  const [audioMode, setAudioMode] = useState<AudioMode>("nearby");
  const [feedPaused, setFeedPaused] = useState(false);
  const [scenarioOverride, setScenarioOverride] = useState<ScenarioOverride>({ type: "none" });
  const [currentUserMode, setCurrentUserMode] = useState<"perimeter" | "listening">("perimeter");
  const [authFailed, setAuthFailed] = useState(false);
  const feedPausedRef = useRef(feedPaused);
  feedPausedRef.current = feedPaused;
  const contestantDeckRef = useRef(inputs.contestantDeck);
  contestantDeckRef.current = inputs.contestantDeck;

  // Connect on mount
  useEffect(() => {
    setAuthFailed(false); // reset on config change

    const client = new OpenClawGatewayClient(config);
    clientRef.current = client;

    client.on("connection-change", (state) => {
      setConnectionStatus(state);
      if (state === "connected") {
        setAuthFailed(false);
      }
    });

    client.on("auth-error", () => {
      setAuthFailed(true);
    });

    client.on("presence", (entries) => {
      setPresences(entries);
    });

    client.on("message", (msg) => {
      if (feedPausedRef.current) return;
      const contestantIds = contestantDeckRef.current.map((c) => c.id);
      const contestantId = contestantIds[0] ?? "unknown";
      const interaction = mapGatewayMessage(msg, contestantId);
      setInteractions((prev) => [...prev, interaction]);
    });

    client.connect();

    return () => {
      client.destroy();
      clientRef.current = null;
    };
  }, [config.id, config.url, config.token]);

  // Derive contestant states from presence data
  const contestantStateMap = useMemo(() => {
    const contestantIds = inputs.contestantDeck.map((c) => c.id);
    return mapPresenceToContestantStates(presences, contestantIds, {});
  }, [presences, inputs.contestantDeck]);

  const hasAgentPresences = useMemo(
    () => presences.some((p) => p.mode === "agent"),
    [presences],
  );

  // Build conversation state
  const stageConversation = useMemo(() => {
    const orderedContestantIds = inputs.contestantDeck.map((c) => c.id);
    const focusIds = inputs.focusTeam.members.map((m) => m.id);
    const championTeam = inputs.teams.find(
      (team) => team.id === inputs.aiResults.summaries[0]?.teamId,
    );
    const championIds = championTeam?.members.map((m) => m.id) ?? [];
    const stageFocusTeamName =
      inputs.activeStageId === "act-8" && championIds.length > 0
        ? (championTeam?.name ?? inputs.focusTeam.name)
        : inputs.focusTeam.name;

    return deriveConversationState({
      activeStageId: inputs.activeStageId,
      activeStageTitle: inputs.activeStageTitle,
      orderedContestantIds,
      focusIds,
      championIds,
      leadingContestantId: inputs.audienceSummary.leadingContestantId ?? null,
      defaultSpeakerId: focusIds[0] ?? orderedContestantIds[0] ?? null,
      selectedContestantId: inputs.selectedContestantId,
      focusTeamName: stageFocusTeamName,
      focusHeadline: inputs.focusHeadline,
      nearbyHint: inputs.nearbyHint,
      contestantNameById: inputs.contestantNameById,
      priorityContestantId: null,
    });
  }, [inputs]);

  // Build room directory
  const roomDirectory = useMemo(
    () =>
      buildRoomDirectory({
        currentRoomId,
        conversationState: stageConversation,
        teams: inputs.teams,
        orderedContestantIds: inputs.contestantDeck.map((c) => c.id),
        listenerEntityIds: inputs.listenerEntityIds,
      }),
    [currentRoomId, stageConversation, inputs.teams, inputs.contestantDeck, inputs.listenerEntityIds],
  );

  // Build room view model with gateway-derived overrides
  const roomViewModel = useMemo(() => {
    const model = buildRoomViewModel({
      conversationState: stageConversation,
      orderedContestantIds: inputs.contestantDeck.map((c) => c.id),
      interactions,
      audioMode,
      nearbyHint: inputs.nearbyHint,
      contestantNameById: inputs.contestantNameById,
      scenarioOverride,
      currentRoomId,
    });

    // Override seat states from gateway presence
    const overriddenSeats = model.openClawSeats.map((seat) => ({
      ...seat,
      state: contestantStateMap.get(seat.id) ?? seat.state,
    }));

    // Override callout for connection issues
    let callout = model.roomCallout;
    if (authFailed) {
      callout = AUTH_FAIL_CALLOUT;
    } else if (connectionStatus === "connected" && !hasAgentPresences) {
      callout = ZERO_PRESENCE_CALLOUT;
    } else if (connectionStatus === "connecting" || connectionStatus === "reconnecting") {
      callout = `Connecting to gateway (${connectionStatus})...`;
    }

    return { ...model, openClawSeats: overriddenSeats, roomCallout: callout };
  }, [
    stageConversation, inputs, interactions, audioMode,
    scenarioOverride, currentRoomId, contestantStateMap,
    connectionStatus, hasAgentPresences, authFailed,
  ]);

  // Build snapshot
  const snapshot: RoomSourceSnapshot = useMemo(
    () => ({
      activeStageId: inputs.activeStageId,
      currentRoomId,
      selectedContestantId: inputs.selectedContestantId,
      audioMode,
      feedPaused,
      interactions,
      priorityContestantId: null,
      scenarioOverride,
      currentUserMode,
      connectionStatus,
    }),
    [inputs.activeStageId, currentRoomId, inputs.selectedContestantId, audioMode, feedPaused, interactions, scenarioOverride, currentUserMode, connectionStatus],
  );

  // Actions
  const actions: RoomActionApi = useMemo(
    () => ({
      switchRoom: (roomId: string) => setCurrentRoomId(roomId),
      joinConversation: () => setCurrentUserMode("listening"),
      leaveConversation: () => setCurrentUserMode("perimeter"),
      setAudioMode: (mode: AudioMode) => setAudioMode(mode),
      toggleFeedPaused: () => setFeedPaused((p) => !p),
      injectScenario: (scenario: string, targetRoomId?: string) => {
        if (scenario === "none") {
          setScenarioOverride({ type: "none" });
        } else if (scenario === "quiet-room" || scenario === "empty-room") {
          setScenarioOverride({ type: scenario, targetRoomId: targetRoomId ?? currentRoomId });
        }
      },
      resetDemo: () => {
        setCurrentRoomId("main-stage");
        setAudioMode("nearby");
        setFeedPaused(false);
        setScenarioOverride({ type: "none" });
        setCurrentUserMode("perimeter");
        setInteractions([]);
      },
      setActiveStageId: () => {},
      setSelectedContestantId: () => {},
      setPriorityContestantId: () => {},
    }),
    [currentRoomId],
  );

  return { snapshot, roomDirectory, roomViewModel, actions };
};
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `npm test`
Expected: All 48 existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/room/useGatewayRoomSource.ts src/room/types.ts
git commit -m "feat: add gateway room source hook"
```

### Task 5: Unified Hook and App Wiring

**Files:**
- Create: `src/room/useRoomSource.ts`
- Modify: `src/room/index.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the unified hook**

```ts
// src/room/useRoomSource.ts
import type { SeedRoomSourceInputs, SeedRoomSourceResult } from "./types";
import { useSeedRoomSource } from "./useSeedRoomSource";
import { useGatewayRoomSource } from "./useGatewayRoomSource";

const ROOM_MODE = (import.meta.env.VITE_ROOM_SOURCE ?? "seed") as "seed" | "gateway";
const GATEWAY_URL = (import.meta.env.VITE_OPENCLAW_URL as string) ?? "ws://localhost:18789";
const GATEWAY_TOKEN = (import.meta.env.VITE_OPENCLAW_TOKEN as string) ?? "";

export const useRoomSource: (inputs: SeedRoomSourceInputs) => SeedRoomSourceResult =
  ROOM_MODE === "gateway"
    ? (inputs) => useGatewayRoomSource(inputs, { id: "local", url: GATEWAY_URL, token: GATEWAY_TOKEN })
    : useSeedRoomSource;
```

- [ ] **Step 2: Update barrel exports**

In `src/room/index.ts`, add:

```ts
export { useRoomSource } from "./useRoomSource";
```

- [ ] **Step 3: Wire App.tsx to use useRoomSource**

In `src/App.tsx`, change:
```diff
-import { useSeedRoomSource } from "./room";
+import { useRoomSource } from "./room";
```

And:
```diff
-const { snapshot, roomDirectory, roomViewModel, actions } = useSeedRoomSource(hookInputs);
+const { snapshot, roomDirectory, roomViewModel, actions } = useRoomSource(hookInputs);
```

- [ ] **Step 4: Run full test suite and build**

Run: `npm test && npm run build`
Expected: All 48 tests PASS, production build succeeds (with default seed mode)

- [ ] **Step 5: Commit**

```bash
git add src/room/useRoomSource.ts src/room/index.ts src/App.tsx
git commit -m "feat: wire unified room source with build-time mode switching"
```

### Task 6: DemoControlPanel Connection Indicator

**Files:**
- Modify: `src/components/DemoControlPanel.tsx`

- [ ] **Step 1: Add connectionStatus prop and indicator**

In `DemoControlPanel.tsx`, add an optional `connectionStatus` prop. When present, render a small status indicator at the top of the panel.

```ts
// Add to imports:
import type { ConnectionState } from "../room/gateway/types";

// Add to DemoControlPanelProps:
  connectionStatus?: ConnectionState;

// Add to the component body, at the top of the return, inside demo-control-panel div:
{connectionStatus && (
  <span className={`connection-status connection-status--${connectionStatus}`}>
    {connectionStatus === "connected" ? "● Gateway" : connectionStatus === "connecting" || connectionStatus === "reconnecting" ? "◌ Connecting" : "○ Offline"}
  </span>
)}
```

- [ ] **Step 2: Wire the prop in App.tsx**

In `src/App.tsx`, pass `connectionStatus` to `DemoControlPanel`:

```diff
<DemoControlPanel
  currentRoomId={snapshot.currentRoomId}
  audioMode={snapshot.audioMode}
  feedPaused={snapshot.feedPaused}
+ connectionStatus={snapshot.connectionStatus}
  roomSwitchTargets={...}
```

- [ ] **Step 3: Run tests and build**

Run: `npm test && npm run build`
Expected: All tests PASS, build succeeds. The connectionStatus prop is optional so existing tests don't break.

- [ ] **Step 4: Commit**

```bash
git add src/components/DemoControlPanel.tsx src/App.tsx
git commit -m "feat: add gateway connection indicator to control panel"
```

## Done Criteria

- `VITE_ROOM_SOURCE=seed npm run build` succeeds (default, no changes to current behavior)
- `VITE_ROOM_SOURCE=gateway npm run build` succeeds
- All existing 48 tests pass unchanged
- New tests: ~30 tests for connectionReducer, gatewayAdapter, OpenClawGatewayClient
- Gateway client connects to `openclaw gateway run`, authenticates, polls presence
- Presence entries map to contestant states (speaking/listening/muted)
- `useRoomSource` selects the correct hook based on build-time env var
- Connection status visible in DemoControlPanel when in gateway mode

## Risks To Watch

- The gateway challenge/auth flow has been verified against 2026.3.8 source. If a future gateway version changes the connect handshake, inspect the actual challenge frame and adjust `sendConnectRequest()`.
- Presence polling at 3s may be too aggressive for production. The interval is a static constant in `OpenClawGatewayClient` — easy to tune. Better: subscribe to the `"presence"` gateway event.
- The `system-presence` response contains many optional fields. The `GatewayPresenceEntry` type uses optional fields — only destructure what we need.
- Gateway self-presence (mode `"gateway"`) must be filtered out to avoid mapping the gateway itself as a contestant.

## Handoff Notes

- Manual E2E testing requires `openclaw gateway run` in a separate terminal
- Get the gateway token from `~/.openclaw/openclaw.json` → `gateway.auth.token`
- To simulate multiple users: `openclaw agents add --name "contestant-N"` for each contestant
- The gateway adapter does NOT replace the seed source — both coexist
