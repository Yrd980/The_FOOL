# XTION Balanced Room Week Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在一周内完成最小房间状态边界抽离、多房间 hallway 演示闭环、关键展示组件拆分，以及首批 UI 行为回归测试，让当前原型既更稳、更好演示，也为后续真实 `OpenClaw` 接入留出清晰接缝。

**Architecture:** 以 `src/room/` 作为房间领域边界，承接 conversation 推导、房间目录构建、seed source 和 React hook；以 `src/components/` 承接展示组件拆分；以 `jsdom + Testing Library` 为关键交互建立 UI 回归保护。所有改动都围绕现有 seed-backed demo 展开，不引入后端和真实 SDK，仅为未来 live adapter 预留接口。

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, Testing Library, jsdom

---

## File Structure

- Create: `src/room/types.ts`
  Responsibility: 房间领域类型、conversation 状态、房间目录和 UI view model 契约。
- Create: `src/room/deriveConversationState.ts`
  Responsibility: 从 stage、焦点队伍和优先选手推导 speaking / raised-hand / queued / listening 状态。
- Create: `src/room/deriveConversationState.test.ts`
  Responsibility: conversation 推导规则回归测试。
- Create: `src/room/buildRoomViewModel.ts`
  Responsibility: 组合选手、队伍、观众 feed、audio mode，生成单房间视图模型。
- Create: `src/room/buildRoomViewModel.test.ts`
  Responsibility: 房间状态、信号筛选、席位分组回归测试。
- Create: `src/room/testFixtures.ts`
  Responsibility: room-domain 与 source-state 测试复用的 fixture 工厂，避免各测试临时发明输入快照。
- Create: `src/room/rooms.ts`
  Responsibility: 基于队伍与舞台上下文生成 hallway 房间目录与当前房间摘要。
- Create: `src/room/rooms.test.ts`
  Responsibility: 多房间 hallway 目录与成员映射测试。
- Create: `src/room/seedRoomSource.ts`
  Responsibility: seed interactions 推进、房间轮换辅助和 demo 状态注入。
- Create: `src/room/seedRoomSource.test.ts`
  Responsibility: seed source 的确定性输出测试。
- Create: `src/room/useSeedRoomSource.ts`
  Responsibility: 薄 React hook，暴露 seed-backed room feed 和控制动作。
- Create: `src/room/index.ts`
  Responsibility: `src/room/` barrel exports。
- Create: `src/components/PresenceSidebar.tsx`
  Responsibility: 左侧在线成员与筛选视图。
- Create: `src/components/ConversationDock.tsx`
  Responsibility: 顶部 conversation 席位和房间状态摘要。
- Create: `src/components/SpatialRoomFloor.tsx`
  Responsibility: 中央 spatial room / hallway floor 画布。
- Create: `src/components/DemoControlPanel.tsx`
  Responsibility: demo controls：房间切换、audio mode、feed 暂停与状态注入。
- Create: `src/test/setup.ts`
  Responsibility: UI 测试环境初始化。
- Create: `src/App.room-flow.test.tsx`
  Responsibility: 关键房间流程 UI 测试。
- Modify: `src/App.tsx`
  Responsibility: 改为组合式页面容器，不再内嵌主要房间推导逻辑。
- Modify: `src/data.ts`
  Responsibility: 仅保留 seed data 本体，把房间源和房间目录相关衍生移到 `src/room/`。
- Modify: `src/styles.css`
  Responsibility: 为拆分后的房间组件和 demo controls 整理样式入口。
- Modify: `vite.config.ts`
  Responsibility: 配置 `vitest` 的 `jsdom` 环境和测试 setup。
- Modify: `package.json`
  Responsibility: 增加 UI 测试相关依赖与脚本。

## Constraints

- 不接入真实 `OpenClaw` SDK / API。
- 不新增后端、数据库或账户系统。
- 不把多房间做成完整路由应用，只保留最小 hallway 切换闭环。
- 保持当前视觉语言与故事设定，只做服务于结构和演示的调整。
- 优先拆出“房间状态边界”和“关键 UI 区块”，避免泛化重构。

## Chunk 1: Extract Room-State Boundary

### Task 1: Extract Conversation State Rules

