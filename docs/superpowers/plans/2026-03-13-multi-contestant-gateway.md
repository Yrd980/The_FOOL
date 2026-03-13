# Multi-Contestant OpenClaw Gateway Implementation Plan

> **Status:** Completed (2026-03-13)

**Goal:** Extend the gateway-adapter to support 20 OpenClaw contestants via agent-id registry and dual-RPC polling (system-presence + status).

**Architecture:** The existing `OpenClawGatewayClient` gains a second polling loop for the `status` RPC. Contestant identification switches from presence `mode` substring matching to an agent-id registry that maps `agentId` → contestant slot. The `useGatewayRoomSource` hook merges sessions data into the existing derivation pipeline. All downstream types and components remain unchanged.

**Tech Stack:** TypeScript, React 19, Vitest, Vite 7

**Spec:** `docs/superpowers/specs/2026-03-13-multi-contestant-gateway-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/room/gateway/agentRegistry.ts` | `ContestantRegistration` type, `AgentRegistry` type, `DEFAULT_REGISTRY`, `lookupContestant()` |
| Create | `src/room/gateway/agentRegistry.test.ts` | Registry lookup tests |
| Modify | `src/room/gateway/types.ts` | Add `GatewaySessionEntry`, `GatewayStatusResponse`. Remove `AgentPresenceMapping`, `AgentPresenceMap`. |
| Modify | `src/room/gateway/gatewayAdapter.ts` | Replace `deriveContestantState` + `mapPresenceToContestantStates` with `deriveContestantStateFromSession` + `mapSessionsToContestantStates`. Keep interaction functions. |
| Modify | `src/room/gateway/gatewayAdapter.test.ts` | Replace presence-based tests with session-based tests. Keep interaction tests. |
| Modify | `src/room/gateway/OpenClawGatewayClient.ts` | Add `"status"` event, `STATUS_INTERVAL_MS`, `statusTimer`, `startStatusPolling()`, `stopStatusPolling()`. |
| Modify | `src/room/gateway/OpenClawGatewayClient.test.ts` | Add status polling test. |
| Modify | `src/room/gateway/index.ts` | Update exports. |
| Modify | `src/room/useGatewayRoomSource.ts` | Add `sessions` state, subscribe to `"status"` event, replace `contestantStateMap` derivation, replace `hasAgentPresences` with `connectedClientCount`. |

---

## Chunk 1: Agent Registry + Types

### Task 1: Create agent registry with tests

**Files:**
- Create: `src/room/gateway/agentRegistry.ts`
- Create: `src/room/gateway/agentRegistry.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/room/gateway/agentRegistry.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { DEFAULT_REGISTRY, lookupContestant } from "./agentRegistry";
import type { AgentRegistry } from "./agentRegistry";

describe("DEFAULT_REGISTRY", () => {
  it("has 20 entries", () => {
    expect(DEFAULT_REGISTRY).toHaveLength(20);
  });

  it("has zero-padded agentIds", () => {
    expect(DEFAULT_REGISTRY[0].agentId).toBe("contestant-01");
    expect(DEFAULT_REGISTRY[19].agentId).toBe("contestant-20");
  });

  it("has sequential slots 1-20", () => {
    expect(DEFAULT_REGISTRY.map((r) => r.slot)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });
});

describe("lookupContestant", () => {
  const registry: AgentRegistry = [
    { agentId: "contestant-01", contestantId: "c-01", displayName: "Alpha", slot: 1 },
    { agentId: "contestant-02", contestantId: "c-02", displayName: "Beta", slot: 2 },
  ];

  it("finds a registered agent", () => {
    expect(lookupContestant(registry, "contestant-01")).toEqual(registry[0]);
  });

  it("returns undefined for unknown agent", () => {
    expect(lookupContestant(registry, "contestant-99")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/yrd/projects/The_FOOL/gateway-adapter && npx vitest run src/room/gateway/agentRegistry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

In `src/room/gateway/agentRegistry.ts`:

```typescript
export interface ContestantRegistration {
  agentId: string;
  contestantId: string;
  displayName: string;
  slot: number;
}

export type AgentRegistry = ContestantRegistration[];

