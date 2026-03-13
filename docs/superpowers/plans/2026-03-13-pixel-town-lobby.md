# Pixel Town Lobby Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-column dashboard with a full-screen pixel-art town map where users observe OpenClaw contestants in buildings.

**Architecture:** Pure DOM/CSS pixel art approach. New `PixelTownShell` component replaces the dashboard grid, rendering either `PixelTownMap` (bird's-eye) or `PixelRoomView` (zoomed room). A `buildTownLayout` pure adapter maps existing room state to town-specific layout data. All business logic and room-source hooks remain untouched.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, CSS (no libraries)

**Spec:** `docs/superpowers/specs/2026-03-13-pixel-town-lobby-design.md`

---

## Chunk 1: Foundation (Types + Adapter + CSS Tokens)

### Task 1: Extract Shared Entity Types

**Files:**
- Create: `src/types/entities.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/SpatialRoomFloor.tsx`

- [x]**Step 1: Create `src/types/entities.ts` with types extracted from App.tsx**

```typescript
// src/types/entities.ts
import type {
  ContestantOpenClawPresence,
  ContestantScorecard,
  OpenClawContestantState,
} from "../types";

export type SelectionKind = "contestant" | "judge" | "ai" | "listener";

export type SidebarEntity = {
  selectionId: string;
  refId: string;
  kind: SelectionKind;
  group: string;
  name: string;
  subtitle: string;
  status: string;
  badge: string;
  accent: string;
  avatar: string;
  searchable: string;
  x?: number;
  y?: number;
};

export type ContestantSeat = ContestantScorecard &
  ContestantOpenClawPresence & {
    selectionId: string;
    state: OpenClawContestantState;
    stateLabel: string;
    meter: number;
    teamName: string;
    stageNote: string;
    availabilityLabel: string;
    availabilityTone: "available" | "focus" | "busy";
  };

export type DetailCard = {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  stats: Array<{ label: string; value: string }>;
  chips: string[];
  actions?: Array<{ id: string; label: string; active?: boolean; disabled?: boolean }>;
};

export const buildSelectionId = (kind: SelectionKind, value: string) =>
  `${kind}:${value}`;

export const parseSelectionId = (value: string): [SelectionKind, string] => {
  const separator = value.indexOf(":");
  if (separator === -1) {
    return ["contestant", value];
  }
  return [value.slice(0, separator) as SelectionKind, value.slice(separator + 1)];
};

export const buildAvatar = (value: string) => {
  const compact = value.replace(/\s+/g, "");
  if (compact.length >= 2) {
    return `${compact[0]}${compact[compact.length - 1]}`;
  }
  return compact.slice(0, 2).toUpperCase();
};
```

- [x]**Step 2: Update `App.tsx` to import from shared types instead of defining inline**

Remove the inline `SelectionKind`, `SidebarEntity`, `ContestantSeat`, `DetailCard` type definitions and the `buildSelectionId`, `parseSelectionId`, `buildAvatar` functions from `App.tsx`. Replace with:

```typescript
import type { ContestantSeat, DetailCard, SidebarEntity } from "./types/entities";
import { buildAvatar, buildSelectionId, parseSelectionId } from "./types/entities";
```

Keep all other code in `App.tsx` unchanged.

- [x]**Step 3: Update `SpatialRoomFloor.tsx` to import from shared types**

Remove inline type definitions from `SpatialRoomFloor.tsx` (lines 1-63). Import from shared module:

```typescript
import type { ContestantSeat, SidebarEntity } from "../types/entities";
import type { AudioMode } from "../room/types";
import type { AudienceEvent, ContestantScorecard } from "../types";
```

Keep the `SpatialRoomFloorProps` type local to that file (it's component-specific).

- [x]**Step 4: Run tests to verify no regressions**

Run: `npx vitest run`
Expected: All existing tests pass (no logic changes, only type extraction)

- [x]**Step 5: Run type check**

Run: `npx tsc -b --noEmit`
Expected: No type errors

- [x]**Step 6: Commit**

```bash
git add src/types/entities.ts src/App.tsx src/components/SpatialRoomFloor.tsx
git commit -m "refactor: extract shared entity types into src/types/entities.ts"
```

---

### Task 2: Build Town Layout Adapter

**Files:**
- Create: `src/room/townLayout.ts`
- Create: `src/room/townLayout.test.ts`

- [x]**Step 1: Write failing test for `buildTownLayout`**

```typescript
// src/room/townLayout.test.ts
import { describe, expect, it } from "vitest";
import { buildTownLayout } from "./townLayout";
import type { RoomListItem } from "./types";
import type { ContestantSeat, SidebarEntity } from "../types/entities";

const makeRoom = (id: string, kind: "main-stage" | "team-room" | "quiet-orbit", memberIds: string[]): RoomListItem => ({
  id,
  name: id,
  kind,
  memberIds,
  memberCount: memberIds.length,
  audibleSummary: "",
  statusLabel: memberIds.length > 0 ? "Active" : "Empty",
  active: memberIds.length > 0,
});

const makeSeat = (id: string, color: string): ContestantSeat =>
  ({
    id,
    selectionId: `contestant:${id}`,
    palette: { primary: color },
    avatarGlyph: id.slice(0, 2),
    name: id,
  }) as unknown as ContestantSeat;

const makeListener = (id: string, kind: "judge" | "ai" | "listener"): SidebarEntity => ({
  selectionId: `${kind}:${id}`,
  refId: id,
  kind,
  group: "Observers",
  name: id,
  subtitle: "",
  status: "",
  badge: "",
  accent: "#f3b46c",
  avatar: "JG",
  searchable: id,
});

describe("buildTownLayout", () => {
  const rooms: RoomListItem[] = [
    makeRoom("main-stage", "main-stage", ["c1", "c2"]),
    makeRoom("team-room-1", "team-room", ["c3"]),
    makeRoom("team-room-2", "team-room", []),
    makeRoom("team-room-3", "team-room", []),
    makeRoom("quiet-orbit", "quiet-orbit", ["j1"]),
  ];

  const seats = [makeSeat("c1", "#ff0000"), makeSeat("c2", "#00ff00"), makeSeat("c3", "#0000ff")];
  const listeners = [makeListener("j1", "judge")];

  it("returns one TownBuilding per room", () => {
    const result = buildTownLayout(rooms, seats, listeners);
    expect(result).toHaveLength(5);
    expect(result.map((b) => b.roomId)).toEqual([
      "main-stage", "team-room-1", "team-room-2", "team-room-3", "quiet-orbit",
    ]);
  });

  it("assigns correct themes", () => {
    const result = buildTownLayout(rooms, seats, listeners);
    expect(result[0].theme).toBe("lobby");
    expect(result[1].theme).toBe("print-shop");
    expect(result[2].theme).toBe("clinic");
    expect(result[3].theme).toBe("convenience");
    expect(result[4].theme).toBe("quiet-zone");
  });

  it("places entities in correct buildings by memberIds", () => {
    const result = buildTownLayout(rooms, seats, listeners);
    const mainStage = result.find((b) => b.roomId === "main-stage")!;
    expect(mainStage.entities).toHaveLength(2);
    expect(mainStage.entities.map((e) => e.id)).toEqual(["c1", "c2"]);

    const team1 = result.find((b) => b.roomId === "team-room-1")!;
    expect(team1.entities).toHaveLength(1);
    expect(team1.entities[0].id).toBe("c3");

    const quietOrbit = result.find((b) => b.roomId === "quiet-orbit")!;
    expect(quietOrbit.entities).toHaveLength(1);
    expect(quietOrbit.entities[0].id).toBe("j1");
  });

  it("sets status based on room activity", () => {
    const result = buildTownLayout(rooms, seats, listeners);
    expect(result[0].status).toBe("active"); // main-stage has members
    expect(result[2].status).toBe("idle");   // team-room-2 is empty
  });

  it("distributes entity positions evenly within building bounds", () => {
    const result = buildTownLayout(rooms, seats, listeners);
    const mainStage = result.find((b) => b.roomId === "main-stage")!;
    // Two entities should have distinct positions, both within 0-100% range
    for (const entity of mainStage.entities) {
      expect(entity.x).toBeGreaterThanOrEqual(0);
      expect(entity.x).toBeLessThanOrEqual(100);
      expect(entity.y).toBeGreaterThanOrEqual(0);
      expect(entity.y).toBeLessThanOrEqual(100);
    }
    // Positions should differ
    if (mainStage.entities.length > 1) {
      const positions = mainStage.entities.map((e) => `${e.x},${e.y}`);
      expect(new Set(positions).size).toBe(positions.length);
    }
  });
});
```

- [x]**Step 2: Run test to verify it fails**

Run: `npx vitest run src/room/townLayout.test.ts`
Expected: FAIL — module not found

- [x]**Step 3: Implement `buildTownLayout`**

```typescript
// src/room/townLayout.ts
import type { RoomListItem } from "./types";
import type { ContestantSeat, SidebarEntity } from "../types/entities";

export type TownBuildingTheme = "lobby" | "print-shop" | "clinic" | "convenience" | "quiet-zone";

export interface TownBuildingEntity {
  id: string;
  selectionId: string;
  color: string;
  label: string;
  x: number;
  y: number;
}

export interface TownBuilding {
  roomId: string;
  name: string;
  theme: TownBuildingTheme;
  position: { x: number; y: number; width: number; height: number };
  entities: TownBuildingEntity[];
  status: "active" | "idle" | "live";
  memberCount: number;
}

const BUILDING_POSITIONS: Record<string, { x: number; y: number; w: number; h: number }> = {
  "main-stage":  { x: 30, y: 25, w: 40, h: 35 },
  "team-room-1": { x: 5,  y: 10, w: 22, h: 28 },
  "team-room-2": { x: 73, y: 10, w: 22, h: 28 },
  "team-room-3": { x: 5,  y: 58, w: 22, h: 28 },
  "quiet-orbit": { x: 73, y: 58, w: 22, h: 28 },
};

const ROOM_THEMES: Record<string, { theme: TownBuildingTheme; name: string }> = {
  "main-stage":  { theme: "lobby",       name: "大厅 LOBBY PLAZA" },
  "team-room-1": { theme: "print-shop",  name: "印刷所 PRINT SHOP" },
  "team-room-2": { theme: "clinic",      name: "诊所 CLINIC" },
  "team-room-3": { theme: "convenience", name: "杂货铺 CONVENIENCE" },
  "quiet-orbit": { theme: "quiet-zone",  name: "静默区 QUIET ZONE" },
};

const distributePositions = (count: number): Array<{ x: number; y: number }> => {
  if (count === 0) return [];
  if (count === 1) return [{ x: 50, y: 50 }];

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const positions: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: ((col + 0.5) / cols) * 100,
      y: ((row + 0.5) / rows) * 100,
    });
  }

  return positions;
};

export function buildTownLayout(
  rooms: RoomListItem[],
  contestantSeats: ContestantSeat[],
  listenerEntities: SidebarEntity[],
): TownBuilding[] {
  const seatMap = new Map(contestantSeats.map((s) => [s.id, s]));
  const listenerMap = new Map(listenerEntities.map((e) => [e.refId, e]));

  return rooms.map((room) => {
    const pos = BUILDING_POSITIONS[room.id] ?? { x: 50, y: 50, w: 20, h: 20 };
    const meta = ROOM_THEMES[room.id] ?? { theme: "quiet-zone" as const, name: room.name };

    const entities: TownBuildingEntity[] = [];
    const positions = distributePositions(room.memberIds.length);

    room.memberIds.forEach((memberId, index) => {
      const seat = seatMap.get(memberId);
      const listener = listenerMap.get(memberId);
      const entityPos = positions[index] ?? { x: 50, y: 50 };

      if (seat) {
        entities.push({
          id: seat.id,
          selectionId: seat.selectionId,
          color: seat.palette.primary,
          label: seat.avatarGlyph,
          x: entityPos.x,
          y: entityPos.y,
        });
      } else if (listener) {
        entities.push({
          id: listener.refId,
          selectionId: listener.selectionId,
          color: listener.accent,
          label: listener.avatar,
          x: entityPos.x,
          y: entityPos.y,
        });
      }
    });

    const hasLiveSpeaker = entities.some((e) => {
      const seat = seatMap.get(e.id);
      return seat && seat.state === "speaking";
    });

    return {
      roomId: room.id,
      name: meta.name,
      theme: meta.theme,
      position: { x: pos.x, y: pos.y, width: pos.w, height: pos.h },
      entities,
      status: hasLiveSpeaker ? "live" : room.active ? "active" : "idle",
      memberCount: entities.length,
    };
  });
}
```

- [x]**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/room/townLayout.test.ts`
Expected: All 5 tests PASS

- [x]**Step 5: Commit**

```bash
git add src/room/townLayout.ts src/room/townLayout.test.ts
git commit -m "feat: add buildTownLayout adapter for pixel town map"
```

---

### Task 3: Create CSS Design Tokens and Base Styles

**Files:**
- Create: `src/pixel-town.css`

- [x]**Step 1: Create `pixel-town.css` with design tokens and base layout**

```css
/* src/pixel-town.css — Pixel Town design system */

/* === Design Tokens === */
:root {
  --pt-paper: #F0EDE8;
  --pt-gray: #D7D9D6;
  --pt-ink: #141010;
  --pt-crimson: #D62520;
  --pt-dust: #B49A8F;
  --pt-damp: #76827D;
  --pt-tile: 16px;
  --pt-shadow: 4px 4px 0 var(--pt-ink);
  --pt-font: "IBM Plex Mono", "SF Mono", "Menlo", monospace;
  --pt-transition: 300ms ease-out;
}

/* === App Shell === */
.pixel-town-app {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--pt-ink);
  font-family: var(--pt-font);
  color: var(--pt-ink);
}

/* === Town Map === */
.town-map-container {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  transition: transform var(--pt-transition), opacity 200ms ease;
}

.town-map-container.is-zooming {
  transform: scale(3) translate(var(--zoom-x, 0%), var(--zoom-y, 0%));
  opacity: 0;
  pointer-events: none;
}

.town-map {
  position: relative;
  width: min(1200px, 90vw);
  height: min(800px, 80vh);
  background-color: var(--pt-gray);
  background-image:
    linear-gradient(var(--pt-dust) 1px, transparent 1px),
    linear-gradient(90deg, var(--pt-dust) 1px, transparent 1px);
  background-size: var(--pt-tile) var(--pt-tile);
  image-rendering: pixelated;
}

/* Edge fog */
.town-map::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at center, transparent 50%, var(--pt-ink) 100%);
}