**Files:**
- Create: `src/room/types.ts`
- Create: `src/room/deriveConversationState.ts`
- Test: `src/room/deriveConversationState.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing conversation-state tests**

```ts
import { describe, expect, it } from "vitest";

import { deriveConversationState } from "./deriveConversationState";

describe("deriveConversationState", () => {
  const input = {
    activeStageTitle: "组织龙虾分组",
    orderedContestantIds: ["glass-sea", "butter-knife", "iron-drum", "fog-lamp"],
    focusIds: ["glass-sea", "butter-knife"],
    championIds: ["glass-sea", "butter-knife"],
    leadingContestantId: "glass-sea",
    defaultSpeakerId: "glass-sea",
    selectedContestantId: "glass-sea",
    focusTeamName: "逆光潮汐组",
    focusHeadline: "OpenClaw 押注路由器",
    nearbyHint: "Nearby people may listen in",
    contestantNameById: {
      "glass-sea": "玻璃海",
      "butter-knife": "黄油刀",
      "iron-drum": "铁鼓",
      "fog-lamp": "雾灯圣母",
    },
  };

  it.each([
    "act-1",
    "act-2",
    "act-3",
    "act-4",
    "act-5",
    "act-6",
    "act-7",
    "act-8",
    "act-9",
    "act-10",
  ])("keeps %s behavior stable after extraction", (activeStageId) => {
    const state = deriveConversationState({
      ...input,
      activeStageId,
      priorityContestantId: null,
    });

    expect(state.speakerId).toBeTruthy();
    expect(Array.isArray(state.listeningIds)).toBe(true);
    expect(Array.isArray(state.queuedIds)).toBe(true);
    expect(state.callout.length).toBeGreaterThan(0);
  });

  it("lets wave-over take queue priority without replacing the speaker", () => {
    const state = deriveConversationState({
      ...input,
      activeStageId: "act-3",
      priorityContestantId: "iron-drum",
    });

    expect(state.speakerId).toBe("glass-sea");
    expect(state.raisedHandId).toBe("iron-drum");
    expect(state.queuedIds[0]).toBe("iron-drum");
  });
});
```

When implementing this test table, replace the generic truthy checks with the exact speaker / raised-hand / listening / queue outputs copied from the current `App.tsx` switch for each act so the extraction stays behavior-preserving.

- [ ] **Step 2: Run the targeted test to confirm the module is still missing**

Run: `npm test -- src/room/deriveConversationState.test.ts`
Expected: FAIL with a module resolution error for `./deriveConversationState`

- [ ] **Step 3: Implement the pure conversation-state module**

```ts
export type ConversationState = {
  speakerId: string | null;
  raisedHandId: string | null;
  listeningIds: string[];
  queuedIds: string[];
  callout: string;
};

export type DeriveConversationStateInput = {
  activeStageId: StageId;
  activeStageTitle: string;
  orderedContestantIds: string[];
  focusIds: string[];
  championIds: string[];
  leadingContestantId: string;
  defaultSpeakerId: string;
  selectedContestantId: string | null;
  focusTeamName: string;
  focusHeadline: string;
  nearbyHint: string;
  contestantNameById: Record<string, string>;
  priorityContestantId: string | null;
};

export const deriveConversationState = (
  input: DeriveConversationStateInput,
): ConversationState => {
  // Move the full 10-stage switch and wave-over override out of App.tsx without changing behavior.
};
```

- [ ] **Step 4: Rewire `App.tsx` to consume `deriveConversationState(...)` instead of duplicating the stage switch**

Update:
- the conversation-state derivation branch inside `App.tsx`
- any downstream code that currently reads speaker / queue / listening data from inline logic

- [ ] **Step 5: Run the focused test and a production build**

Run: `npm test -- src/room/deriveConversationState.test.ts && npm run build`
Expected: PASS with the conversation tests green and the app still building

- [ ] **Step 6: Commit**

```bash
git add src/room/types.ts src/room/deriveConversationState.ts src/room/deriveConversationState.test.ts src/App.tsx
git commit -m "refactor: extract room conversation state rules"
```

### Task 2: Build a Pure Single-Room View Model

**Files:**
- Modify: `src/room/types.ts`
- Create: `src/room/buildRoomViewModel.ts`
- Test: `src/room/buildRoomViewModel.test.ts`
- Create: `src/room/testFixtures.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing room-view-model tests**

