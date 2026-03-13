# Pixel Town Lobby — Observer-Mode Pixel Art Shell

## 1. Goal

Replace the current three-column dashboard layout with a full-screen, top-down pixel-art town map. Users observe OpenClaw contestants moving between rooms — they do not control an avatar. The shell must feel like watching a strange small-town hackathon from above, not operating a SaaS product.

This spec supersedes the earlier `2026-03-12-pixel-town-openclaw-shell-design.md` visual direction document and turns it into an implementable design.

## 2. Core Concept

**Observer-mode pixel town.** All entity positions and states are driven by the existing `useRoomSource` hook. The user watches the town, clicks buildings to zoom into rooms, and clicks entities to inspect details. No avatar, no movement controls.

Two view levels in one component tree:

- **Town View** (default): bird's-eye map showing lobby plaza + surrounding buildings + entity dots
- **Room View** (drill-down): zoomed into a single room showing entity sprites, conversation ring, and speech signals

View switching is local state (`viewMode: "town" | "room"`, `focusRoomId: string | null`), not routing.

## 3. Scope

### In Scope

- Full-screen pixel town map replacing the 3-column grid
- Central lobby plaza as the shared default space
- Team room buildings arranged around the plaza
- Quiet Orbit as a dimmed edge zone
- Click-to-enter room drill-down with zoom transition
- Entity sprites positioned by room state data (openClawSeats, listenerEntities)
- Lightweight overlay UI (location label, status indicator, event ticker, controls)
- Side panel for entity detail on click
- CSS-only pixel art aesthetic (no sprite sheets, no canvas)
- Seeded mode and gateway mode both drive the same visuals
- Demo control panel preserved as floating overlay

### Out of Scope

- Player-controlled avatar or movement
- Tile engine, collision detection, or pathfinding
- Canvas or WebGL rendering
- New game systems or progression mechanics
- Sprite sheet production pipeline
- Expanding OpenClaw protocol surface

## 4. Visual Direction

### 4.1 Pixel Art via CSS

No sprite assets. Pixel feel comes from:

- **16px tile grid** on the ground plane (CSS `background-size: 16px 16px` with grid lines)
- **Hard pixel shadows** on buildings (`box-shadow: 4px 4px 0 #141010`)
- **Crisp edges** (`image-rendering: pixelated` where applicable)
- **Monospace typography** for location labels and status text
- **Small entity tokens** (32×32px squares with 2px solid borders, not rounded circles)
- **Minimal border-radius** (0–4px, never pill-shaped in the map layer)

### 4.2 Color Palette

From the existing spec, strictly enforced:

| Token | Hex | Usage |
|---|---|---|
| Paper white | `#F0EDE8` | Lobby ground, bright surfaces |
| Cold gray | `#D7D9D6` | Streets, building walls, secondary ground |
| Ink black | `#141010` | Outlines, shadows, text |
| Prohibition crimson | `#D62520` | Entry markers, warnings, active highlights (scarce) |
| Dusty blush-brown | `#B49A8F` | Aged surfaces, residue marks |
| Damp green-gray | `#76827D` | Quiet orbit zone, biological unease |