/* Central crimson X */
.town-map-x {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 96px;
  font-weight: 900;
  color: var(--pt-crimson);
  opacity: 0.18;
  pointer-events: none;
  line-height: 1;
}

/* === Buildings === */
.town-building {
  position: absolute;
  border: 3px solid var(--pt-ink);
  box-shadow: var(--pt-shadow);
  padding: 8px;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.town-building:hover,
.town-building:focus-visible {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--pt-ink);
}

.town-building--lobby      { background: var(--pt-paper); }
.town-building--print-shop { background: #E2DDD6; }
.town-building--clinic     { background: #D8DDE0; }
.town-building--convenience { background: #DDD8D2; }
.town-building--quiet-zone {
  background: var(--pt-damp);
  opacity: 0.7;
}

.town-building__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
}

.town-building__name {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--pt-ink);
}

.town-building__count {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border: 2px solid var(--pt-ink);
  background: var(--pt-paper);
  min-width: 18px;
  text-align: center;
}

.town-building__lamp {
  width: 8px;
  height: 8px;
  border: 2px solid var(--pt-ink);
}

.town-building__lamp--active { background: #86ea84; }
.town-building__lamp--idle   { background: var(--pt-gray); }
.town-building__lamp--live   {
  background: #86ea84;
  animation: lamp-pulse 1.2s ease-in-out infinite;
}

@keyframes lamp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.town-building__door {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 6px;
  background: var(--pt-crimson);
}

.town-building__entities {
  flex: 1;
  position: relative;
  min-height: 32px;
}

/* === Entity Dots (Town View) === */
.town-entity-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid var(--pt-ink);
  transform: translate(-50%, -50%);
  cursor: pointer;
  transition: transform 120ms ease;
}

.town-entity-dot:hover {
  transform: translate(-50%, -50%) scale(1.3);
  z-index: 10;
}

/* === Room View === */
.pixel-room {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  animation: room-fade-in 200ms ease-out;
}

@keyframes room-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.pixel-room__ground {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: var(--pt-paper);
  background-image:
    linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px);
  background-size: var(--pt-tile) var(--pt-tile);
}