```ts
import { describe, expect, it } from "vitest";

import { buildRoomViewModel } from "./buildRoomViewModel";
import { createRoomTestInput } from "./testFixtures";

describe("buildRoomViewModel", () => {
  it("returns a spec-aligned room view model with conversation and room context", () => {
    const model = buildRoomViewModel(createRoomTestInput());

    expect(model.conversation.speakerId).toBe("glass-sea");
    expect(model.currentUser.mode).toBe("perimeter");
    expect(model.openClawSeats.find((seat) => seat.id === "iron-drum")?.state).toBe("raised-hand");
    expect(model.audibleSignals.length).toBeGreaterThanOrEqual(0);
  });

  it("filters audible signals down to the main speaker in focus mode", () => {
    const model = buildRoomViewModel({
      ...createRoomTestInput(),
      audioMode: "focus",
    });

    expect(model.audibleSignals.every((item) => item.contestantId === model.conversation.speakerId)).toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Run the targeted test before implementation**

Run: `npm test -- src/room/buildRoomViewModel.test.ts`
Expected: FAIL with a module resolution error for `./buildRoomViewModel`

- [ ] **Step 3: Create `src/room/testFixtures.ts` with a deterministic room-domain fixture**

```ts
export const createRoomTestInput = (): BuildRoomViewModelInput => ({
  // small deterministic room-domain fixture reused across room tests
});
```

- [ ] **Step 4: Extend `src/room/types.ts` with the spec-aligned `RoomViewModel` contract**

```ts
export type BuildRoomViewModelInput = {
  snapshot: RoomSourceSnapshot;
  roomDirectory: RoomDirectory;
  contestantDeck: ContestantScorecard[];
  teams: TeamSummary[];
  // plus listener sources and other pure inputs needed for view derivation
};

export type RoomViewModel = {
  currentRoom: RoomDirectory["currentRoom"];
  roomList: RoomDirectory["rooms"];
  conversation: ConversationState;
  openClawSeats: RoomSeatViewModel[];
  audibleSignals: AudienceInteraction[];
  currentUser: { id: "hallway-guide"; roomId: string; mode: "perimeter" | "listening" };
};
```

- [ ] **Step 5: Implement the pure transformer**

```ts

export const buildRoomViewModel = (
  input: BuildRoomViewModelInput,
): RoomViewModel => {
  // Consume a RoomDirectory from rooms.ts and enrich it with conversation, seats, listeners, and signals.
};
```

- [ ] **Step 6: Replace the existing room derivation inside `App.tsx` with `buildRoomViewModel(...)`**

Ensure `App.tsx` stops shaping seat state, audio filters, and queue counts inline.

- [ ] **Step 7: Run room tests, the existing logic suite, and a production build**

Run: `npm test -- src/room/buildRoomViewModel.test.ts src/room/deriveConversationState.test.ts src/logic.test.ts && npm run build`
Expected: PASS with all targeted tests green and the app building

- [ ] **Step 8: Commit**

```bash
git add src/room/buildRoomViewModel.ts src/room/buildRoomViewModel.test.ts src/room/testFixtures.ts src/room/types.ts src/App.tsx
git commit -m "refactor: extract room view model builder"
```

## Chunk 2: Add Multi-Room Hallway Semantics

### Task 3: Model the Hallway Room Directory

**Files:**
- Modify: `src/room/types.ts`
- Create: `src/room/rooms.ts`
- Test: `src/room/rooms.test.ts`
- Modify: `src/room/testFixtures.ts`

- [ ] **Step 1: Write the failing hallway-room tests**

```ts
import { describe, expect, it } from "vitest";

import { buildRoomDirectory } from "./rooms";
import { createRoomTestInput } from "./testFixtures";