export const DEFAULT_REGISTRY: AgentRegistry = Array.from({ length: 20 }, (_, i) => ({
  agentId: `contestant-${String(i + 1).padStart(2, "0")}`,
  contestantId: `c-${String(i + 1).padStart(2, "0")}`,
  displayName: `Contestant ${i + 1}`,
  slot: i + 1,
}));

export const lookupContestant = (
  registry: AgentRegistry,
  agentId: string,
): ContestantRegistration | undefined =>
  registry.find((r) => r.agentId === agentId);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/yrd/projects/The_FOOL/gateway-adapter && npx vitest run src/room/gateway/agentRegistry.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/yrd/projects/The_FOOL/gateway-adapter
git add src/room/gateway/agentRegistry.ts src/room/gateway/agentRegistry.test.ts
git commit -m "feat: add agent registry for multi-contestant mapping"
```

---

## Chunk 2: Types + Gateway Adapter Functions

### Task 2: Update types and replace adapter functions with session-based versions

Types and adapter are changed together in one commit to avoid intermediate broken state (removing `AgentPresenceMap` breaks imports until the adapter is updated).

**Files:**
- Modify: `src/room/gateway/types.ts`
- Modify: `src/room/gateway/gatewayAdapter.ts`
- Modify: `src/room/gateway/gatewayAdapter.test.ts`

- [ ] **Step 1: Update types — add `GatewaySessionEntry` and `GatewayStatusResponse`, remove `AgentPresenceMapping` / `AgentPresenceMap`**

In `src/room/gateway/types.ts`, replace `AgentPresenceMapping`, `AgentPresenceMap` (lines 52-58) with:

```typescript
export interface GatewaySessionEntry {
  agentId: string;
  key: string;
  kind: string;
  updatedAt: number;
  abortedLastRun: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  modelProvider: string;
  contextTokens: number;
}

export interface GatewayStatusResponse {
  sessions: {
    recent: GatewaySessionEntry[];
  };
}
```

Keep all other types unchanged.

- [ ] **Step 2: Write the failing tests for new adapter functions**

Replace the `deriveContestantState` and `mapPresenceToContestantStates` describe blocks in `src/room/gateway/gatewayAdapter.test.ts` with:

```typescript
import { describe, expect, it, vi } from "vitest";

import {
  classifyInteractionType,
  deriveContestantStateFromSession,
  mapGatewayMessage,
  mapSessionsToContestantStates,
} from "./gatewayAdapter";
import type { GatewaySessionEntry } from "./types";
import type { AgentRegistry } from "./agentRegistry";

const makeSession = (overrides: Partial<GatewaySessionEntry> = {}): GatewaySessionEntry => ({
  agentId: "contestant-01",
  key: "agent:contestant-01:main",
  kind: "direct",
  updatedAt: Date.now(),
  abortedLastRun: false,
  inputTokens: 3,
  outputTokens: 5,
  totalTokens: 12000,
  model: "claude-opus-4-6",
  modelProvider: "anthropic",
  contextTokens: 200000,
  ...overrides,
});