Entity colors remain per existing palette (contestant palette.primary, judge #f3b46c, AI #83deff, listener #86ea84).

### 4.3 Atmosphere

- Bright but observed — the town is well-lit yet feels surveilled
- Institutional signage — room labels read like facility notices
- Red X marks — one large crimson X centered on the lobby plaza
- Edge fog — map edges fade to dark, implying unseen surroundings
- Idle flicker — subtle CSS animation on building status lamps

## 5. Layout Structure

### 5.1 App Shell (replaces 3-column grid)

```
.pixel-town-app {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
```

No rail, no sidebar, no grid. The map is the entire viewport. UI sits on top as fixed/absolute overlays.

### 5.2 Town View Layout

The map ground fills the viewport. Buildings are absolutely positioned within a centered map container that maintains aspect ratio.

```
Map container (centered, max 1200×800, aspect-fit)
├── Ground layer (CSS grid tile pattern)
├── Lobby plaza (center, ~40% of map width)
│   └── Red X mark (centered SVG or CSS)
├── Team Room 1 building (top-left quadrant)
├── Team Room 2 building (top-right quadrant)
├── Team Room 3 building (bottom-left quadrant)
├── Quiet Orbit zone (bottom-right, dimmed)
├── Street segments (connecting lines between buildings)
├── Entity dots (positioned inside their room's bounds)
└── Edge fog (gradient overlay fading to #141010)
```

### 5.3 Building Appearance

Each building is a rectangular div:

```
.town-building {
  position: absolute;
  border: 3px solid #141010;
  box-shadow: 4px 4px 0 #141010;
  background: #D7D9D6;
  padding: 8px;
}
```

Building content:
- **Name label** (top, monospace, uppercase): "PRINT SHOP", "CLINIC", etc.
- **Occupancy badge** (top-right): entity count number
- **Status lamp** (small 8px square): green=active, gray=idle, pulsing=live speaker
- **Entity dot area** (interior): small colored squares representing occupants
- **Door marker** (bottom edge): small crimson rectangle indicating entrance

Team room themes from the original spec:
- Team Room 1 → "印刷所 PRINT SHOP" (paper stack motif, slightly warm gray)
- Team Room 2 → "诊所 CLINIC" (tiled floor feel, cooler gray)
- Team Room 3 → "杂货铺 CONVENIENCE" (shelf-like internal lines)
- Quiet Orbit → "静默区 QUIET ZONE" (damp green-gray, dimmed)

### 5.4 Room View Layout

When user clicks a building, the map zooms to fill that room:

```
Room container (fills viewport)
├── Room interior ground (different tile pattern per room theme)
├── Conversation ring (dashed border ellipse, reuse existing)
├── Entity sprites (32×32, positioned by roomX/roomY %)
│   ├── Sprite token (colored square + initials)
│   ├── Name label (below sprite)
│   └── Speech bubble (if recent signal, above sprite)
├── Room props (simplified pixel-art furniture blocks)
└── Room info overlay (top bar with room name + status)
```

## 6. Component Architecture

### 6.1 New Components

**`PixelTownShell`** — replaces the `<div className="openclaw-app">` layout
- Owns `viewMode` and `focusRoomId` state
- Renders either `PixelTownMap` or `PixelRoomView` based on viewMode
- Always renders `TownOverlay` and optional `EntityDetailPanel`

**`PixelTownMap`** — Town View renderer
- Receives `roomDirectory.rooms`, entity positions, entity states
- Renders ground, buildings, entity dots, edge fog
- On building click: calls `onEnterRoom(roomId)`
- On entity dot click: calls `onSelectEntity(selectionId)`

**`PixelRoomView`** — Room View renderer (replaces `SpatialRoomFloor`)
- Receives current room data, openClawSeats, listenerEntities, audibleSignals
- Renders room interior, entity sprites, conversation ring, speech bubbles
- Reuses positioning logic from existing `SpatialRoomFloor`
- Has "← Back to town" button

**`TownOverlay`** — persistent UI layer
- Top-left: location label + subtitle
- Top-right: connection status lamp, online count, current act
- Bottom-center: event ticker (latest audibleSignal, auto-scrolling)
- Bottom-right: audio mode controls (Nearby/Focus/Mute)

**`EntityDetailPanel`** — slide-in side panel
- Triggered by entity selection
- Renders the same detail card content currently in `PresenceSidebar`
- Slides in from right edge, 320px wide
- Click outside or X to dismiss

### 6.2 Removed Components

- **`PresenceSidebar`** — sidebar eliminated; entity list browsing replaced by clicking dots on map; detail card moved to `EntityDetailPanel`
- **`ConversationDock`** — speaker row eliminated; speaker status visible via entity sprites in room view; act navigation moved to overlay

### 6.3 Preserved Components

- **`DemoControlPanel`** — kept as floating overlay (absolute positioned, toggled by hotkey or small gear icon)

### 6.4 Modified Components

- **`App.tsx`** — remove 3-column grid, remove PresenceSidebar/ConversationDock usage, render `PixelTownShell` instead. All business logic derivations (contestantDeck, teams, openClawSeats, listenerEntities, etc.) remain unchanged.

## 7. Data Flow

### 7.1 Unchanged Boundary

```
App.tsx
  ├── useRoomSource(inputs) → { snapshot, roomDirectory, roomViewModel, actions }
  ├── Business derivations (contestantDeck, teams, openClawSeats, listenerEntities)
  └── PixelTownShell
       ├── PixelTownMap  ← roomDirectory.rooms, entity positions
       ├── PixelRoomView ← openClawSeats, listenerEntities, audibleSignals
       ├── TownOverlay   ← snapshot status, roomViewModel summary
       └── EntityDetailPanel ← selected entity detail card
```

### 7.2 New Adapter: `buildTownLayout`

Pure function mapping room directory + entity data to town-specific layout:

```typescript
interface TownBuilding {
  roomId: string;
  name: string;
  theme: "lobby" | "print-shop" | "clinic" | "convenience" | "quiet-zone";
  position: { x: number; y: number; width: number; height: number }; // % of map
  entities: Array<{ id: string; color: string; label: string; x: number; y: number }>;
  status: "active" | "idle" | "live";
  memberCount: number;
}

function buildTownLayout(
  rooms: RoomListItem[],
  openClawSeats: ContestantSeat[],
  listenerEntities: SidebarEntity[],
  currentRoomId: string,
): TownBuilding[];
```

Building positions are hardcoded constants (the town layout is fixed, not procedural):

```typescript
const BUILDING_POSITIONS: Record<string, { x: number; y: number; w: number; h: number }> = {
  "main-stage":   { x: 30, y: 25, w: 40, h: 35 },  // center, largest
  "team-room-1":  { x: 5,  y: 10, w: 22, h: 28 },   // top-left
  "team-room-2":  { x: 73, y: 10, w: 22, h: 28 },   // top-right
  "team-room-3":  { x: 5,  y: 58, w: 22, h: 28 },   // bottom-left
  "quiet-orbit":  { x: 73, y: 58, w: 22, h: 28 },   // bottom-right
};
```

Entity positions within buildings: distribute evenly across building area, or use existing roomX/roomY mapped to building bounds.

## 8. View Transitions

### 8.1 Town → Room

CSS transition on the map container:

```css
.town-map-container {
  transition: transform 300ms ease-out, opacity 200ms ease;
}

.town-map-container.is-zooming {
  transform: scale(3) translate(var(--zoom-x), var(--zoom-y));
  opacity: 0;
}
```

After transition ends, swap to `PixelRoomView`. The zoom target point is computed from the clicked building's center position.

### 8.2 Room → Town

Reverse: `PixelRoomView` fades out, map fades in with reverse zoom.

### 8.3 Entity Transitions

- Appear: fade-in 200ms
- Move: CSS transition on left/top 400ms (smooth position updates)
- Disappear: fade-out 200ms

## 9. Overlay Details

### 9.1 Top Bar

```
┌──────────────────────────────────────────────┐
│ ■ PIXEL TOWN                    ● 16 online  │
│   3.5 Bonjour! AMA              Act 1        │
└──────────────────────────────────────────────┘
```

- Left: crimson square icon + "PIXEL TOWN" or room name when in Room View
- Right: connection dot (green/yellow/red) + online count + current act number
- Background: `rgba(20, 16, 16, 0.85)` with `backdrop-filter: blur(8px)`
- Monospace font, uppercase, small

### 9.2 Bottom Bar

```
┌──────────────────────────────────────────────┐
│ 铁皮鼓: 我觉得这个方向...    [Nearby][Focus][Mute] │
└──────────────────────────────────────────────┘
```

- Left: latest signal ticker, single line, auto-replaces
- Right: audio mode toggle buttons (pixel-styled, 3px border)
- Same glass background treatment

### 9.3 Entity Detail Panel

- Right edge, 320px wide, full height
- Slides in with `transform: translateX(100%) → translateX(0)`, 250ms
- Contains: avatar, name, role, stats grid, chips, action buttons
- Same content as current `detail-card` in PresenceSidebar
- Close: click outside panel area or click X button

## 10. Responsive Behavior

### ≥1200px
Full town map, all buildings visible with labels and entity dots.

### 920–1200px
Map scales down, building labels become abbreviated, entity dots shrink.

### ≤920px
Map becomes a vertical stack of building cards (no spatial positioning). Each card shows room name, occupancy, status, and entity list. Clicking a card enters Room View. This degrades gracefully from spatial experience to structured list.

## 11. CSS Architecture

### 11.1 New Stylesheet Approach

Add a new `pixel-town.css` alongside existing `styles.css`. The existing stylesheet remains for components that survive (DemoControlPanel, shared utilities like `.chip`, `.tiny-label`).

`pixel-town.css` owns:
- `.pixel-town-app` — root layout
- `.town-map-*` — map and ground styles
- `.town-building-*` — building appearance
- `.town-entity-*` — entity dots on map
- `.pixel-room-*` — room view interior
- `.pixel-sprite-*` — entity sprites in room view
- `.town-overlay-*` — overlay panels
- `.entity-panel-*` — detail side panel

### 11.2 Design Tokens

```css
:root {
  --pt-paper: #F0EDE8;
  --pt-gray: #D7D9D6;
  --pt-ink: #141010;
  --pt-crimson: #D62520;
  --pt-dust: #B49A8F;
  --pt-damp: #76827D;
  --pt-tile: 16px;
  --pt-border: 3px solid var(--pt-ink);
  --pt-shadow: 4px 4px 0 var(--pt-ink);
  --pt-font: "IBM Plex Mono", "SF Mono", "Menlo", monospace;
}
```

## 12. OpenClaw Integration (unchanged)

- `presence` → entity appears in correct building (Town View) or correct position (Room View)
- `message/chat` → speech bubble in Room View, ticker line in overlay
- `connection state` → status lamp color in top overlay
- Seeded mode populates the town identically to gateway mode
- Empty rooms show dormant state (dimmed building, "VACANT" label)
- Disconnected mode shows "OFFLINE" in top overlay, buildings remain visible but entities freeze

## 13. Acceptance Criteria

1. Opening the page shows a pixel-art bird's-eye town, not a dashboard
2. Buildings correspond to rooms in `roomDirectory`
3. Entity dots appear in correct buildings based on room state
4. Clicking a building zooms into Room View with entity sprites
5. Room View shows conversation state (speaking, raised-hand, etc.) via sprite styling
6. Clicking entities opens detail panel with full info
7. Overlay shows location, status, event ticker, audio controls
8. Color palette matches poster materials (#F0EDE8, #D7D9D6, #141010, #D62520)
9. Seeded mode drives continuous entity activity
10. Demo controls remain accessible

## 14. File Plan

```
src/
  App.tsx                        — MODIFY: remove 3-col grid, render PixelTownShell
  pixel-town.css                 — NEW: all pixel town styles
  components/
    PixelTownShell.tsx           — NEW: top-level shell with viewMode state
    PixelTownMap.tsx             — NEW: town view renderer
    PixelRoomView.tsx            — NEW: room view renderer
    TownOverlay.tsx              — NEW: overlay bars
    EntityDetailPanel.tsx        — NEW: slide-in detail panel
    DemoControlPanel.tsx         — KEEP: unchanged
    PresenceSidebar.tsx          — REMOVE (or keep for reference)
    ConversationDock.tsx         — REMOVE (or keep for reference)
    SpatialRoomFloor.tsx         — REMOVE (logic migrated to PixelRoomView)
  room/
    townLayout.ts                — NEW: buildTownLayout adapter
    (everything else unchanged)
```