describe("buildRoomDirectory", () => {
  it("builds room metadata, members, audible summaries, and current-room context", () => {
    const directory = buildRoomDirectory(createRoomTestInput());

    expect(directory.rooms.map((room) => room.id)).toEqual(
      expect.arrayContaining(["main-stage", "team-room-1", "quiet-orbit"]),
    );
    expect(directory.currentRoom.id).toBe("main-stage");
    expect(directory.rooms[0].name).toBeTruthy();
    expect(directory.rooms[0].memberCount).toBeGreaterThanOrEqual(0);
    expect(typeof directory.rooms[0].audibleSummary).toBe("string");
    expect(directory.rooms.find((room) => room.id === "team-room-1")?.memberIds).toContain(
      "glass-sea",
    );
    expect(directory.rooms.find((room) => room.id === "quiet-orbit")?.memberIds.length).toBeGreaterThan(0);
    expect(directory.switchTargets.length).toBeGreaterThan(0);
  });

  it("falls back to main-stage when currentRoomId is invalid", () => {
    const directory = buildRoomDirectory({
      ...createRoomTestInput(),
      snapshot: { ...createRoomTestInput().snapshot, currentRoomId: "missing-room" },
    });

    expect(directory.currentRoom.id).toBe("main-stage");
  });
});
```

- [ ] **Step 2: Run the focused hallway test**

Run: `npm test -- src/room/rooms.test.ts`
Expected: FAIL with a module resolution error for `./rooms`

- [ ] **Step 3: Extend `src/room/types.ts` with `RoomDirectory` and related room-list contracts**

```ts
export type RoomDirectory = {
  currentRoom: RoomListItem;
  rooms: RoomListItem[];
  switchTargets: Array<{ id: string; name: string }>;
};
```

- [ ] **Step 4: Implement the room-directory builder and update fixtures only if the room contract needs extra seed fields**

```ts
export const buildRoomDirectory = (
  input: BuildRoomDirectoryInput,
): RoomDirectory => {
  // Generate main stage, team rooms, and quiet orbit from current stage and teams.
};
```

- [ ] **Step 5: Run the room-directory test with existing room tests**

Run: `npm test -- src/room/rooms.test.ts src/room/buildRoomViewModel.test.ts src/room/deriveConversationState.test.ts`
Expected: PASS with all hallway model tests green

- [ ] **Step 6: Commit**

```bash
git add src/room/types.ts src/room/rooms.ts src/room/rooms.test.ts src/room/testFixtures.ts
git commit -m "feat: add seeded hallway room directory"
```

### Task 4: Rewire the App for Room Switching

**Files:**
- Modify: `src/room/types.ts`
- Create: `src/room/seedRoomSource.ts`
- Create: `src/room/seedRoomSource.test.ts`
- Create: `src/room/useSeedRoomSource.ts`
- Create: `src/room/index.ts`
- Modify: `src/room/testFixtures.ts`
- Modify: `src/room/buildRoomViewModel.ts`
- Modify: `src/room/buildRoomViewModel.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Capture a baseline before rewiring**

Run: `npm test && npm run build`
Expected: PASS with the current logic tests and a successful Vite build

- [ ] **Step 2: Write the failing seed-source tests**

```ts
import { describe, expect, it } from "vitest";

import { appendSeedInteraction, reduceRoomAction } from "./seedRoomSource";
import { createSeedRoomSnapshot } from "./testFixtures";

describe("seed room source", () => {
  it("adds one deterministic audience event using the current rotation rules", () => {
    const input = createSeedRoomSnapshot();
    const next = appendSeedInteraction(input);

    expect(next).toHaveLength(input.interactions.length + 1);
    expect(next.at(-1)?.id).toMatch(/^evt-live-/);
  });

  it("switches rooms without changing speaker state or queue ownership", () => {
    const state = reduceRoomAction(createSeedRoomSnapshot(), {
      type: "switch-room",
      roomId: "team-room-1",
    });

    expect(state.currentRoomId).toBe("team-room-1");
    expect(state.priorityContestantId).toBeNull();
  });

  it("keeps join and leave idempotent and never adds the hallway guide to contestant seats", () => {
    const joined = reduceRoomAction(createSeedRoomSnapshot(), { type: "join-conversation" });

    expect(joined.currentUserMode).toBe("listening");
    expect(reduceRoomAction(joined, { type: "join-conversation" }).currentUserMode).toBe(
      "listening",
    );
    expect(reduceRoomAction(joined, { type: "leave-conversation" }).currentUserMode).toBe(
      "perimeter",
    );
  });

  it("supports audio-mode, pause-feed, and scenario actions in the source layer", () => {
    const focused = reduceRoomAction(createSeedRoomSnapshot(), {
      type: "set-audio-mode",
      mode: "focus",
    });

    expect(focused.audioMode).toBe("focus");
    expect(reduceRoomAction(focused, { type: "toggle-feed-paused" }).feedPaused).toBe(true);
    expect(
      reduceRoomAction(focused, {
        type: "inject-scenario",
        scenario: "quiet-room",
        targetRoomId: "team-room-1",
      }).scenarioOverride,
    ).toMatchObject({ type: "quiet-room", targetRoomId: "team-room-1" });
    expect(reduceRoomAction(focused, { type: "reset-demo" })).toMatchObject({
      currentRoomId: "main-stage",
      audioMode: "nearby",
      feedPaused: false,
    });
  });

  it("keeps unknown-room switches and invalid scenario clears deterministic", () => {
    const state = createSeedRoomSnapshot();

    expect(
      reduceRoomAction(state, { type: "switch-room", roomId: "missing-room" }).currentRoomId,
    ).toBe("main-stage");
    expect(
      reduceRoomAction(state, { type: "inject-scenario", scenario: "none" }).scenarioOverride,
    ).toMatchObject({ type: "none" });
  });
});
```