.pixel-room__ground--lobby      { background-color: var(--pt-paper); }
.pixel-room__ground--print-shop { background-color: #E2DDD6; }
.pixel-room__ground--clinic     { background-color: #D8DDE0; }
.pixel-room__ground--convenience { background-color: #DDD8D2; }
.pixel-room__ground--quiet-zone { background-color: var(--pt-damp); }

.pixel-room__conversation-ring {
  position: absolute;
  left: 50%;
  top: 47%;
  width: min(520px, 52vw);
  height: min(320px, 34vw);
  transform: translate(-50%, -50%);
  border: 2px dashed var(--pt-dust);
}

.pixel-room__back {
  position: absolute;
  top: 60px;
  left: 16px;
  z-index: 30;
  border: 3px solid var(--pt-ink);
  box-shadow: var(--pt-shadow);
  background: var(--pt-paper);
  color: var(--pt-ink);
  font-family: var(--pt-font);
  font-size: 12px;
  font-weight: 700;
  padding: 6px 12px;
  cursor: pointer;
  letter-spacing: 0.06em;
}

.pixel-room__back:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--pt-ink);
}

/* === Sprites (Room View) === */
.pixel-sprite {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: left 400ms ease, top 400ms ease;
}

.pixel-sprite__token {
  width: 32px;
  height: 32px;
  border: 2px solid var(--pt-ink);
  border-radius: 4px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 800;
  color: var(--pt-ink);
  box-shadow: 2px 2px 0 var(--pt-ink);
}

.pixel-sprite__token--speaking {
  box-shadow: 2px 2px 0 var(--pt-ink), 0 0 0 3px rgba(134, 234, 132, 0.5);
}

.pixel-sprite__token--raised-hand {
  box-shadow: 2px 2px 0 var(--pt-ink), 0 0 0 3px rgba(242, 179, 109, 0.5);
}

.pixel-sprite__name {
  font-size: 9px;
  font-weight: 700;
  color: var(--pt-ink);
  white-space: nowrap;
  padding: 1px 4px;
  background: rgba(240, 237, 232, 0.85);
  border: 1px solid var(--pt-ink);
}

.pixel-sprite__bubble {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  max-width: 160px;
  padding: 4px 8px;
  background: var(--pt-paper);
  border: 2px solid var(--pt-ink);
  box-shadow: 2px 2px 0 var(--pt-ink);
  font-size: 10px;
  color: var(--pt-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pixel-sprite.is-selected .pixel-sprite__token {
  box-shadow: 2px 2px 0 var(--pt-ink), 0 0 0 3px var(--pt-crimson);
}

/* === Overlays === */
.town-overlay {
  position: absolute;
  z-index: 20;
  pointer-events: none;
}

.town-overlay > * {
  pointer-events: auto;
}

.town-overlay--top {
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 16px;
}

.town-overlay--bottom {
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 12px 16px;
}

.town-overlay__panel {
  padding: 8px 14px;
  background: rgba(20, 16, 16, 0.85);
  backdrop-filter: blur(8px);
  border: 2px solid rgba(240, 237, 232, 0.15);
  color: var(--pt-paper);
  font-family: var(--pt-font);
  font-size: 11px;
  letter-spacing: 0.06em;
}

.town-overlay__title {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
}

.town-overlay__crimson-icon {
  width: 12px;
  height: 12px;
  background: var(--pt-crimson);
}

.town-overlay__subtitle {
  margin-top: 2px;
  opacity: 0.7;
  font-size: 10px;
}

.town-overlay__status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.town-overlay__dot {
  width: 8px;
  height: 8px;
  border: 1px solid rgba(240, 237, 232, 0.3);
}

.town-overlay__dot--connected { background: #86ea84; }
.town-overlay__dot--reconnecting { background: #f2b36d; }
.town-overlay__dot--disconnected { background: #f08f8f; }

.town-overlay__ticker {
  max-width: 50vw;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Audio control buttons */
.town-overlay__controls {
  display: flex;
  gap: 4px;
}

.town-overlay__control-btn {
  padding: 6px 10px;
  border: 2px solid rgba(240, 237, 232, 0.2);
  background: rgba(20, 16, 16, 0.85);
  color: var(--pt-paper);
  font-family: var(--pt-font);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: border-color 120ms ease;
}

.town-overlay__control-btn:hover {
  border-color: rgba(240, 237, 232, 0.5);
}

.town-overlay__control-btn.is-active {
  border-color: var(--pt-crimson);
  background: rgba(214, 37, 32, 0.2);
}

/* === Entity Detail Panel === */
.entity-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  z-index: 30;
  background: rgba(20, 16, 16, 0.92);
  backdrop-filter: blur(12px);
  border-left: 2px solid rgba(240, 237, 232, 0.12);
  color: var(--pt-paper);
  font-family: var(--pt-font);
  padding: 20px 16px;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 250ms ease-out;
}

.entity-panel.is-open {
  transform: translateX(0);
}

.entity-panel__close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: 2px solid rgba(240, 237, 232, 0.2);
  background: transparent;
  color: var(--pt-paper);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.entity-panel__badge {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.6;
}

.entity-panel__title {
  font-size: 16px;
  font-weight: 800;
  margin-top: 4px;
}

.entity-panel__subtitle {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.7;
}

.entity-panel__description {
  font-size: 12px;
  margin-top: 12px;
  line-height: 1.5;
  opacity: 0.85;
}

.entity-panel__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 14px;
}

.entity-panel__stat {
  padding: 8px;
  border: 1px solid rgba(240, 237, 232, 0.1);
  background: rgba(240, 237, 232, 0.04);
}

.entity-panel__stat-label {
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.5;
}

.entity-panel__stat-value {
  font-size: 13px;
  font-weight: 700;
  margin-top: 2px;
}

.entity-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.entity-panel__chip {
  padding: 4px 8px;
  border: 1px solid rgba(240, 237, 232, 0.15);
  background: rgba(240, 237, 232, 0.06);
  font-size: 10px;
}

/* === Entity Search Overlay === */
.entity-search {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: start center;
  padding-top: 20vh;
  background: rgba(20, 16, 16, 0.6);
  backdrop-filter: blur(4px);
}

.entity-search__box {
  width: min(400px, 80vw);
  background: rgba(20, 16, 16, 0.95);
  border: 2px solid rgba(240, 237, 232, 0.2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.entity-search__input {
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-bottom: 1px solid rgba(240, 237, 232, 0.1);
  background: transparent;
  color: var(--pt-paper);
  font-family: var(--pt-font);
  font-size: 13px;
  outline: none;
}

.entity-search__results {
  max-height: 240px;
  overflow-y: auto;
}

.entity-search__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--pt-paper);
  font-family: var(--pt-font);
  font-size: 11px;
  cursor: pointer;
  text-align: left;
}

.entity-search__item:hover,
.entity-search__item.is-focused {
  background: rgba(240, 237, 232, 0.08);
}

.entity-search__item-dot {
  width: 10px;
  height: 10px;
  border: 2px solid var(--pt-ink);
  flex-shrink: 0;
}

/* === Responsive === */
@media (max-width: 1200px) {
  .town-building__name {
    font-size: 8px;
  }
  .town-entity-dot {
    width: 8px;
    height: 8px;
  }
}

@media (max-width: 920px) {
  .town-map-container {
    display: grid;
    place-items: center;
  }
  .town-map {
    display: none;
  }
  .pixel-town-app::after {
    content: "Best viewed on a wider screen.";
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--pt-paper);
    font-family: var(--pt-font);
    font-size: 14px;
    text-align: center;
    padding: 20px;
  }
}

/* === Demo Control Panel (floating) === */
.pixel-town-app .demo-control-panel {
  position: absolute;
  bottom: 60px;
  right: 16px;
  z-index: 25;
  max-width: 360px;
}
```

- [x]**Step 2: Import `pixel-town.css` in `main.tsx`**

Add to `src/main.tsx`:
```typescript
import "./pixel-town.css";
```

- [x]**Step 3: Commit**

```bash
git add src/pixel-town.css src/main.tsx
git commit -m "feat: add pixel town CSS design system with tokens and base styles"
```

---

## Chunk 2: Core Components (Shell + Map + Room View)

### Task 4: Create PixelTownMap Component

**Files:**
- Create: `src/components/PixelTownMap.tsx`

- [x]**Step 1: Create `PixelTownMap.tsx`**

```typescript
// src/components/PixelTownMap.tsx
import type { TownBuilding } from "../room/townLayout";

type PixelTownMapProps = {
  buildings: TownBuilding[];
  onEnterRoom: (roomId: string) => void;
  onSelectEntity: (selectionId: string) => void;
};

function PixelTownMap({ buildings, onEnterRoom, onSelectEntity }: PixelTownMapProps) {
  return (
    <div className="town-map">
      <span className="town-map-x" aria-hidden="true">X</span>

      {buildings.map((building) => (
        <button
          key={building.roomId}
          className={`town-building town-building--${building.theme}`}
          style={{
            left: `${building.position.x}%`,
            top: `${building.position.y}%`,
            width: `${building.position.width}%`,
            height: `${building.position.height}%`,
          }}
          onClick={() => onEnterRoom(building.roomId)}
          aria-label={`${building.name} — ${building.memberCount} occupants`}
          type="button"
        >
          <div className="town-building__header">
            <span className="town-building__name">{building.name}</span>
            <span className="town-building__count">{building.memberCount}</span>
            <span className={`town-building__lamp town-building__lamp--${building.status}`} />
          </div>

          <div className="town-building__entities">
            {building.entities.map((entity) => (
              <span
                key={entity.id}
                className="town-entity-dot"
                style={{
                  left: `${entity.x}%`,
                  top: `${entity.y}%`,
                  background: entity.color,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity(entity.selectionId);
                }}
                role="button"
                tabIndex={0}
                aria-label={entity.label}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onSelectEntity(entity.selectionId);
                  }
                }}
              />
            ))}
          </div>

          <span className="town-building__door" />
        </button>
      ))}
    </div>
  );
}

export default PixelTownMap;
```

- [x]**Step 2: Commit**

```bash
git add src/components/PixelTownMap.tsx
git commit -m "feat: add PixelTownMap component with buildings and entity dots"
```

---

### Task 5: Create PixelRoomView Component

**Files:**
- Create: `src/components/PixelRoomView.tsx`

- [x]**Step 1: Create `PixelRoomView.tsx`**

```typescript
// src/components/PixelRoomView.tsx
import type { RoomListItem } from "../room/types";
import type { TownBuildingTheme } from "../room/townLayout";
import type { ContestantSeat, SidebarEntity } from "../types/entities";
import type { AudienceEvent, ContestantScorecard } from "../types";
import type { AudioMode } from "../room/types";

type PixelRoomViewProps = {
  room: RoomListItem;
  theme: TownBuildingTheme;
  contestantSeats: ContestantSeat[];
  listenerEntities: SidebarEntity[];
  audibleSignals: AudienceEvent[];
  contestantMap: Record<string, ContestantScorecard>;
  roomCallout: string;
  audioMode: AudioMode;
  selectedEntityId: string;
  onSelectEntity: (selectionId: string) => void;
  onBack: () => void;
};

const listenerSpots = [
  { x: 16, y: 18 }, { x: 84, y: 18 },
  { x: 18, y: 72 }, { x: 82, y: 72 },
  { x: 72, y: 26 }, { x: 26, y: 28 },
  { x: 64, y: 82 }, { x: 34, y: 84 },
  { x: 90, y: 48 }, { x: 10, y: 48 },
];

function PixelRoomView({
  room,
  theme,
  contestantSeats,
  listenerEntities,
  audibleSignals,
  contestantMap,
  roomCallout,
  selectedEntityId,
  onSelectEntity,
  onBack,
}: PixelRoomViewProps) {
  // Find the latest signal per contestant for speech bubbles
  const latestSignalByContestant = new Map<string, string>();
  for (const signal of audibleSignals.slice(-10)) {
    latestSignalByContestant.set(signal.contestantId, signal.content);
  }

  return (
    <div className="pixel-room" role="region" aria-label={`Room: ${room.name}`}>
      <div className={`pixel-room__ground pixel-room__ground--${theme}`}>
        <div className="pixel-room__conversation-ring" />

        {/* Contestant sprites */}
        {contestantSeats.map((seat) => {
          const bubble = latestSignalByContestant.get(seat.id);
          return (
            <button
              key={seat.selectionId}
              className={`pixel-sprite ${selectedEntityId === seat.selectionId ? "is-selected" : ""}`}
              style={{
                left: `${seat.roomX}%`,
                top: `${seat.roomY}%`,
                zIndex: 200 + Math.round(seat.roomY),
              }}
              onClick={() => onSelectEntity(seat.selectionId)}
              aria-label={`${seat.name} — ${seat.stateLabel}`}
              type="button"
            >
              {bubble && <span className="pixel-sprite__bubble">{bubble}</span>}
              <span
                className={`pixel-sprite__token pixel-sprite__token--${seat.state}`}
                style={{ background: seat.palette.primary }}
              >
                {seat.avatarGlyph}
              </span>
              <span className="pixel-sprite__name">{seat.name}</span>
            </button>
          );
        })}

        {/* Listener sprites */}
        {listenerEntities
          .filter((entity) => entity.x !== undefined && entity.y !== undefined)
          .map((entity, index) => (
            <button
              key={entity.selectionId}
              className={`pixel-sprite ${selectedEntityId === entity.selectionId ? "is-selected" : ""}`}
              style={{
                left: `${entity.x ?? listenerSpots[index]?.x ?? 50}%`,
                top: `${entity.y ?? listenerSpots[index]?.y ?? 50}%`,
                zIndex: Math.round(entity.y ?? 0),
              }}
              onClick={() => onSelectEntity(entity.selectionId)}
              aria-label={`${entity.name} — ${entity.badge}`}
              type="button"
            >
              <span
                className="pixel-sprite__token"
                style={{ background: entity.accent }}
              >
                {entity.avatar}
              </span>
              <span className="pixel-sprite__name">{entity.name}</span>
            </button>
          ))}

        {/* Room callout */}
        {roomCallout && (
          <div className="pixel-room__callout" style={{
            position: "absolute",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
          }}>
            <span className="town-overlay__panel">{roomCallout}</span>
          </div>
        )}
      </div>

      <button
        className="pixel-room__back"
        onClick={onBack}
        type="button"
      >
        ← BACK TO TOWN
      </button>
    </div>
  );
}

export default PixelRoomView;
```

- [x]**Step 2: Commit**

```bash
git add src/components/PixelRoomView.tsx
git commit -m "feat: add PixelRoomView component with sprites and speech bubbles"
```

---

### Task 6: Create TownOverlay Component

**Files:**
- Create: `src/components/TownOverlay.tsx`

- [x]**Step 1: Create `TownOverlay.tsx`**

```typescript
// src/components/TownOverlay.tsx
import type { AudioMode } from "../room/types";
import type { AudienceEvent } from "../types";

type TownOverlayProps = {
  locationLabel: string;
  subtitle: string;
  onlineCount: number;
  activeStageOrder: number;
  audioMode: AudioMode;
  onSetAudioMode: (mode: AudioMode) => void;
  latestSignal: AudienceEvent | null;
  contestantNameById: Record<string, string>;
  connectionStatus?: string;
};

const audioModes: AudioMode[] = ["nearby", "focus", "muted"];

function TownOverlay({
  locationLabel,
  subtitle,
  onlineCount,
  activeStageOrder,
  audioMode,
  onSetAudioMode,
  latestSignal,
  contestantNameById,
  connectionStatus,
}: TownOverlayProps) {
  const statusClass = connectionStatus === "connected"
    ? "town-overlay__dot--connected"
    : connectionStatus === "reconnecting"
      ? "town-overlay__dot--reconnecting"
      : "town-overlay__dot--disconnected";

  const tickerText = latestSignal
    ? `${contestantNameById[latestSignal.contestantId] ?? latestSignal.source}: ${latestSignal.content}`
    : "";

  return (
    <>
      <div className="town-overlay town-overlay--top">
        <div className="town-overlay__panel">
          <div className="town-overlay__title">
            <span className="town-overlay__crimson-icon" />
            {locationLabel}
          </div>
          <div className="town-overlay__subtitle">{subtitle}</div>
        </div>
        <div className="town-overlay__panel town-overlay__status">
          <span className={`town-overlay__dot ${statusClass}`} />
          <span>{onlineCount} online</span>
          <span>Act {activeStageOrder}</span>
        </div>
      </div>

      <div className="town-overlay town-overlay--bottom">
        <div className="town-overlay__panel town-overlay__ticker" aria-live="polite">
          {tickerText}
        </div>
        <div className="town-overlay__panel town-overlay__controls">
          {audioModes.map((mode) => (
            <button
              key={mode}
              className={`town-overlay__control-btn ${audioMode === mode ? "is-active" : ""}`}
              onClick={() => onSetAudioMode(mode)}
              type="button"
            >
              {mode === "nearby" ? "Nearby" : mode === "focus" ? "Focus" : "Mute"}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default TownOverlay;
```

- [x]**Step 2: Commit**

```bash
git add src/components/TownOverlay.tsx
git commit -m "feat: add TownOverlay component with status bars and audio controls"
```

---

### Task 7: Create EntityDetailPanel Component

**Files:**
- Create: `src/components/EntityDetailPanel.tsx`

- [x]**Step 1: Create `EntityDetailPanel.tsx`**

```typescript
// src/components/EntityDetailPanel.tsx
import { useEffect, useRef } from "react";
import type { DetailCard } from "../types/entities";

type EntityDetailPanelProps = {
  card: DetailCard | null;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (actionId: string) => void;
};

function EntityDetailPanel({ card, isOpen, onClose, onAction }: EntityDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div
      ref={panelRef}
      className={`entity-panel ${isOpen && card ? "is-open" : ""}`}
      role="dialog"
      aria-label="Entity details"
    >
      {card && (
        <>
          <button className="entity-panel__close" onClick={onClose} type="button" aria-label="Close">
            ×
          </button>
          <div className="entity-panel__badge">{card.badge}</div>
          <div className="entity-panel__title">{card.title}</div>
          <div className="entity-panel__subtitle">{card.subtitle}</div>
          <div className="entity-panel__description">{card.description}</div>

          <div className="entity-panel__stats">
            {card.stats.map((stat) => (
              <div key={stat.label} className="entity-panel__stat">
                <div className="entity-panel__stat-label">{stat.label}</div>
                <div className="entity-panel__stat-value">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="entity-panel__chips">
            {card.chips.map((chip) => (
              <span key={chip} className="entity-panel__chip">{chip}</span>
            ))}
          </div>

          {card.actions && card.actions.length > 0 && (
            <div className="entity-panel__chips" style={{ marginTop: "12px" }}>
              {card.actions.map((action) => (
                <button
                  key={action.id}
                  className={`town-overlay__control-btn ${action.active ? "is-active" : ""}`}
                  onClick={() => onAction?.(action.id)}
                  disabled={action.disabled}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default EntityDetailPanel;
```

- [x]**Step 2: Commit**

```bash
git add src/components/EntityDetailPanel.tsx
git commit -m "feat: add EntityDetailPanel slide-in component"
```

---

### Task 8: Create EntitySearchOverlay Component

**Files:**
- Create: `src/components/EntitySearchOverlay.tsx`

- [x]**Step 1: Create `EntitySearchOverlay.tsx`**

```typescript
// src/components/EntitySearchOverlay.tsx
import { useEffect, useRef, useState } from "react";
import type { ContestantSeat, SidebarEntity } from "../types/entities";

type SearchableEntity = {
  selectionId: string;
  name: string;
  color: string;
  searchable: string;
};

type EntitySearchOverlayProps = {
  isOpen: boolean;
  contestantSeats: ContestantSeat[];
  listenerEntities: SidebarEntity[];
  onSelect: (selectionId: string) => void;
  onClose: () => void;
};

function EntitySearchOverlay({
  isOpen,
  contestantSeats,
  listenerEntities,
  onSelect,
  onClose,
}: EntitySearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allEntities: SearchableEntity[] = [
    ...contestantSeats.map((s) => ({
      selectionId: s.selectionId,
      name: s.name,
      color: s.palette.primary,
      searchable: `${s.name} ${s.teamName} ${s.stateLabel}`,
    })),
    ...listenerEntities.map((e) => ({
      selectionId: e.selectionId,
      name: e.name,
      color: e.accent,
      searchable: e.searchable,
    })),
  ];

  const filtered = query.trim()
    ? allEntities.filter((e) => e.searchable.toLowerCase().includes(query.toLowerCase()))
    : allEntities;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setFocusIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setFocusIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[focusIndex]) {
      onSelect(filtered[focusIndex].selectionId);
      onClose();
    }
  };

  return (
    <div className="entity-search" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="entity-search__box" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="entity-search__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities..."
        />
        <div className="entity-search__results">
          {filtered.slice(0, 10).map((entity, index) => (
            <button
              key={entity.selectionId}
              className={`entity-search__item ${index === focusIndex ? "is-focused" : ""}`}
              onClick={() => {
                onSelect(entity.selectionId);
                onClose();
              }}
              type="button"
            >
              <span
                className="entity-search__item-dot"
                style={{ background: entity.color }}
              />
              {entity.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="entity-search__item" style={{ opacity: 0.5 }}>
              No matches
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EntitySearchOverlay;
```

- [x]**Step 2: Commit**

```bash
git add src/components/EntitySearchOverlay.tsx
git commit -m "feat: add EntitySearchOverlay command palette component"
```

---

## Chunk 3: Shell + App Integration

### Task 9: Create PixelTownShell Component

**Files:**
- Create: `src/components/PixelTownShell.tsx`

- [x]**Step 1: Create `PixelTownShell.tsx`**

```typescript
// src/components/PixelTownShell.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomDirectory } from "../room/types";
import type { AudioMode, RoomListItem } from "../room/types";
import { buildTownLayout, type TownBuilding, type TownBuildingTheme } from "../room/townLayout";
import type { ContestantSeat, DetailCard, SidebarEntity } from "../types/entities";
import type { AudienceEvent, ContestantScorecard } from "../types";
import PixelTownMap from "./PixelTownMap";
import PixelRoomView from "./PixelRoomView";
import TownOverlay from "./TownOverlay";
import EntityDetailPanel from "./EntityDetailPanel";
import EntitySearchOverlay from "./EntitySearchOverlay";

type PixelTownShellProps = {
  roomDirectory: RoomDirectory;
  contestantSeats: ContestantSeat[];
  listenerEntities: SidebarEntity[];
  audibleSignals: AudienceEvent[];
  contestantMap: Record<string, ContestantScorecard>;
  contestantNameById: Record<string, string>;
  roomCallout: string;
  audioMode: AudioMode;
  onSetAudioMode: (mode: AudioMode) => void;
  selectedEntityId: string;
  onSelectEntity: (selectionId: string) => void;
  detailCard: DetailCard;
  onDetailAction: (actionId: string) => void;
  activeStageOrder: number;
  conversationTitle: string;
  onlineCount: number;
  connectionStatus?: string;
  onSwitchRoom: (roomId: string) => void;
  children?: React.ReactNode; // for DemoControlPanel
};

const THEME_MAP: Record<string, TownBuildingTheme> = {
  "main-stage": "lobby",
  "team-room-1": "print-shop",
  "team-room-2": "clinic",
  "team-room-3": "convenience",
  "quiet-orbit": "quiet-zone",
};

function PixelTownShell({
  roomDirectory,
  contestantSeats,
  listenerEntities,
  audibleSignals,
  contestantMap,
  contestantNameById,
  roomCallout,
  audioMode,
  onSetAudioMode,
  selectedEntityId,
  onSelectEntity,
  detailCard,
  onDetailAction,
  activeStageOrder,
  conversationTitle,
  onlineCount,
  connectionStatus,
  onSwitchRoom,
  children,
}: PixelTownShellProps) {
  const [viewMode, setViewMode] = useState<"town" | "room">("town");
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const buildings = useMemo(
    () => buildTownLayout(roomDirectory.rooms, contestantSeats, listenerEntities),
    [roomDirectory.rooms, contestantSeats, listenerEntities],
  );

  const focusBuilding = buildings.find((b) => b.roomId === focusRoomId);
  const focusRoom = roomDirectory.rooms.find((r) => r.id === focusRoomId);

  // Filter contestants to only those in the focused room (C1: room-scoped rendering)
  const roomContestantSeats = useMemo(() => {
    if (!focusRoom) return [];
    const memberSet = new Set(focusRoom.memberIds);
    return contestantSeats.filter((s) => memberSet.has(s.id));
  }, [contestantSeats, focusRoom]);

  // Filter listeners similarly
  const roomListenerEntities = useMemo(() => {
    if (!focusRoom) return [];
    const memberSet = new Set(focusRoom.memberIds);
    return listenerEntities.filter((e) => memberSet.has(e.refId));
  }, [listenerEntities, focusRoom]);

  const locationLabel = viewMode === "room" && focusBuilding
    ? focusBuilding.name
    : "PIXEL TOWN";

  const latestSignal = audibleSignals.length > 0
    ? audibleSignals[audibleSignals.length - 1]
    : null;

  const handleEnterRoom = useCallback((roomId: string) => {
    const building = buildings.find((b) => b.roomId === roomId);
    if (!building) return;

    // Compute zoom target from building center
    const centerX = -(building.position.x + building.position.width / 2 - 50);
    const centerY = -(building.position.y + building.position.height / 2 - 50);

    if (mapRef.current) {
      mapRef.current.style.setProperty("--zoom-x", `${centerX}%`);
      mapRef.current.style.setProperty("--zoom-y", `${centerY}%`);
    }

    setIsZooming(true);
    setFocusRoomId(roomId);
    onSwitchRoom(roomId);

    // Swap view after transition
    setTimeout(() => {
      setViewMode("room");
      setIsZooming(false);
    }, 300);
  }, [buildings, onSwitchRoom]);

  const handleBackToTown = useCallback(() => {
    setViewMode("town");
    setFocusRoomId(null);
    onSwitchRoom("main-stage");
  }, [onSwitchRoom]);

  const handleSelectEntity = useCallback((selectionId: string) => {
    onSelectEntity(selectionId);
    setDetailOpen(true);
  }, [onSelectEntity]);

  // Keyboard: Escape to close panel or go back, Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (searchOpen) {
          setSearchOpen(false);
        } else if (detailOpen) {
          setDetailOpen(false);
        } else if (viewMode === "room") {
          handleBackToTown();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, detailOpen, viewMode, handleBackToTown]);

  return (
    <div className="pixel-town-app">
      {viewMode === "town" && (
        <div
          ref={mapRef}
          className={`town-map-container ${isZooming ? "is-zooming" : ""}`}
        >
          <PixelTownMap
            buildings={buildings}
            onEnterRoom={handleEnterRoom}
            onSelectEntity={handleSelectEntity}
          />
        </div>
      )}

      {viewMode === "room" && focusRoom && (
        <PixelRoomView
          room={focusRoom}
          theme={THEME_MAP[focusRoom.id] ?? "quiet-zone"}
          contestantSeats={roomContestantSeats}
          listenerEntities={roomListenerEntities}
          audibleSignals={audibleSignals}
          contestantMap={contestantMap}
          roomCallout={roomCallout}
          audioMode={audioMode}
          selectedEntityId={selectedEntityId}
          onSelectEntity={handleSelectEntity}
          onBack={handleBackToTown}
        />
      )}

      <TownOverlay
        locationLabel={locationLabel}
        subtitle={conversationTitle}
        onlineCount={onlineCount}
        activeStageOrder={activeStageOrder}
        audioMode={audioMode}
        onSetAudioMode={onSetAudioMode}
        latestSignal={latestSignal}
        contestantNameById={contestantNameById}
        connectionStatus={connectionStatus}
      />

      <EntityDetailPanel
        card={detailCard}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAction={onDetailAction}
      />

      <EntitySearchOverlay
        isOpen={searchOpen}
        contestantSeats={contestantSeats}
        listenerEntities={listenerEntities}
        onSelect={handleSelectEntity}
        onClose={() => setSearchOpen(false)}
      />

      {/* DemoControlPanel passed as children */}
      {children}
    </div>
  );
}

export default PixelTownShell;
```

- [x]**Step 2: Commit**

```bash
git add src/components/PixelTownShell.tsx
git commit -m "feat: add PixelTownShell with view state, zoom transitions, and keyboard nav"
```

---

### Task 10: Wire App.tsx to PixelTownShell

**Files:**
- Modify: `src/App.tsx`

- [x]**Step 1: Replace App.tsx rendering with PixelTownShell**

In `App.tsx`, make these changes:

1. **Add import:**
```typescript
import PixelTownShell from "./components/PixelTownShell";
```

2. **Replace the return block** (the entire `<div className="openclaw-app">...</div>`) with:

```typescript
return (
  <PixelTownShell
    roomDirectory={roomDirectory}
    contestantSeats={openClawSeats}
    listenerEntities={listenerEntities}
    audibleSignals={audibleSignals}
    contestantMap={contestantMap}
    contestantNameById={contestantNameById}
    roomCallout={roomCallout}
    audioMode={audioMode}
    onSetAudioMode={actions.setAudioMode}
    selectedEntityId={selectedEntityId}
    onSelectEntity={selectEntity}
    detailCard={detailCard}
    onDetailAction={handleDetailAction}
    activeStageOrder={activeStage.order}
    conversationTitle={openClawConversation.title}
    onlineCount={onlineCount}
    connectionStatus={snapshot.connectionStatus}
    onSwitchRoom={actions.switchRoom}
  >
    <DemoControlPanel
      currentRoomId={snapshot.currentRoomId}
      currentRoomName={roomDirectory.currentRoom.name}
      currentRoomStatus={roomDirectory.currentRoom.statusLabel}
      currentUserMode={currentUserMode}
      audioMode={snapshot.audioMode}
      feedPaused={snapshot.feedPaused}
      connectionStatus={snapshot.connectionStatus}
      roomSwitchTargets={roomDirectory.rooms.map((r) => ({ id: r.id, name: r.name }))}
      onSwitchRoom={actions.switchRoom}
      onJoinConversation={actions.joinConversation}
      onLeaveConversation={actions.leaveConversation}
      onSetAudioMode={actions.setAudioMode}
      onToggleFeedPaused={actions.toggleFeedPaused}
      onInjectScenario={actions.injectScenario}
      onResetDemo={actions.resetDemo}
    />
  </PixelTownShell>
);
```

3. **Remove unused imports** for `PresenceSidebar`, `ConversationDock`, `SpatialRoomFloor`.

4. **Remove the `simplifiedView` state** and `setSimplifiedView` (no longer needed — pixel town has no simplified view toggle). Also remove `simplifiedView` from the `detailCard` dependency array.

5. **Remove unused computed values** that were only consumed by removed components: `railItems` constant, `contestantGroups`, `listenerGroups`, `contestantSidebar`, `filteredContestants`, `filteredListeners`. Also remove `memberQuery`, `setMemberQuery`, `deferredQuery` (search moved to `EntitySearchOverlay`).

6. **Keep `speakerSeats`** — it is still used in the `detailCard` useMemo as a fallback (`speakerSeats[0]`). Alternatively, replace the fallback with `openClawSeats[0]` and then remove `speakerSeats`. Either way the `detailCard` computation must compile.

7. **Remove `simplifiedView` from `detailCard` dependency array** (line 648 of current App.tsx) — it was a stale dependency.

- [x]**Step 2: Run type check**

Run: `npx tsc -b --noEmit`
Expected: No type errors

- [x]**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass. Note: `App.room-flow.test.tsx` may need adjustment if it references removed DOM elements like the sidebar. If it fails, fix the selectors in the next step.

- [x]**Step 4: Fix any broken tests**

If `App.room-flow.test.tsx` fails because it looks for sidebar/dock elements that no longer exist, update the test to use the new pixel town structure instead. The core room-flow logic tests (in `src/room/`) should pass unchanged.

- [x]**Step 5: Run dev server and visually verify**

Run: `npx vite`
Expected: Browser shows pixel-art town map with buildings, entity dots, and overlay bars. Clicking a building zooms into room view. Clicking entity dots opens detail panel.

- [x]**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire App.tsx to PixelTownShell, replace dashboard with pixel town"
```

---

## Chunk 4: Cleanup and Verification

### Task 11: Run Full Test Suite and Fix Regressions

**Files:**
- Possibly modify: `src/App.room-flow.test.tsx`

- [x]**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [x]**Step 2: Run build**

Run: `npx tsc -b && npx vite build`
Expected: Clean build with no errors

- [x]**Step 3: Fix `App.room-flow.test.tsx`**

The first test ("renders the hallway shell") queries for `role="complementary"` (sidebar), `"conversation dock"`, and `"spatial room floor"` — all removed. Replace with:

```typescript
it("renders the pixel town shell with buildings and overlay", () => {
  render(<App />);
  // Town map should be present with buildings
  expect(screen.getByText(/LOBBY PLAZA/i)).toBeInTheDocument();
  expect(screen.getByText(/PRINT SHOP/i)).toBeInTheDocument();
  // Overlay should show title
  expect(screen.getByText(/PIXEL TOWN/i)).toBeInTheDocument();
});
```

The remaining tests query `DemoControlPanel` buttons (`/go to main stage/i`, `/pause feed/i`, etc.) which still exist since `DemoControlPanel` is preserved. These tests should pass without changes. The test for "current room" text (line 54) and "hallway guide" text (lines 62, 65) reference `DemoControlPanel` context pills which also survive. Verify these pass; if any query for removed DOM, update the selector to match the new overlay/panel structure.

- [x]**Step 4: Fix any remaining issues**

If build fails, fix type errors. Common issues:
- Unused imports → remove them
- Stale dependency arrays → remove references to deleted state

- [x]**Step 4: Commit fixes**

```bash
git add -u
git commit -m "fix: update tests for pixel town layout"
```

---

### Task 12: Final Visual QA Pass

- [x]**Step 1: Run dev server**

Run: `npx vite`

- [x]**Step 2: Verify acceptance criteria**

Check each item from spec Section 15:
1. ✅ Page shows pixel-art town, not dashboard
2. ✅ Buildings match `roomDirectory` rooms
3. ✅ Entity dots in correct buildings
4. ✅ Click building → zoom to Room View
5. ✅ Room View shows conversation states
6. ✅ Click entity → detail panel opens
7. ✅ Overlay shows location, status, ticker, audio controls
8. ✅ Color palette uses spec colors
9. ✅ Seeded mode drives activity
10. ✅ Demo controls accessible

- [x]**Step 3: Test keyboard navigation**

- Tab through buildings
- Enter to enter room
- Escape to go back
- Ctrl+K to search
- Escape to close detail panel

- [x]**Step 4: Commit any final adjustments**

```bash
git add -u
git commit -m "chore: final pixel town visual adjustments"
```
