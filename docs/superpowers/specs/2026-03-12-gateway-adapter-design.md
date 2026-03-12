# OpenClaw Gateway Adapter Design

> **Phase:** Live source integration via OpenClaw gateway WebSocket
> **Prerequisite:** Room-state boundary (completed, merged to main)
> **Date:** 2026-03-12

## Goal

Replace the seed-only room source with a dual-mode architecture that can connect to a running OpenClaw gateway (`openclaw gateway run`) and translate real presence/event data into the existing `RoomSourceSnapshot` contract. The seed source remains available as a fallback, switchable via environment variable.

## Architecture

```
App.tsx (unchanged)
  ↓ SeedRoomSourceResult (unchanged contract)
useRoomSource(inputs, config)
  ├─ config.mode === "seed"    → useSeedRoomSource (existing, untouched)
  └─ config.mode === "gateway" → useGatewayRoomSource (new)
       ↓
  OpenClawGatewayClient (standalone class, no React)
    - WebSocket to ws://localhost:18789
    - Token auth via challenge/connect handshake
    - JSON-RPC request/response + event subscriptions
       ↓
  gatewayAdapter (pure functions)
    - presence entries → contestant states + room membership
    - gateway messages → AudienceInteraction events
    - connection state → UI status
```

### Key Constraint

`App.tsx` and all presentation components (`PresenceSidebar`, `ConversationDock`, `SpatialRoomFloor`, `DemoControlPanel`) require zero changes. Both sources return the same `SeedRoomSourceResult` type.

## OpenClaw Gateway Protocol

Based on OpenClaw 2026.3.8 documentation:

- **Transport:** WebSocket, JSON text frames
- **Default port:** 18789 (local), 19001 (dev profile)
- **Auth:** Token-based (`gateway.auth.token` from `~/.openclaw/openclaw.json`)
- **Framing:**
  - Request: `{type:"req", id, method, params}`
  - Response: `{type:"res", id, ok, payload|error}`
  - Event: `{type:"event", event, payload, seq?}`
- **Key RPC method:** `system-presence` — returns connected clients
- **Presence entry fields:** `instanceId`, `host`, `version`, `deviceFamily`, `mode`, `lastInputSeconds`, `ts`
- **Challenge flow:** Server sends `connect.challenge` with nonce → client responds with auth token + device identity → server returns `hello-ok`

## Connection State Machine

Pure reducer (`connectionReducer.ts`), no side effects.

### States

| State | Description |
|-------|-------------|
| `idle` | Not started |
| `connecting` | WebSocket opening |
| `authenticating` | Challenge/token handshake in progress |
| `connected` | Authenticated, receiving events |
| `reconnecting` | Lost connection, auto-retrying |
| `disconnected` | Gave up or user-initiated disconnect |

### Transitions

```
idle ─[start]→ connecting
connecting ─[ws-open]→ authenticating
authenticating ─[auth-ok]→ connected
authenticating ─[auth-fail]→ disconnected
connected ─[ws-close]→ reconnecting
connected ─[disconnect]→ disconnected
reconnecting ─[ws-open]→ authenticating
reconnecting ─[retry-exhausted]→ disconnected
disconnected ─[start]→ connecting
```

### Reconnect Strategy

Exponential backoff: 1s → 2s → 4s. Max 3 retries. After exhaustion, transition to `disconnected`. User can manually re-trigger connection via a UI button.

### Types

```ts
type ConnectionState =
  | "idle"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting"
  | "disconnected";

type ConnectionEvent =
  | { type: "start" }
  | { type: "ws-open" }
  | { type: "auth-ok" }
  | { type: "auth-fail"; reason: string }
  | { type: "ws-close"; code: number }
  | { type: "ws-error" }
  | { type: "retry-exhausted" }
  | { type: "disconnect" };

const reduceConnection = (
  state: ConnectionState,
  event: ConnectionEvent,
): ConnectionState => { /* pure */ };
```

## OpenClawGatewayClient

Standalone TypeScript class. No React dependency. Manages WebSocket lifecycle, authentication, and RPC calls.

### API

```ts
class OpenClawGatewayClient {
  constructor(config: { url: string; token: string });

  // Lifecycle
  connect(): void;
  disconnect(): void;
  getConnectionState(): ConnectionState;

  // RPC
  call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;

  // Event subscriptions
  on(event: "connection-change", cb: (state: ConnectionState) => void): Unsubscribe;
  on(event: "presence", cb: (entries: GatewayPresenceEntry[]) => void): Unsubscribe;
  on(event: "message", cb: (msg: GatewayMessage) => void): Unsubscribe;

  // Cleanup
  destroy(): void;
}
```

