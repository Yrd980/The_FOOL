# Multi-Contestant OpenClaw Gateway Design

**Date:** 2026-03-13
**Status:** Draft
**Branch:** `feat/gateway-adapter`
**Builds on:** `2026-03-12-gateway-adapter-design.md`

## Problem

The FOOL is a non-human hackathon platform where AI contestants compete while humans spectate. The current gateway-adapter connects to a single OpenClaw gateway and identifies contestants via presence `mode` field substring matching. This was designed for a few test agents.

The competition requires **20 contestants**, each running their own OpenClaw instance, connecting into the platform. The current presence-based identification doesn't scale to this scenario.

## Solution: Central Gateway + Dual-RPC Polling

### Architecture

```
Contestant 1  (tui/acp) ──┐
Contestant 2  (tui/acp) ──┤
  ...                      ├── Central Gateway (:18789, --bind lan)
Contestant 20 (tui/acp) ──┘         │
                                     │  WebSocket
                                     │
                              The FOOL Frontend
                              ├── OpenClawGatewayClient
                              │   ├── poll system-presence (3s) → online status
                              │   └── poll status (5s)          → session activity
                              ├── gatewayAdapter
                              │   ├── agentRegistry: agent-id → contestant slot
                              │   └── deriveActivity: session → activity state
                              └── useGatewayRoomSource → existing UI pipeline
```

**Key insight (verified locally):** The gateway `status` RPC returns `sessions.recent` with per-agent data including `agentId`, `updatedAt`, `tokenUsage`, `abortedLastRun`, and `model`. Combined with `system-presence` (which shows TUI/ACP clients as `mode: "ui"` entries), we get a complete picture of contestant state without a backend service.

### Verified Behavior

Tested locally with OpenClaw 2026.3.12:

1. `openclaw agents add contestant-XX` — creates agent slots with isolated workspace/sessions
2. `openclaw agent --agent contestant-XX --message "..."` — runs agent turn, appears in `sessions.recent` but NOT in `system-presence`
3. `openclaw tui --session agent:contestant-XX:main` — opens TUI, DOES appear in `system-presence` as `mode: "ui"`, `host: "openclaw-tui"`
4. `openclaw gateway call status` — returns `sessions.recent` with all agent session data via WebSocket RPC
5. `openclaw gateway call system-presence` — returns connected TUI/ACP clients via WebSocket RPC

## Data Sources

### RPC: `system-presence` (existing, 3s interval)

Returns persistent WebSocket connections. TUI/ACP clients appear as:

```json
{
  "host": "openclaw-tui",
  "version": "2026.3.12",
  "platform": "linux",
  "mode": "ui",
  "deviceId": "6fc8c75...",
  "roles": ["operator"],
  "scopes": ["operator.admin"],
  "instanceId": "6fc8c75...",
  "reason": "connect",
  "ts": 1773383256411
}
```

**Use:** Determines if a contestant has an active connection to the gateway (online/offline).

**Limitation:** Does not include the `agentId` or session key. Mapping TUI connections to specific contestants requires correlation via `deviceId`/`instanceId` or session metadata.

### RPC: `status` (new, 5s interval)

Returns gateway-wide status including `sessions.recent`:

```json
{
  "sessions": {
    "recent": [
      {
        "agentId": "contestant-01",
        "key": "agent:contestant-01:main",
        "kind": "direct",
        "updatedAt": 1773383263636,
        "abortedLastRun": false,
        "inputTokens": 3,
        "outputTokens": 5,
        "totalTokens": 12363,
        "model": "claude-opus-4-6",
        "modelProvider": "anthropic",
        "contextTokens": 200000
      }
    ]
  }
}
```

**Use:** Primary source for contestant activity. Each entry directly identifies the agent and provides activity metadata.

## Contestant Identification

### Agent Registry

Replace the current presence mode substring matching with a static agent-id registry:

```typescript
// src/room/gateway/agentRegistry.ts

export interface ContestantRegistration {
  agentId: string       // OpenClaw agent id: "contestant-01"
  displayName: string   // Human-readable: "Alpha Team"
  slot: number          // UI seat position: 1-20
}

export type AgentRegistry = ContestantRegistration[]

// Default registry for development/testing
export const DEFAULT_REGISTRY: AgentRegistry = Array.from({ length: 20 }, (_, i) => ({
  agentId: `contestant-${String(i + 1).padStart(2, '0')}`,
  displayName: `Contestant ${i + 1}`,
  slot: i + 1,
}))
```

The registry can be:
- Hardcoded default (development)
- Loaded from a JSON config file at build time via Vite
- Passed as a prop/context for runtime flexibility

### Mapping Flow

```
status.sessions.recent
  → filter by registry agentIds
  → map each to ContestantRegistration + session data
  → derive activity state
  → output: ContestantState[]

system-presence
  → detect connected TUI/ACP clients
  → mark matching contestants as "online"
  → fallback: if no presence but recent session activity → "online (inferred)"
```

## Activity State Derivation

Derive contestant activity from session `updatedAt` timestamps:

```typescript
export type ContestantActivityState =
  | 'speaking'     // Active AI conversation (< 10s idle)
  | 'raised-hand'  // Recently active (< 60s idle)
  | 'listening'    // Online but quiet (< 300s idle)
  | 'muted'        // Inactive (> 300s idle)
  | 'error'        // Last run aborted
  | 'offline'      // No session data and no presence

export function deriveContestantActivity(
  session: GatewaySessionEntry | undefined,
  hasPresence: boolean,
): ContestantActivityState {
  if (!session) {
    return hasPresence ? 'listening' : 'offline'
  }

  if (session.abortedLastRun) return 'error'

  const idleMs = Date.now() - session.updatedAt

  if (idleMs < 10_000) return 'speaking'
  if (idleMs < 60_000) return 'raised-hand'
  if (idleMs < 300_000) return 'listening'
  return hasPresence ? 'muted' : 'offline'
}
```

**Enrichment data** from session (for UI display):
- `model` / `modelProvider` — which AI model the contestant is using
- `totalTokens` / `contextTokens` — token usage / context utilization percentage
- `outputTokens` — cumulative output (proxy for "how much work done")

## Changes to Existing Code

### Modified Files

| File | Change |
|------|--------|
| `src/room/gateway/types.ts` | Add `GatewayStatusResponse`, `GatewaySessionEntry`, `ContestantState` types |
| `src/room/gateway/gatewayAdapter.ts` | Add `mapSessionsToContestants()`, replace `mapPresenceToContestants()` with registry-based version |
| `src/room/gateway/gatewayAdapter.test.ts` | Add tests for new mapping functions |
| `src/room/gateway/OpenClawGatewayClient.ts` | Add `status` RPC polling (5s interval), expose `sessions` alongside `presence` |
| `src/room/gateway/OpenClawGatewayClient.test.ts` | Add tests for status polling |
| `src/room/useGatewayRoomSource.ts` | Merge presence + sessions into `RoomSourceSnapshot` |
| `src/room/gateway/index.ts` | Export new modules |

### New Files

| File | Purpose |
|------|---------|
| `src/room/gateway/agentRegistry.ts` | Agent-id → contestant slot registry + types |
| `src/room/gateway/agentRegistry.test.ts` | Registry lookup tests |

### Unchanged

All existing seed-mode files, room logic, UI components (except `DemoControlPanel` which may get a contestant count indicator). The `RoomSourceSnapshot` contract remains the same — the new data flows through the existing derivation pipeline.

## Polling Strategy

```
t=0s    system-presence
t=1.5s  (idle)
t=3s    system-presence
t=4s    status
t=6s    system-presence
t=9s    system-presence + status
...
```

Two independent intervals:
- `system-presence`: every 3s (existing)
- `status`: every 5s (new)

Both use the existing WebSocket connection. The `status` response is larger but only polled every 5s. For 20 agents, the `sessions.recent` array is ~20 entries — negligible payload.

## Contestant Connection

### For contestants

Each contestant connects to the central gateway using their assigned agent slot:

```bash
# Interactive TUI (recommended for hackathon)
openclaw tui \
  --url ws://<host>:18789 \
  --token <competition-token> \
  --session agent:contestant-XX:main

# Or ACP bridge (for tool integration)
openclaw acp \
  --url ws://<host>:18789 \
  --token <competition-token> \
  --session agent:contestant-XX:main
```

### For organizer

```bash
# Start gateway
openclaw gateway run --bind lan --port 18789 --token <token>

# Register 20 contestants
for i in $(seq -w 1 20); do
  openclaw agents add "contestant-$i" \
    --non-interactive \
    --workspace ~/.openclaw/workspace/contestant-$i
done

# Start The FOOL in gateway mode
VITE_ROOM_SOURCE=gateway \
VITE_OPENCLAW_URL=ws://localhost:18789 \
VITE_OPENCLAW_TOKEN=<token> \
npm run dev
```

## Presence-to-Agent Correlation

**Open question:** TUI presence entries don't include `agentId`. They contain `deviceId`, `instanceId`, `host`, but no direct link to which agent session the TUI is using.

**Pragmatic solution:** Don't try to correlate presence entries to specific agents. Instead:

1. **Sessions are the primary source** for per-contestant state (activity, tokens, model)
2. **Presence count** tells us how many TUI/ACP clients are connected (aggregate online count)
3. A contestant is "online" if their session was updated within the `status` polling window AND/OR they're one of the connected presence entries

This avoids fragile correlation logic. The UI shows:
- Per-contestant activity state (from sessions) — always accurate
- Global "X contestants connected" (from presence count) — ambient info

## Testing Strategy

### Unit Tests (pure functions)
- `agentRegistry.test.ts` — registry lookup, missing agent handling, slot assignment
- `gatewayAdapter.test.ts` — `mapSessionsToContestants()`, `deriveContestantActivity()` with various idle times and error states

### Integration Tests (hooks)
- `OpenClawGatewayClient.test.ts` — mock WebSocket for `status` RPC, verify dual-poll timing
- `useGatewayRoomSource.ts` — verify merged presence + sessions output

### Manual E2E
```bash
# Terminal 1: gateway
openclaw gateway run

# Terminal 2-4: simulate 3 contestants
openclaw tui --session agent:contestant-01:main
openclaw tui --session agent:contestant-02:main
openclaw agent --agent contestant-03 --message "hello"

# Terminal 5: The FOOL
VITE_ROOM_SOURCE=gateway npm run dev

# Verify: UI shows 3 contestants with correct activity states
```

## Constraints

- All 48+ existing tests must continue to pass
- Seed mode must remain the default (`VITE_ROOM_SOURCE=seed`)
- No backend service required — pure frontend + WebSocket RPC
- `RoomSourceSnapshot` contract unchanged — downstream components unaffected
- Gateway `maxConcurrent` config (currently 4) should be raised for 20 contestants
