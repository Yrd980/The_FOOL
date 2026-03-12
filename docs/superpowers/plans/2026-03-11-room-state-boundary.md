# Room-State Boundary Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a stable room-state boundary so the current seeded spatial-room demo and a future live `OpenClaw` integration can drive the same UI without re-embedding orchestration logic inside `App.tsx`.

**Architecture:** Introduce a focused `src/room/` module set that owns room-domain contracts, pure stage/conversation derivation, demo seed-event generation, and the thin hook that feeds the current prototype. Keep hackathon scoring and seeded contestant/judge content in the existing `src/logic.ts` and `src/data.ts`, but stop letting `src/App.tsx` derive room behavior directly from raw data. The end state of this phase is a thin `App` component that renders JSX and view toggles while consuming a room view model and a seed source that can later be replaced by a live adapter.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4

---

## File Structure

- Create: `src/room/types.ts`
  Responsibility: canonical room-domain contracts for conversation state, room snapshot inputs, and UI-facing room view models.
- Create: `src/room/deriveConversationState.ts`
  Responsibility: pure stage-based speaker / raised-hand / queue derivation, including `wave over` override behavior.
- Create: `src/room/deriveConversationState.test.ts`
  Responsibility: regression coverage for stage-to-conversation mapping and priority override rules.
- Create: `src/room/buildRoomViewModel.ts`
  Responsibility: pure transformation from existing contestant/team/audience inputs into the room-centric view data currently computed inside `App.tsx`.
- Create: `src/room/buildRoomViewModel.test.ts`
  Responsibility: regression coverage for seat states, audible signal filtering, grouping, and room callout text.
- Create: `src/room/seedRoomSource.ts`
  Responsibility: demo-only seed helpers such as `appendSeedInteraction(...)` and static room config access.
- Create: `src/room/seedRoomSource.test.ts`
  Responsibility: regression coverage for seeded event generation and deterministic feed advancement.
- Create: `src/room/useSeedRoomSource.ts`
  Responsibility: thin React hook that runs the interval loop and exposes the current seed-backed room feed through a stable interface.
- Create: `src/room/index.ts`
  Responsibility: barrel exports for the room module.
- Modify: `src/App.tsx`
  Responsibility: consume `src/room/` helpers instead of owning room derivation and seed feed generation inline.
- Modify: `src/data.ts`
  Responsibility: keep long-lived seed data exports, but move any room-source-specific shaping concerns behind `src/room/seedRoomSource.ts`.

## Constraints

- Keep `src/logic.ts` focused on hackathon-program derivation; do not move room transport behavior into it.
- Do not introduce multi-room routing or live SDK wiring in this phase.
- Preserve current UI copy and visible room behavior unless a testable regression requires a small wording update.
- Prefer pure-function extraction first; keep React-specific glue thin.

## Chunk 1: Pure Room Derivation

### Task 1: Extract Stage Conversation Rules

**Files:**
- Create: `src/room/types.ts`
- Create: `src/room/deriveConversationState.ts`
- Test: `src/room/deriveConversationState.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing conversation-derivation test**

```ts
import { describe, expect, it } from "vitest";

import { deriveConversationState } from "./deriveConversationState";

describe("deriveConversationState", () => {
  it("keeps act-3 focused on the selected team and lets wave-over take queue priority", () => {
    const result = deriveConversationState({
      activeStageId: "act-3",
      activeStageTitle: "组织龙虾分组",
      orderedContestantIds: ["glass-sea", "butter-knife", "iron-drum", "fog-lamp"],
      focusIds: ["glass-sea", "butter-knife"],
      championIds: ["glass-sea", "butter-knife"],
      leadingContestantId: "glass-sea",
      defaultSpeakerId: "glass-sea",
      priorityContestantId: "iron-drum",
      contestantNameById: {
        "glass-sea": "玻璃海",
        "butter-knife": "黄油刀",
        "iron-drum": "铁鼓",
        "fog-lamp": "雾灯圣母",
      },
      nearbyHint: "Nearby people may listen in",
    });

    expect(result.speakerId).toBe("glass-sea");
    expect(result.raisedHandId).toBe("iron-drum");
    expect(result.queuedIds[0]).toBe("iron-drum");
    expect(result.callout).toContain("wave over");
  });
});
```

- [ ] **Step 2: Run the targeted test to confirm the module does not exist yet**

Run: `npm test -- src/room/deriveConversationState.test.ts`
Expected: FAIL with a module resolution error for `./deriveConversationState`

- [ ] **Step 3: Implement the room contracts and pure conversation derivation**

```ts
export type ConversationState = {
  speakerId: string;
  raisedHandId: string;
  listeningIds: string[];
  queuedIds: string[];
  callout: string;
};