### Internal Behavior

1. `connect()` opens WebSocket to configured URL
2. On `connect.challenge` event, responds with auth token
3. On `hello-ok`, transitions to `connected`, starts presence polling (every 3s via `system-presence` RPC)
4. On WebSocket close, enters reconnect loop
5. `destroy()` closes WebSocket, clears timers, removes all listeners

### Presence Polling

The gateway `system-presence` method returns all connected clients. The client polls this every 3 seconds (cheaper than the current 7s seed interval, but using real data). Each poll emits a `presence` event with the full list.

Future optimization: if the gateway adds presence-change events, switch from polling to push.

## Gateway Adapter

Pure functions that map gateway data to room domain types. Located in `gatewayAdapter.ts`.

### Presence → Contestant State Mapping

```ts
type GatewayPresenceEntry = {
  instanceId: string;
  host: string;
  version: string;
  deviceFamily: string;
  mode: "agent" | "operator" | "node" | "cli";
  lastInputSeconds: number;
  ts: number;
};
```

Mapping rules:

| Gateway `mode` | Room role | State heuristic (based on `lastInputSeconds`) |
|----------------|-----------|----------------------------------------------|
| `agent` | Contestant | 0-10s → speaking, 10-30s → raised-hand, 30-120s → listening, 120s+ → muted |
| `operator` | Listener/Judge | Always "listening" |
| `node` | Listener | Always "listening" |
| `cli` | Filtered out | N/A |

### Agent Identity Resolution

A mapping table (`agentPresenceMap`) connects gateway `instanceId` to contestant metadata:

```ts
type AgentPresenceMap = Record<string, {
  contestantId: string;
  name: string;
  teamIndex: number;
}>;
```

This map is either:
- Auto-generated from the first N presence entries (for quick demos)
- Loaded from a config file (`src/room/gateway/agent-map.json`) for stable assignments

When a presence entry has no mapping, it becomes a listener entity in the quiet-orbit.

### Multi-User Simulation

The user can spawn multiple agent sessions via `openclaw agents add` to simulate a room with multiple contestants. Each agent gets its own gateway presence entry and maps to a distinct contestant.

### Message → AudienceInteraction Mapping

Gateway messages (from channels like Telegram) map to audience interactions:

```ts
const mapGatewayMessage = (msg: GatewayMessage): AudienceInteraction => ({
  id: `gw-${msg.id}`,
  contestantId: resolveContestantId(msg.senderId),
  type: classifyInteractionType(msg.content), // "bet" | "like" | "danmaku" | "boo"
  source: msg.senderName ?? msg.senderId,
  content: msg.content,
  amount: extractBetAmount(msg.content) ?? 1,
  timestampLabel: formatTimestamp(msg.ts),
});
```

Content classification uses simple keyword matching:
- Contains bet amount pattern → "bet"
- Contains positive emoji/keywords → "like"
- Contains negative emoji/keywords → "boo"
- Default → "danmaku"

## useGatewayRoomSource Hook

React hook that wraps `OpenClawGatewayClient` and feeds the adapter output through the existing room derivation pipeline.

### Inputs

Same `SeedRoomSourceInputs` as the seed hook, plus gateway config:

```ts
type GatewayConfig = {
  url: string;   // default: "ws://localhost:18789"
  token: string; // from import.meta.env.VITE_OPENCLAW_TOKEN or config file
};
```

### Behavior

1. Creates `OpenClawGatewayClient` on mount, calls `connect()`
2. Subscribes to `presence` events → updates a `presenceEntries` state
3. Subscribes to `message` events → appends to `interactions` state
4. Runs the same derivation pipeline as seed source:
   - `deriveConversationState()` with presence-derived contestant states
   - `buildRoomDirectory()` with presence-derived membership
   - `buildRoomViewModel()` with presence-derived seats
5. Exposes `actions` that dispatch both local state changes AND gateway RPCs where applicable
6. On unmount, calls `client.destroy()`

### Connection Status in UI

The snapshot gets an optional `connectionStatus` field:

```ts
interface RoomSourceSnapshot {
  // ... existing fields
  connectionStatus?: ConnectionState; // only present in gateway mode
}
```