- [ ] **Step 3: Run the targeted seed-source tests before implementation**

Run: `npm test -- src/room/seedRoomSource.test.ts`
Expected: FAIL with module resolution or missing implementation errors for `./seedRoomSource`

- [ ] **Step 4: Implement the pure seed-room reducer and event helpers**

```ts
export const reduceRoomAction = (
  state: RoomSourceSnapshot,
  action: RoomAction,
): RoomSourceSnapshot => {
  // switch-room, join-conversation, leave-conversation, set-audio-mode, toggle-feed-paused, inject-scenario, reset-demo
};
```

- [ ] **Step 5: Re-run the pure seed-source tests**

Run: `npm test -- src/room/seedRoomSource.test.ts`
Expected: PASS with deterministic feed and action semantics covered

- [ ] **Step 6: Implement `useSeedRoomSource.ts`**

Keep the hook limited to interval control and dispatching the pure source actions.

- [ ] **Step 7: Implement `src/room/index.ts` barrel exports**

Re-export only the stable source / view-model entry points.

- [ ] **Step 8: Implement wiring-only `App.tsx` integration**

Keep this step limited to:
- hook state wiring
- passing `RoomViewModel` and actions into `App.tsx`
- adding room-switch context copy without large presentation rewrites

- [ ] **Step 9: Update `buildRoomViewModel.ts` and its tests so `currentRoomId` and scenario overrides change rendered room context**

Make sure room switching does not stop at source state; it must affect:
- `currentRoom`
- `roomList`
- `roomMembers`
- `audibleSignals`

- [ ] **Step 10: Run room-domain tests and a production build**

Run: `npm test -- src/room/seedRoomSource.test.ts src/room/rooms.test.ts src/room/buildRoomViewModel.test.ts src/room/deriveConversationState.test.ts src/logic.test.ts && npm run build`
Expected: PASS with room tests green and build successful

- [ ] **Step 11: Commit**

```bash
git add src/room/types.ts src/room/testFixtures.ts src/room/seedRoomSource.ts src/room/seedRoomSource.test.ts src/room/useSeedRoomSource.ts src/room/index.ts src/room/buildRoomViewModel.ts src/room/buildRoomViewModel.test.ts src/App.tsx src/styles.css
git commit -m "feat: add seeded multi-room hallway flow"
```

## Chunk 3: Split Presentation and Add Demo Controls

### Task 5: Extract the Primary Room UI Sections