export const deriveConversationState = (
  input: DeriveConversationStateInput,
): ConversationState => {
  // Move the current switch(activeStage.id) rules out of App.tsx.
  // Preserve the existing copy and priorityContestantId override behavior.
};
```

- [ ] **Step 4: Re-run the targeted test and fix any copy/ordering mismatches**

Run: `npm test -- src/room/deriveConversationState.test.ts`
Expected: PASS with 1 passing test file

- [ ] **Step 5: Commit the extraction**

```bash
git add src/room/types.ts src/room/deriveConversationState.ts src/room/deriveConversationState.test.ts src/App.tsx
git commit -m "refactor: extract room conversation state rules"
```

### Task 2: Build a Pure Room View Model

**Files:**
- Create: `src/room/buildRoomViewModel.ts`
- Test: `src/room/buildRoomViewModel.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing room-view-model tests**

```ts
import { describe, expect, it } from "vitest";

import { buildRoomViewModel } from "./buildRoomViewModel";

describe("buildRoomViewModel", () => {
  it("marks speaking, raised-hand, listening, queued, and muted seats correctly", () => {
    const model = buildRoomViewModel(seedInput);

    expect(model.openClawSeats.find((seat) => seat.id === "glass-sea")?.state).toBe("speaking");
    expect(model.openClawSeats.find((seat) => seat.id === "iron-drum")?.state).toBe("raised-hand");
    expect(model.queueCount).toBeGreaterThan(0);
  });

  it("filters room audio when focus mode is active", () => {
    const model = buildRoomViewModel({ ...seedInput, audioMode: "focus" });

    expect(model.audibleSignals.every((event) => event.contestantId === model.activeSpeakerId)).toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Run the targeted test to confirm the transformer is still missing**

Run: `npm test -- src/room/buildRoomViewModel.test.ts`
Expected: FAIL with a module resolution error for `./buildRoomViewModel`

- [ ] **Step 3: Implement the pure transformer by moving the non-JSX room derivations out of `App.tsx`**

```ts
export const buildRoomViewModel = (input: BuildRoomViewModelInput): RoomViewModel => {
  // Reuse the extracted conversation state.
  // Move presence mapping, listener derivation, signal filtering,
  // grouping, counts, and room callout assembly here.
};
```

- [ ] **Step 4: Run the focused room tests plus existing logic tests**

Run: `npm test -- src/room/buildRoomViewModel.test.ts src/room/deriveConversationState.test.ts src/logic.test.ts`
Expected: PASS with the new room tests and the existing logic suite all green

- [ ] **Step 5: Commit the pure room-model extraction**

```bash
git add src/room/buildRoomViewModel.ts src/room/buildRoomViewModel.test.ts src/room/types.ts src/App.tsx
git commit -m "refactor: extract room view model builder"
```

## Chunk 2: Demo Source And App Integration

### Task 3: Extract the Seed Room Source

**Files:**
- Create: `src/room/seedRoomSource.ts`
- Test: `src/room/seedRoomSource.test.ts`
- Modify: `src/data.ts`

- [ ] **Step 1: Write the failing seed-source tests**

```ts
import { describe, expect, it } from "vitest";

import { appendSeedInteraction } from "./seedRoomSource";

