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

Both sources return the same `SeedRoomSourceResult` type. `App.tsx` changes only the import (one line). `DemoControlPanel` gets a small addition: a connection status indicator visible only in gateway mode. All other presentation components (`PresenceSidebar`, `ConversationDock`, `SpatialRoomFloor`) require zero changes.

## OpenClaw Gateway Protocol

Based on OpenClaw 2026.3.8 source and documentation (verified 2026-03-12 against installed gateway binary):

- **Transport:** WebSocket, JSON text frames
- **Default port:** 18789 (local), 19001 (dev profile)
- **Auth:** Token-based (`gateway.auth.token` from `~/.openclaw/openclaw.json`)
- **Framing:**
  - Request: `{type:"req", id, method, params}`
  - Response: `{type:"res", id, ok, payload|error}`
  - Event: `{type:"event", event, payload, seq?, stateVersion?}`
- **Key RPC method:** `system-presence` — returns connected clients as an array of presence entry objects
- **Presence entry fields (verified from source):** `instanceId`, `deviceId`, `host`, `ip`, `version`, `platform`, `deviceFamily`, `modelIdentifier`, `mode` (freeform string), `lastInputSeconds`, `reason`, `roles`, `scopes`, `tags`, `text`, `ts`
- **Presence events:** The server broadcasts a `"presence"` event to all connected clients when presence changes. `system-presence` RPC is available as a fallback for explicit polling.
- **Challenge flow:** Server sends `connect.challenge` with `{nonce, ts}` → client responds with connect request including `auth.token`, `minProtocol`/`maxProtocol`, `client` identity, `role`, `scopes` → server returns response with `payload.type === "hello-ok"` (NOT `payload.event`)

> **Protocol errata (discovered during source audit):**
> 1. The `hello-ok` sentinel lives at `payload.type`, not `payload.event`. The response is `{type:"res", ok:true, payload:{type:"hello-ok", protocol:3, policy:{...}, auth:{...}}}`.
> 2. The `connect` request should include `minProtocol`/`maxProtocol` (currently `3`) and a `client` object with `{id, version, platform, mode}` for proper handshake. The gateway may tolerate minimal requests under `--auth token` mode locally, but production gateways enforce stricter validation.
> 3. Presence `mode` is a freeform string, not a strict union. Known values from source: `"gateway"`, `"agent"`, `"operator"`, `"node"`, `"cli"`, and node-submitted custom modes. Filter by known agent-like modes rather than exhaustive matching.

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
  | { type: "ws-close" }
  | { type: "ws-error" }
  | { type: "retry-exhausted" }
  | { type: "disconnect" };

const reduceConnection = (
  state: ConnectionState,
  event: ConnectionEvent,
): ConnectionState => { /* pure */ };
```

Additional transitions not shown in the diagram above:

```
connecting ─[ws-error]→ reconnecting
connected ─[ws-error]→ reconnecting
authenticating ─[ws-error]→ reconnecting
```

`ws-error` and `ws-close` both trigger reconnection from any active state. The close code is not used for routing — all abnormal closes attempt reconnection.

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
  instanceId?: string;
  deviceId?: string;
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode?: string;          // freeform — known values: "gateway", "agent", "operator", "node", "cli"
  lastInputSeconds?: number;
  reason?: string;
  roles?: string[];
  scopes?: string[];
  tags?: string[];
  text?: string;          // human-readable summary line, e.g. "Node: host (ip) · app ver · last input Xs ago · mode M · reason R"
  ts: number;
};
```

> Fields are optional because the gateway merges partial updates. Only `ts` is always present. Use defensive access for all other fields.

Mapping rules:

| Gateway `mode` (substring match) | Room role | State heuristic (based on `lastInputSeconds`) |
|----------------------------------|-----------|----------------------------------------------|
| contains `"agent"` | Contestant | 0-10s → speaking, 10-30s → raised-hand, 30-120s → listening, 120s+ → muted |
| `"operator"` | Listener/Judge | Always "listening" |
| `"node"` | Listener | Always "listening" |
| `"gateway"` | Filtered out (gateway self-presence) | N/A |
| `"cli"` or unknown | Filtered out | N/A |