**Files:**
- Create: `src/components/PresenceSidebar.tsx`
- Create: `src/components/ConversationDock.tsx`
- Create: `src/components/SpatialRoomFloor.tsx`
- Create: `src/App.room-flow.test.tsx`
- Create: `src/test/setup.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write a failing smoke test around the room shell**

```ts
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App room shell", () => {
  it("renders the hallway shell with sidebar, conversation dock, and room floor", () => {
    render(<App />);

    expect(screen.getByRole("complementary", { name: /presence sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /conversation dock/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /spatial room floor/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add the minimum UI testing infrastructure**

Run: `npm install -D jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom`
Expected: `package.json` and `package-lock.json` updated with new test dependencies

- [ ] **Step 3: Create `src/test/setup.ts` and initialize Testing Library matchers**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Configure `vitest` for `jsdom`**

```ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

- [ ] **Step 5: Run the new App smoke test and confirm the red phase**

Run: `npm test -- src/App.room-flow.test.tsx`
Expected: FAIL because the shell landmarks are not rendered yet

- [ ] **Step 6: Extract the three presentation components and add stable landmark labels**

Add:
- `aria-label="Presence sidebar"`
- `aria-label="Conversation dock"`
- `aria-label="Spatial room floor"`

- [ ] **Step 7: Run the new smoke test, the existing logic suite, and a production build**

Run: `npm test -- src/App.room-flow.test.tsx src/logic.test.ts && npm run build`
Expected: PASS with the App smoke test and logic tests green plus a successful build

- [ ] **Step 8: Commit**

```bash
git add src/components/PresenceSidebar.tsx src/components/ConversationDock.tsx src/components/SpatialRoomFloor.tsx src/App.tsx src/styles.css src/test/setup.ts vite.config.ts package.json package-lock.json src/App.room-flow.test.tsx
git commit -m "refactor: split main room presentation components"
```

### Task 6: Add a Demo Control Panel

**Files:**
- Create: `src/components/DemoControlPanel.tsx`
- Modify: `src/App.room-flow.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Extend the App UI test with demo controls expectations**

```ts
it("renders room controls for audio mode, room switching, and demo state injection", () => {
  render(<App />);

  expect(screen.getByRole("button", { name: /go to main stage/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /go to team room 1/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /hear nearby/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /focus audio/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /mute all/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /pause feed/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /inject wave over/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /simulate quiet room/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /simulate empty room/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /reset demo/i })).toBeInTheDocument();
});

it("pauses the feed and resets the demo state", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /pause feed/i }));
  expect(screen.getByRole("button", { name: /resume feed/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /reset demo/i }));
  expect(screen.getByRole("button", { name: /go to main stage/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
```

- [ ] **Step 2: Run the targeted UI test to capture the missing control panel behavior**

Run: `npm test -- src/App.room-flow.test.tsx`
Expected: FAIL because the new control panel expectations are not rendered yet

- [ ] **Step 3: Implement a source-agnostic `DemoControlPanel.tsx` that receives all actions via props**

```tsx
export function DemoControlPanel(props: DemoControlPanelProps) {
  return (
    <section>
      {/* room switch, nearby/focus/muted audio, pause/resume, scenario injection, reset demo */}
    </section>
  );
}
```

- [ ] **Step 4: Wire the control panel through `App.tsx` using the room action API**

Do not let `DemoControlPanel.tsx` read the seed-room source directly.

- [ ] **Step 5: Re-run the targeted UI test and build**

Run: `npm test -- src/App.room-flow.test.tsx && npm run build`
Expected: PASS with the control panel covered and the app building

- [ ] **Step 6: Commit**

```bash
git add src/components/DemoControlPanel.tsx src/App.tsx src/styles.css src/App.room-flow.test.tsx
git commit -m "feat: add room demo control panel"
```

## Chunk 4: Protect Critical Flows and Close the Week

### Task 7: Add UI Regression Tests for Critical Room Interactions

**Files:**
- Modify: `src/App.room-flow.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/DemoControlPanel.tsx`
- Modify: `src/room/seedRoomSource.ts`
- Modify: `src/room/useSeedRoomSource.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing interaction tests for room switching, join/leave, wave-over, audio modes, and fallback states**

```ts
import userEvent from "@testing-library/user-event";

it("switches rooms and updates the visible room context", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /go to team room 1/i }));
  expect(screen.getByText(/current room/i)).toHaveTextContent(/team room 1/i);
});

it("toggles the hallway guide between perimeter and listening mode", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /join conversation/i }));
  expect(screen.getByText(/hallway guide/i)).toHaveTextContent(/listening/i);

  await user.click(screen.getByRole("button", { name: /leave conversation/i }));
  expect(screen.getByText(/hallway guide/i)).toHaveTextContent(/perimeter/i);
});