`DemoControlPanel` shows a connection indicator when in gateway mode. This is the only UI change — a small status dot (green/yellow/red) next to the source mode label.

## useRoomSource — Unified Hook

```ts
export const useRoomSource = (
  inputs: SeedRoomSourceInputs,
): SeedRoomSourceResult => {
  const mode = import.meta.env.VITE_ROOM_SOURCE ?? "seed";

  if (mode === "gateway") {
    return useGatewayRoomSource(inputs, {
      url: import.meta.env.VITE_OPENCLAW_URL ?? "ws://localhost:18789",
      token: import.meta.env.VITE_OPENCLAW_TOKEN ?? "",
    });
  }

  return useSeedRoomSource(inputs);
};
```

`App.tsx` changes one line:
```diff
-import { useSeedRoomSource } from "./room";
+import { useRoomSource } from "./room";

-const { snapshot, roomDirectory, roomViewModel, actions } = useSeedRoomSource(hookInputs);
+const { snapshot, roomDirectory, roomViewModel, actions } = useRoomSource(hookInputs);
```

## Source Switching

| Env Variable | Value | Effect |
|---|---|---|
| `VITE_ROOM_SOURCE` | `"seed"` (default) | Uses existing seed source, no network |
| `VITE_ROOM_SOURCE` | `"gateway"` | Connects to OpenClaw gateway |
| `VITE_OPENCLAW_URL` | `"ws://host:port"` | Gateway WebSocket URL (default: `ws://localhost:18789`) |
| `VITE_OPENCLAW_TOKEN` | `"token"` | Gateway auth token |

## File Structure

```
src/room/
  gateway/
    OpenClawGatewayClient.ts       — WebSocket client class
    OpenClawGatewayClient.test.ts  — unit tests with mock WebSocket
    connectionReducer.ts           — pure connection state machine
    connectionReducer.test.ts      — state transition tests
    gatewayAdapter.ts              — maps presence/events → room types
    gatewayAdapter.test.ts         — mapping tests with fixture data
    types.ts                       — gateway-specific types
    index.ts                       — barrel exports
  useGatewayRoomSource.ts          — React hook for gateway source
  useRoomSource.ts                 — unified source selector hook
  // existing files unchanged:
  types.ts
  deriveConversationState.ts
  buildRoomViewModel.ts
  rooms.ts
  seedRoomSource.ts
  useSeedRoomSource.ts
  testFixtures.ts
  index.ts
```

## Testing Strategy

### Pure Function Tests (no network)

- **connectionReducer.test.ts**: All state transitions, including reconnect exhaustion and edge cases (double-start, disconnect while idle)
- **gatewayAdapter.test.ts**: Presence-to-contestant mapping, activity heuristics, message classification, unmapped-agent fallback to listener
- **OpenClawGatewayClient.test.ts**: Mock WebSocket; test connect/auth flow, RPC call/response matching, event emission, reconnect behavior, destroy cleanup

### Integration Tests

- **useGatewayRoomSource**: Render hook with mock client, verify it returns valid `SeedRoomSourceResult` shape
- **useRoomSource**: Verify mode switching between seed and gateway

### Manual E2E

```bash
# Terminal 1: start gateway
openclaw gateway run

# Terminal 2: spawn test agents
openclaw agents add --name "contestant-1"
openclaw agents add --name "contestant-2"

# Terminal 3: start app in gateway mode
VITE_ROOM_SOURCE=gateway VITE_OPENCLAW_TOKEN=<token> npm run dev
```

### Existing Tests

All 48 existing tests remain untouched. The seed source is unchanged.

## Risks

- **Gateway not running**: `useGatewayRoomSource` must gracefully degrade. Show connection status, don't crash. If gateway is unreachable after retries, show a "Gateway offline" message in the room callout.
- **Presence polling load**: 3s polling is acceptable for local dev. For production, switch to event-driven presence when gateway supports it.
- **Agent identity stability**: Gateway `instanceId` changes on restart. The auto-mapping strategy handles this by position, but may shuffle contestant assignments. Config-based mapping is more stable.
- **No room concept in gateway**: The gateway has presence but no spatial rooms. Room assignment is derived client-side from agent metadata/team assignments.

## Out of Scope

- Production deployment of the gateway adapter
- Multi-gateway federation
- End-to-end encryption of room state
- Real audio/video proxying (the "audio mode" remains a UI simulation)
- Gateway-side room state storage