### Agent Identity Resolution

A mapping table (`agentPresenceMap`) connects gateway `instanceId` to contestant metadata:

```ts
type AgentPresenceMap = Record<string, {
  contestantId: string;
  name: string;
  teamIndex: number;
}>;
```

Resolution strategy (in order of precedence):

1. **Config file** (`src/room/gateway/agent-map.json`): If the file exists, use it. Maps gateway `instanceId` → contestant metadata. This gives stable assignments across gateway restarts.
2. **Auto-generation**: If no config file, assign presence entries to contestants by arrival order (sorted by `ts` ascending). The first entry maps to contestant index 0, second to index 1, etc. N = number of contestants in `contestantDeck` (currently 6).

When a presence entry has no mapping (either because N is exhausted or because it has `mode: "operator"`/`"node"`), it becomes a listener entity in the quiet-orbit.

### Multi-User Simulation

The user can spawn multiple agent sessions via `openclaw agents add` to simulate a room with multiple contestants. Each agent gets its own gateway presence entry and maps to a distinct contestant.

### Gateway Message Type

```ts
type GatewayMessage = {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  ts: number;
};
```

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
  id: string;    // gateway identity, e.g. "local" — enables multi-gateway keying later
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

### Contestant ID Ordering

The `orderedContestantIds` passed to derivation functions always comes from `inputs.contestantDeck` (the static deck). Gateway presence only augments the state of each contestant (speaking/listening/muted) — it does not change which contestants exist or their order. Unmapped presence entries become listeners, not contestants.

### Zero-Presence Fallback

When `system-presence` returns an empty array (or the gateway is unreachable), all contestants default to `"muted"` state. The derivation pipeline still runs with the full `contestantDeck`, producing a valid but silent room. The `roomCallout` is set to `"Waiting for gateway connections..."` when zero agent-mode presences are found.

### Auth Failure Behavior

When the connection state reaches `disconnected` due to `auth-fail`, the hook:
- Sets `connectionStatus` to `"disconnected"` on the snapshot
- Sets `roomCallout` to `"Gateway authentication failed. Check VITE_OPENCLAW_TOKEN."`
- Keeps contestant states as `"muted"` (same as zero-presence)
- Does not auto-retry (auth failures are not transient)

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

The mode is a build-time constant (`import.meta.env.VITE_ROOM_SOURCE`), so Vite dead-code-eliminates the unused branch. To satisfy the Rules of Hooks lint rule (hooks must be called unconditionally), use a component-level switch rather than a conditional hook call:

```ts
// src/room/useRoomSource.ts
const ROOM_MODE = (import.meta.env.VITE_ROOM_SOURCE ?? "seed") as "seed" | "gateway";
const GATEWAY_URL = import.meta.env.VITE_OPENCLAW_URL ?? "ws://localhost:18789";
const GATEWAY_TOKEN = import.meta.env.VITE_OPENCLAW_TOKEN ?? "";

// Export the appropriate hook at module level (build-time constant selection)
export const useRoomSource: (inputs: SeedRoomSourceInputs) => SeedRoomSourceResult =
  ROOM_MODE === "gateway"
    ? (inputs) => useGatewayRoomSource(inputs, { url: GATEWAY_URL, token: GATEWAY_TOKEN })
    : useSeedRoomSource;
```

This is safe because `ROOM_MODE` is a build-time constant — Vite replaces `import.meta.env.VITE_ROOM_SOURCE` at compile time. Only one hook function is ever assigned.

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
- **Presence polling load**: 3s polling is acceptable for local dev. For production, subscribe to the `"presence"` gateway event (confirmed available in 2026.3.8 GATEWAY_EVENTS) instead of polling.
- **Agent identity stability**: Gateway `instanceId` changes on restart. The auto-mapping strategy handles this by position, but may shuffle contestant assignments. Config-based mapping is more stable.
- **No room concept in gateway**: The gateway has presence but no spatial rooms. Room assignment is derived client-side from agent metadata/team assignments.

## Out of Scope

- Production deployment of the gateway adapter
- Multi-gateway federation
- End-to-end encryption of room state
- Real audio/video proxying (the "audio mode" remains a UI simulation)
- Gateway-side room state storage
