# Room Runtime Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the room runtime so room switching changes visible content, gateway mode receives and routes live events, and room/gateway state stays internally consistent.

**Architecture:** Keep the existing room boundary, but tighten it in three places: make `buildRoomViewModel(...)` room-aware, make gateway event/mapping logic explicit and testable, and surface current-room/current-user context in the UI so state changes are observable and verifiable.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4

---

## Chunk 1: Room-Scoped View Model

### Task 1: Add failing room-scoping regressions

**Files:**
- Modify: `src/room/buildRoomViewModel.test.ts`
- Modify: `src/App.room-flow.test.tsx`

- [ ] Add unit tests proving `team-room-*` and `quiet-orbit` produce room-specific seat states, signals, and callouts.
- [ ] Add UI tests proving room switching updates visible room context, not just `aria-pressed`.
- [ ] Run the targeted tests and confirm they fail for the expected reasons.

### Task 2: Implement room-aware derivation

**Files:**
- Modify: `src/room/buildRoomViewModel.ts`
- Modify: `src/room/types.ts`
- Modify: `src/room/useSeedRoomSource.ts`
- Modify: `src/room/useGatewayRoomSource.ts`

- [ ] Extend room-model inputs so the current room kind/team membership is available to the builder.
- [ ] Implement room-specific conversation/signal rules for `main-stage`, `team-room-*`, and `quiet-orbit`.
- [ ] Make `quiet-room` and `empty-room` overrides internally consistent by updating counts and visible state together.
- [ ] Re-run targeted room tests until green.

## Chunk 2: Gateway Message And Mapping Integrity

### Task 3: Add failing gateway regressions

**Files:**
- Modify: `src/room/gateway/OpenClawGatewayClient.test.ts`
- Modify: `src/room/gateway/gatewayAdapter.test.ts`

- [ ] Add a client test proving server message events are emitted to subscribers.
- [ ] Add adapter tests for stable sender-to-contestant resolution and for rejecting unresolved mappings.
- [ ] Run the targeted tests and confirm they fail first.

### Task 4: Implement gateway fixes

**Files:**
- Modify: `src/room/gateway/OpenClawGatewayClient.ts`
- Modify: `src/room/gateway/gatewayAdapter.ts`
- Modify: `src/room/useGatewayRoomSource.ts`

- [ ] Emit gateway `message` and `presence` push events from the WebSocket client.
- [ ] Reject/clear pending RPCs on disconnect, reconnect teardown, and destroy.
- [ ] Build a reusable presence mapping so both seat states and incoming messages resolve through the same contestant assignment.
- [ ] Recompute room view state from gateway overrides instead of patching seat state only.
- [ ] Re-run targeted gateway tests until green.

## Chunk 3: UI Context And Reducer Hardening

### Task 5: Add failing UI/reducer regressions

**Files:**
- Modify: `src/room/seedRoomSource.test.ts`
- Modify: `src/App.room-flow.test.tsx`

- [ ] Add a reducer test proving dynamic `team-room-*` ids are accepted.
- [ ] Add UI tests for current-room label and hallway-guide mode label.
- [ ] Run the targeted tests and confirm they fail first.

### Task 6: Implement UI/reducer fixes

**Files:**
- Modify: `src/room/seedRoomSource.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/DemoControlPanel.tsx`

- [ ] Replace the fixed valid-room list with rules that accept generated team-room ids.
- [ ] Surface current room and hallway-guide mode in the control panel.
- [ ] Add join/leave conversation controls backed by the existing action API.
- [ ] Re-run the focused UI tests until green.

## Final Verification

- [ ] Run `npm test`
- [ ] Run `npm run build`
- [ ] Review the final diff for unintended UI or contract changes before reporting completion