describe("deriveContestantStateFromSession", () => {
  it("undefined session → muted", () => {
    expect(deriveContestantStateFromSession(undefined)).toBe("muted");
  });

  it("< 10s idle → speaking", () => {
    const session = makeSession({ updatedAt: Date.now() - 5_000 });
    expect(deriveContestantStateFromSession(session)).toBe("speaking");
  });

  it("10-30s idle → raised-hand", () => {
    const session = makeSession({ updatedAt: Date.now() - 15_000 });
    expect(deriveContestantStateFromSession(session)).toBe("raised-hand");
  });

  it("30-120s idle → listening", () => {
    const session = makeSession({ updatedAt: Date.now() - 60_000 });
    expect(deriveContestantStateFromSession(session)).toBe("listening");
  });

  it("120s+ idle → muted", () => {
    const session = makeSession({ updatedAt: Date.now() - 300_000 });
    expect(deriveContestantStateFromSession(session)).toBe("muted");
  });

  it("abortedLastRun + very recent (< 10s) → raised-hand (not speaking)", () => {
    const session = makeSession({ abortedLastRun: true, updatedAt: Date.now() - 5_000 });
    expect(deriveContestantStateFromSession(session)).toBe("raised-hand");
  });

  it("abortedLastRun + recent (< 30s) → raised-hand", () => {
    const session = makeSession({ abortedLastRun: true, updatedAt: Date.now() - 15_000 });
    expect(deriveContestantStateFromSession(session)).toBe("raised-hand");
  });

  it("abortedLastRun + stale (>= 30s) → muted", () => {
    const session = makeSession({ abortedLastRun: true, updatedAt: Date.now() - 60_000 });
    expect(deriveContestantStateFromSession(session)).toBe("muted");
  });

  it("boundary: exactly 10s → raised-hand", () => {
    const session = makeSession({ updatedAt: Date.now() - 10_000 });
    expect(deriveContestantStateFromSession(session)).toBe("raised-hand");
  });

  it("boundary: exactly 30s → listening", () => {
    const session = makeSession({ updatedAt: Date.now() - 30_000 });
    expect(deriveContestantStateFromSession(session)).toBe("listening");
  });

  it("boundary: exactly 120s → muted", () => {
    const session = makeSession({ updatedAt: Date.now() - 120_000 });
    expect(deriveContestantStateFromSession(session)).toBe("muted");
  });
});

describe("mapSessionsToContestantStates", () => {
  const registry: AgentRegistry = [
    { agentId: "contestant-01", contestantId: "c-1", displayName: "Alpha", slot: 1 },
    { agentId: "contestant-02", contestantId: "c-2", displayName: "Beta", slot: 2 },
    { agentId: "contestant-03", contestantId: "c-3", displayName: "Gamma", slot: 3 },
  ];
  const contestantIds = ["c-1", "c-2", "c-3"];

  it("maps sessions to contestant states via registry", () => {
    const sessions = [
      makeSession({ agentId: "contestant-01", updatedAt: Date.now() - 5_000 }),
      makeSession({ agentId: "contestant-02", updatedAt: Date.now() - 60_000 }),
    ];

    const result = mapSessionsToContestantStates(sessions, registry, contestantIds);

    expect(result.get("c-1")).toBe("speaking");
    expect(result.get("c-2")).toBe("listening");
    expect(result.get("c-3")).toBe("muted"); // no session
  });

  it("ignores sessions not in registry", () => {
    const sessions = [
      makeSession({ agentId: "unknown-agent", updatedAt: Date.now() }),
    ];

    const result = mapSessionsToContestantStates(sessions, registry, contestantIds);

    expect(result.get("c-1")).toBe("muted");
    expect(result.get("c-2")).toBe("muted");
    expect(result.get("c-3")).toBe("muted");
  });

  it("defaults all contestants to muted with empty sessions", () => {
    const result = mapSessionsToContestantStates([], registry, contestantIds);

    for (const id of contestantIds) {
      expect(result.get(id)).toBe("muted");
    }
  });
});
```

Keep the existing `classifyInteractionType` and `mapGatewayMessage` describe blocks unchanged.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /home/yrd/projects/The_FOOL/gateway-adapter && npx vitest run src/room/gateway/gatewayAdapter.test.ts`
Expected: FAIL — `deriveContestantStateFromSession` and `mapSessionsToContestantStates` not found

- [ ] **Step 4: Write the implementation**

Replace the top section of `src/room/gateway/gatewayAdapter.ts` (lines 1-50, the `deriveContestantState` and `mapPresenceToContestantStates` functions and their imports) with:

```typescript
import type { AudienceInteraction, AudienceEventType, OpenClawContestantState } from "../../types";
import type { GatewayMessage, GatewaySessionEntry } from "./types";
import type { AgentRegistry } from "./agentRegistry";
import { lookupContestant } from "./agentRegistry";

export const deriveContestantStateFromSession = (
  session: GatewaySessionEntry | undefined,
): OpenClawContestantState => {
  if (!session) return "muted";

  const idleMs = Date.now() - session.updatedAt;

  // Aborted runs: recent aborts show as raised-hand (needs attention),
  // stale aborts fade to muted (likely already retried/resolved)
  if (session.abortedLastRun) {
    return idleMs < 30_000 ? "raised-hand" : "muted";
  }

  if (idleMs < 10_000) return "speaking";
  if (idleMs < 30_000) return "raised-hand";
  if (idleMs < 120_000) return "listening";
  return "muted";
};

export const mapSessionsToContestantStates = (
  sessions: GatewaySessionEntry[],
  registry: AgentRegistry,
  contestantIds: string[],
): Map<string, OpenClawContestantState> => {
  const stateMap = new Map<string, OpenClawContestantState>();

  // Default all contestants to muted
  for (const id of contestantIds) {
    stateMap.set(id, "muted");
  }

  for (const session of sessions) {
    const registration = lookupContestant(registry, session.agentId);
    if (!registration || !contestantIds.includes(registration.contestantId)) continue;

    stateMap.set(registration.contestantId, deriveContestantStateFromSession(session));
  }

  return stateMap;
};
```

Keep `classifyInteractionType`, `extractBetAmount`, `formatTimestamp`, and `mapGatewayMessage` exactly as they are (lines 52-85).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/yrd/projects/The_FOOL/gateway-adapter && npx vitest run src/room/gateway/gatewayAdapter.test.ts`
Expected: PASS (all tests including interaction tests)

- [ ] **Step 6: Commit types + adapter together**

```bash
cd /home/yrd/projects/The_FOOL/gateway-adapter
git add src/room/gateway/types.ts src/room/gateway/gatewayAdapter.ts src/room/gateway/gatewayAdapter.test.ts
git commit -m "feat: replace presence-based mapping with session-based contestant states"
```

---

## Chunk 3: Status Polling in Gateway Client

### Task 4: Add status RPC polling to OpenClawGatewayClient

**Files:**
- Modify: `src/room/gateway/OpenClawGatewayClient.ts`
- Modify: `src/room/gateway/OpenClawGatewayClient.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the end of the `describe("OpenClawGatewayClient")` block in `src/room/gateway/OpenClawGatewayClient.test.ts`:

```typescript
  it("polls status after authentication", () => {
    vi.useFakeTimers();
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "test-token" });

    const statusEvents: unknown[] = [];
    client.on("status", (entries) => statusEvents.push(entries));

    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();

    // Authenticate
    ws.simulateMessage({ type: "event", event: "connect.challenge", payload: { nonce: "n", ts: 1 } });
    const reqId = JSON.parse(ws.sent[0]).id;
    ws.simulateMessage({ type: "res", id: reqId, ok: true, payload: { type: "hello-ok" } });

    // After auth, client should have sent a status RPC
    const statusReq = ws.sent.find((s) => {
      const parsed = JSON.parse(s);
      return parsed.method === "status";
    });
    expect(statusReq).toBeDefined();

    // Simulate status response
    const statusReqId = JSON.parse(statusReq!).id;
    ws.simulateMessage({
      type: "res",
      id: statusReqId,
      ok: true,
      payload: {
        sessions: {
          recent: [
            { agentId: "contestant-01", key: "agent:contestant-01:main", kind: "direct", updatedAt: Date.now(), abortedLastRun: false, inputTokens: 3, outputTokens: 5, totalTokens: 12000, model: "claude-opus-4-6", modelProvider: "anthropic", contextTokens: 200000 },
          ],
        },
      },
    });

    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0]).toHaveLength(1);

    client.destroy();
    vi.useRealTimers();
  });
```

Also add the import for `GatewaySessionEntry` at the top:

```typescript
import type { ConnectionState, GatewaySessionEntry } from "./types";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/yrd/projects/The_FOOL/gateway-adapter && npx vitest run src/room/gateway/OpenClawGatewayClient.test.ts`
Expected: FAIL — `"status"` event not recognized / no status RPC sent

- [ ] **Step 3: Implement status polling**

In `src/room/gateway/OpenClawGatewayClient.ts`:

**3a.** Add `GatewaySessionEntry` and `GatewayStatusResponse` to imports from `./types`:

```typescript
import type {
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
  GatewayPresenceEntry,
  GatewaySessionEntry,
  GatewayStatusResponse,
  Unsubscribe,
} from "./types";
```