describe("appendSeedInteraction", () => {
  it("adds one deterministic audience event using the current rotation rules", () => {
    const next = appendSeedInteraction({
      current: seedAudienceInteractions,
      contestants,
      audienceHandles,
      danmuTemplates,
    });

    expect(next).toHaveLength(seedAudienceInteractions.length + 1);
    expect(next.at(-1)?.id).toMatch(/^evt-live-/);
  });
});
```

- [ ] **Step 2: Run the targeted seed-source test before implementation**

Run: `npm test -- src/room/seedRoomSource.test.ts`
Expected: FAIL with a module resolution error for `./seedRoomSource`

- [ ] **Step 3: Implement the seed-source helper module**

```ts
export const appendSeedInteraction = (input: AppendSeedInteractionInput) => {
  // Move the current 7-second event-generation logic out of App.tsx.
  // Preserve the existing type rotation, amount calculation, and timestamp formatting.
};
```

- [ ] **Step 4: Re-run the seed-source test and verify deterministic output**

Run: `npm test -- src/room/seedRoomSource.test.ts`
Expected: PASS with deterministic event-generation assertions

- [ ] **Step 5: Commit the demo-source extraction**

```bash
git add src/room/seedRoomSource.ts src/room/seedRoomSource.test.ts src/data.ts
git commit -m "refactor: extract seeded room source helpers"
```

### Task 4: Rewire `App.tsx` Around the Room Boundary

**Files:**
- Create: `src/room/useSeedRoomSource.ts`
- Create: `src/room/index.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Capture the current integration baseline**

Run: `npm test && npm run build`
Expected: PASS with the existing logic tests and a successful Vite production build

- [ ] **Step 2: Implement the thin seed-room hook and barrel exports**

```ts
export const useSeedRoomSource = () => {
  const [interactions, setInteractions] = useState(seedAudienceInteractions);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setInteractions((current) =>
        appendSeedInteraction({ current, contestants, audienceHandles, danmuTemplates }),
      );
    }, 7000);

    return () => window.clearInterval(timer);
  }, []);

  return { interactions, openClawConversation, contestantOpenClawPresences };
};
```

- [ ] **Step 3: Replace inline room/feed derivation in `App.tsx` with room-module imports**

```ts
const { interactions, openClawConversation, contestantOpenClawPresences } = useSeedRoomSource();
const roomViewModel = buildRoomViewModel({
  activeStage,
  selectedEntityId,
  audioMode,
  priorityContestantId,
  contestants: contestantDeck,
  teams,
  audienceSummary,
  aiResults,
  interactions,
  openClawConversation,
  contestantOpenClawPresences,
});
```

- [ ] **Step 4: Run the full verification suite after the App rewrite**

Run: `npm test && npm run build`
Expected: PASS for all Vitest files and a successful production build with no TypeScript errors

- [ ] **Step 5: Do one manual smoke pass in the browser**

Run: `npm run dev`
Expected: the current hallway UI still supports stage changes, `Wave over`, audio-mode toggles, listener lists, and room callout updates without visual regressions

- [ ] **Step 6: Commit the App integration**

```bash
git add src/App.tsx src/room/useSeedRoomSource.ts src/room/index.ts
git commit -m "refactor: route app through room state boundary"
```

## Done Criteria

- `src/App.tsx` no longer owns the seed audience event generator or the stage-to-room derivation switch.
- The new `src/room/` directory contains the canonical room contracts and pure derivation logic.
- All newly extracted logic is covered by focused Vitest tests.
- `npm test` and `npm run build` pass after the refactor.
- Visible hallway behavior remains equivalent to the current demo.

## Risks To Watch

- Avoid moving presentation-only helpers into the room module if they are only used to shape JSX.
- Do not let `src/room/buildRoomViewModel.ts` become another 1000-line dumping ground; split once two unrelated responsibilities appear.
- Preserve deterministic tests by keeping seed interaction helpers pure and time-independent.

## Handoff Notes

- Use `.plan/project-gap-plan/findings.md` as the source analysis for why this phase exists.
- Do not start real `OpenClaw` SDK wiring until this boundary is merged and stable.
- The next plan after this one should cover live source integration, reconnect states, and multi-room hallway modeling.