it("moves the selected contestant to the queue when wave over is injected", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /glass-sea/i }));
  await user.click(screen.getByRole("button", { name: /inject wave over/i }));
  expect(screen.getByRole("button", { name: /glass-sea/i })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/queue/i)).toHaveTextContent(/glass-sea|玻璃海/i);
});

it("limits feed output when focus audio is enabled and clears it when muted", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /focus audio/i }));
  expect(screen.getByTestId("room-signal-item")).toHaveTextContent(/glass-sea|玻璃海/i);
  expect(screen.queryByText(/nearby chatter/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /mute all/i }));
  expect(screen.queryByTestId("room-signal-item")).not.toBeInTheDocument();
});

it("renders room-scoped quiet-room and empty-room fallback copy", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /simulate quiet room/i }));
  expect(screen.getByText(/no active speaker right now/i)).toBeInTheDocument();
  expect(screen.getByText(/room is quiet right now/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /go to main stage/i }));
  expect(screen.queryByText(/room is quiet right now/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /simulate empty room/i }));
  expect(screen.getByText(/no one is in this room yet/i)).toBeInTheDocument();
});

it("pauses and resets the demo through the UI", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /pause feed/i }));
  expect(screen.getByRole("button", { name: /resume feed/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /go to team room 1/i }));
  await user.click(screen.getByRole("button", { name: /reset demo/i }));
  expect(screen.getByText(/current room/i)).toHaveTextContent(/main stage/i);
});
```

- [ ] **Step 2: Run the UI regression tests before implementation**

Run: `npm test -- src/App.room-flow.test.tsx`
Expected: FAIL on the new interaction assertions

- [ ] **Step 3: Implement current-room and join/leave semantics in the UI**

Wire:
- current room label
- hallway guide mode label
- join / leave buttons

- [ ] **Step 4: Implement wave-over and audio-mode behavior in the UI**

Wire:
- queue display after `inject wave over`
- signal filtering for `focus`
- empty signal list for `muted`

- [ ] **Step 5: Implement quiet-room and empty-room fallback copy**

Add visible fallback text for:
- no active speaker
- quiet room with members
- empty room with no members

- [ ] **Step 6: Keep state semantics inside `src/room/seedRoomSource.ts` / `src/room/useSeedRoomSource.ts`**

Limit `App.tsx` to wiring and presentation so control-panel state does not leak back upward.

- [ ] **Step 7: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: PASS with all logic, room-domain, and UI tests green plus a successful build

- [ ] **Step 8: Commit**

```bash
git add src/App.room-flow.test.tsx src/App.tsx src/components/DemoControlPanel.tsx src/room/seedRoomSource.ts src/room/useSeedRoomSource.ts src/styles.css
git commit -m "test: cover critical hallway room flows"
```

### Task 8: Final Sweep and Handoff

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README to reflect the new hallway capabilities and test coverage**

```md
- 多房间 hallway 切换
- Demo controls
- UI 层房间交互测试
```

- [ ] **Step 2: Run the final verification commands**

Run: `npm test && npm run build`
Expected: PASS with zero test failures and a successful production build

- [ ] **Step 3: Review the requirements against the spec**

Check:
- `App.tsx` no longer owns the main room derivation
- `src/room/` exists and is covered by tests
- hallway supports multiple seeded rooms
- demo controls are visible and functional
- current-room context and hallway-guide join / leave semantics are visible
- UI tests cover room switching, wave-over, focus audio, and mute-all behavior
- quiet-room and empty-room fallbacks render explicit copy
- pause-feed and reset-demo controls behave as specified

- [ ] **Step 4: Commit the documentation and handoff changes**

```bash
git add README.md
git commit -m "docs: update hallway room roadmap"
```

- [ ] **Step 5: Request review before merge**

Record:
- the SHA at the start of the balanced-room-week implementation
- the SHA after the final docs commit

Dispatch a code-review subagent with:
- What was implemented: balanced room-week scope
- Plan or requirements: `docs/superpowers/specs/2026-03-11-balanced-room-week-design.md` and this plan
- Base SHA: the implementation-start SHA
- Head SHA: the final handoff SHA
- Description: room boundary, multi-room hallway, demo controls, and UI tests