**3b.** Add `"status"` to `EventMap`:

```typescript
type EventMap = {
  "connection-change": ConnectionState;
  "auth-error": string;
  presence: GatewayPresenceEntry[];
  message: GatewayMessage;
  status: GatewaySessionEntry[];
};
```

**3c.** Add class fields after `presenceTimer`:

```typescript
  private statusTimer: ReturnType<typeof setInterval> | null = null;
```

**3d.** Add constant after `PRESENCE_INTERVAL_MS`:

```typescript
  private static STATUS_INTERVAL_MS = 5000;
```

**3e.** Add `startStatusPolling()` method after `stopPresencePolling()`:

```typescript
  private startStatusPolling(): void {
    this.stopStatusPolling();
    const poll = async () => {
      if (this.connectionState !== "connected" || this.destroyed) return;
      try {
        const result = await this.call<GatewayStatusResponse>("status");
        if (result?.sessions?.recent && Array.isArray(result.sessions.recent)) {
          this.emit("status", result.sessions.recent);
        }
      } catch {
        // Polling failure is non-fatal
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
```

**3f.** In `handleFrame`, after `this.startPresencePolling();` (line 128), add:

```typescript
            this.startStatusPolling();
```

**3g.** In `cleanup()`, after `this.stopPresencePolling();` (line 228), add:

```typescript
    this.stopStatusPolling();
```

**3h.** In `ws.onclose` handler (line 108), change `this.stopPresencePolling()` to:

```typescript
      this.stopPresencePolling();
      this.stopStatusPolling();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/yrd/projects/The_FOOL/gateway-adapter && npx vitest run src/room/gateway/OpenClawGatewayClient.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/yrd/projects/The_FOOL/gateway-adapter
git add src/room/gateway/OpenClawGatewayClient.ts src/room/gateway/OpenClawGatewayClient.test.ts
git commit -m "feat: add status RPC polling for session-based contestant tracking"
```

---

## Chunk 4: Update Exports + Hook Integration

Exports and hook are changed together in one commit to avoid intermediate broken state (removing old exports breaks `useGatewayRoomSource.ts` until the hook is updated).

### Task 5: Update barrel exports and hook

**Files:**
- Modify: `src/room/gateway/index.ts`
- Modify: `src/room/useGatewayRoomSource.ts`

- [ ] **Step 1: Replace contents of `src/room/gateway/index.ts`**

```typescript
export { OpenClawGatewayClient } from "./OpenClawGatewayClient";
export { reduceConnection } from "./connectionReducer";
export {
  classifyInteractionType,
  deriveContestantStateFromSession,
  mapGatewayMessage,
  mapSessionsToContestantStates,
} from "./gatewayAdapter";
export { DEFAULT_REGISTRY, lookupContestant } from "./agentRegistry";
export type { ContestantRegistration, AgentRegistry } from "./agentRegistry";
export type {
  ConnectionEvent,
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
  GatewayPresenceEntry,
  GatewaySessionEntry,
  GatewayStatusResponse,
  Unsubscribe,
} from "./types";
```

- [ ] **Step 2: Update hook imports**

Replace lines 1-19 of `src/room/useGatewayRoomSource.ts` with:

```typescript
import { useEffect, useMemo, useRef, useState } from "react";
import { deriveConversationState } from "./deriveConversationState";
import { buildRoomViewModel } from "./buildRoomViewModel";
import { buildRoomDirectory } from "./rooms";
import {
  OpenClawGatewayClient,
  mapSessionsToContestantStates,
  mapGatewayMessage,
  DEFAULT_REGISTRY,
} from "./gateway";
import type {
  AudioMode,
  RoomActionApi,
  RoomSourceSnapshot,
  SeedRoomSourceInputs,
  SeedRoomSourceResult,
  ScenarioOverride,
} from "./types";
import type { ConnectionState, GatewayConfig, GatewayPresenceEntry, GatewaySessionEntry } from "./gateway/types";
import type { AudienceInteraction } from "../types";
```

- [ ] **Step 3: Add `sessions` state**

After the `presences` state declaration (line 30), add:

```typescript
  const [sessions, setSessions] = useState<GatewaySessionEntry[]>([]);
```

- [ ] **Step 4: Add status event listener**

In the `useEffect` that creates the client, after the `client.on("presence", ...)` block (line 63), add:

```typescript
    client.on("status", (entries) => {
      setSessions(entries);
    });
```

- [ ] **Step 5: Replace contestantStateMap derivation**

Replace lines 82-85 (the `contestantStateMap` useMemo) with:

```typescript
  const contestantStateMap = useMemo(() => {
    const contestantIds = inputs.contestantDeck.map((c) => c.id);
    return mapSessionsToContestantStates(sessions, DEFAULT_REGISTRY, contestantIds);
  }, [sessions, inputs.contestantDeck]);
```

- [ ] **Step 6: Replace hasAgentPresences with connectedClientCount**

Replace lines 87-90 (the `hasAgentPresences` useMemo) with:

```typescript
  const connectedClientCount = useMemo(
    () => presences.filter((p) => p.mode === "ui").length,
    [presences],
  );
```

- [ ] **Step 7: Update callout logic**

In the `roomViewModel` useMemo, replace the callout section (lines 155-162):

```typescript
    // Override callout for connection issues
    let callout = model.roomCallout;
    if (authFailed) {
      callout = AUTH_FAIL_CALLOUT;
    } else if (connectionStatus === "connected" && sessions.length === 0 && connectedClientCount === 0) {
      callout = ZERO_PRESENCE_CALLOUT;
    } else if (connectionStatus === "connecting" || connectionStatus === "reconnecting") {
      callout = `Connecting to gateway (${connectionStatus})...`;
    }
```

Update the full `roomViewModel` useMemo dependency array (replace `hasAgentPresences` with `sessions, connectedClientCount`):

```typescript
  }, [
    stageConversation, inputs, interactions, audioMode,
    scenarioOverride, currentRoomId, contestantStateMap,
    connectionStatus, sessions, connectedClientCount, authFailed,
  ]);
```

- [ ] **Step 8: Run full test suite**

Run: `cd /home/yrd/projects/The_FOOL/gateway-adapter && npx vitest run`
Expected: ALL tests pass.

- [ ] **Step 9: Commit exports + hook together**

```bash
cd /home/yrd/projects/The_FOOL/gateway-adapter
git add src/room/gateway/index.ts src/room/useGatewayRoomSource.ts
git commit -m "feat: wire session-based contestant states into gateway room source"
```

---

## Chunk 5: Full Integration Verification

### Task 6: Run full test suite and verify build

- [ ] **Step 1: Run all tests**

Run: `cd /home/yrd/projects/The_FOOL/gateway-adapter && npx vitest run`
Expected: ALL tests pass (existing 48+ plus new ones)

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /home/yrd/projects/The_FOOL/gateway-adapter && npx tsc -b --noEmit`
Expected: No errors

- [ ] **Step 3: Verify Vite build (seed mode, default)**

Run: `cd /home/yrd/projects/The_FOOL/gateway-adapter && npx vite build`
Expected: Build succeeds. Gateway code is dead-code-eliminated in seed mode.

- [ ] **Step 4: Manual E2E test with local gateway**

```bash
# Terminal 1: The gateway is already running (verified earlier)

# Terminal 2: Run a contestant agent turn
cd /home/yrd/projects/The_FOOL/gateway-adapter
openclaw agent --agent contestant-01 --message "say hello" --timeout 30

# Terminal 3: Start The FOOL in gateway mode
cd /home/yrd/projects/The_FOOL/gateway-adapter
VITE_ROOM_SOURCE=gateway \
VITE_OPENCLAW_URL=ws://localhost:18789 \
VITE_OPENCLAW_TOKEN=51d78b0bc46e0f0dfe37b630277436a805423469229a01bb \
npx vite --open

# Verify in browser:
# - Connection status shows "connected"
# - Contestant 1 seat shows activity state based on session recency
# - Other contestants show "muted"
```

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
cd /home/yrd/projects/The_FOOL/gateway-adapter
git add -A
git commit -m "fix: integration fixes for multi-contestant gateway"
```
