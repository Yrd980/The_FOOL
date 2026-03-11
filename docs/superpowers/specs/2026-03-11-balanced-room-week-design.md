# XTION Balanced Room Week Design

**Date:** 2026-03-11

**Goal:** 在一周内同时推进“最小必要架构抽离”和“最影响演示效果的空间房间体验补强”，让当前原型既更接近真实房间产品，又不把后续 `OpenClaw` 接入继续锁死在超大组件里。

---

## 1. 当前判断

项目不缺大方向，缺的是把方向落成稳定演示和后续演进基础的中间层能力。

从仓库现状看：

- [src/App.tsx](/home/yrd/projects/XTION_TheFool0/src/App.tsx) 已增长到 1379 行，房间状态编排、seed feed、UI 渲染和交互处理高度耦合。
- [src/styles.css](/home/yrd/projects/XTION_TheFool0/src/styles.css) 也已达到 1349 行，意味着视觉结构和组件边界仍偏松散。
- 当前测试主要集中在 [src/logic.test.ts](/home/yrd/projects/XTION_TheFool0/src/logic.test.ts)，保护的是综艺业务推导，而不是空间房间主体验。
- README 已明确列出“真实 `OpenClaw` 接入、多房间 hallway 切换、UI 层测试”是当前未完成项。

结论：这一周的最佳投入点不是再做一层新概念，而是补齐从“高保真单房间样机”走向“可演示、可扩展房间原型”的关键台阶。

## 2. 这一周真正缺的东西

### 2.1 缺房间状态边界

当前 demo 中的舞台阶段、conversation 状态、房间成员位置、观众 feed 和界面呈现还没有稳定边界。没有这一层，就无法把 seed 数据源换成真实 `OpenClaw` 状态源，也很难单独测试房间行为。

### 2.2 缺空间体验闭环

虽然视觉上已经转向 hallway / spatial room，但仍然偏单房间展示。缺少最小可用的多房间切换、加入/离开会话、队伍房间映射和更可预测的演示流，导致“空间化”更像概念而不是交互闭环。

### 2.3 缺 UI 行为保护网

`Wave over`、`Focus audio`、`Mute all`、房间切换、席位状态切换这类核心交互目前没有 UI 层回归保护。继续迭代会越来越依赖人工目测。

### 2.4 缺演示控制能力

现在 seed feed 是自动轮播式的，但缺少适合讲解和容错的控制面，例如房间切换、空态/异常态、可预测的状态注入和更明确的焦点切换。

## 3. 一周范围

### 本周目标

1. 抽出一套 seed 和未来 live source 都能复用的 room-state boundary。
2. 让 hallway 至少具备“多房间切换 + conversation 加入/离开语义 + 当前房间上下文”。
3. 为关键房间交互补上 UI 层测试基础设施和首批回归测试。
4. 让 demo 现场更可控，避免只能依赖一条固定自动播放路径。

### 本周不做

- 不接入真实 `OpenClaw` SDK / API。
- 不实现完整后端或多人实时同步。
- 不做复杂路由系统或账户体系。
- 不大规模重写视觉语言；只做服务于演示和结构清晰度的界面调整。

## 4. 推荐方案

采用 `Balanced` 路线：

- 前半周：优先抽离最小房间边界，目标不是“做完所有架构”，而是把最危险的耦合拆开。
- 后半周：基于这层边界补齐最有演示价值的多房间 hallway、demo controls 和 UI 回归测试。

不选 `Demo-first`，因为它会继续放大 [src/App.tsx](/home/yrd/projects/XTION_TheFool0/src/App.tsx) 的耦合，下一步接 live source 会明显返工。

不选 `Architecture-first`，因为一周窗口太短，纯架构抽离会让用户可见提升不足，现场感染力不够。

## 5. 设计方案

### 5.1 状态与渲染解耦

新增 `src/room/` 作为房间域边界，负责：

- 房间领域类型定义
- 舞台到 conversation 的纯推导
- 单房间与多房间的 room view model 组装
- seed source 事件推进
- React hook 形式的数据接入层

`App.tsx` 不再直接推导房间状态，只负责：

- 页面级 state
- 组合组件
- 触发用户操作
- 连接 room view model 到 JSX

#### 5.1.0 状态归属

本周采用明确的“两层模式”：

- `App.tsx` 只持有非房间域的 UI state：
  - `selectedEntityId`
  - `memberQuery`
  - `simplifiedView`
  - 以及现有页面级 `activeStageId`
- `src/room/useSeedRoomSource.ts` 持有可变的房间域 state：
  - `currentRoomId`
  - `selectedContestantId`
  - `audioMode`
  - `feedPaused`
  - `interactions`
  - `priorityContestantId`
  - `scenarioOverride`
  - `currentUser.mode`
- `src/room/` 下的纯函数只做 derivation，不直接触 React state

也就是说，本周不是 `App` 手搓 `RoomSourceSnapshot`，而是：

`App inputs (stage + derived teams/deck) -> useSeedRoomSource(...) -> { snapshot, viewModel, actions }`

这样 `App` 只消费房间层返回值，不再拥有房间状态编排本体。

#### 5.1.1 明确接口

`src/room/` 这一层必须消费现有仓库里的两类输入：

- 来自 `src/data.ts` 的 seed 内容：
  - `stageDefinitions`
  - `contestants`
  - `contestantOpenClawPresences`
  - `openClawConversation`
  - `seedAudienceInteractions`
  - `audienceHandles`
  - `danmuTemplates`
- 来自 `src/logic.ts` 的业务推导结果：
  - `buildContestantDeck(...)`
  - `buildTeams(...)`
  - 其他仍留在综艺业务层的聚合结果

`App.tsx` 对房间层的依赖要收束成一个稳定接口：

```ts
type RoomSourceSnapshot = {
  activeStageId: StageId;
  currentRoomId: string;
  selectedContestantId: string | null;
  audioMode: "nearby" | "focus" | "muted";
  feedPaused: boolean;
  interactions: AudienceInteraction[];
  priorityContestantId: string | null;
  scenarioOverride:
    | { type: "none" }
    | {
        type: "wave-over" | "quiet-room" | "empty-room";
        targetRoomId: string;
        targetContestantId?: string;
      };
};

type RoomSeatViewModel = {
  id: string;
  selectionId: string;
  name: string;
  seatLabel: string;
  state: "speaking" | "raised-hand" | "listening" | "queued" | "muted";
  stateLabel: string;
  teamName: string;
  roomX: number;
  roomY: number;
  meter: number;
};

type ListenerEntityViewModel = {
  id: string;
  selectionId: string;
  kind: "judge" | "ai" | "listener";
  name: string;
  subtitle: string;
  status: string;
  x?: number;
  y?: number;
};

type RoomMemberViewModel = {
  id: string;
  kind: "contestant" | "judge" | "ai" | "listener";
  name: string;
  stateLabel?: string;
};

type RoomViewModel = {
  currentRoom: {
    id: string;
    name: string;
    kind: "main-stage" | "team-room" | "quiet-orbit";
    teamId?: string;
    statusLabel: string;
  };
  roomList: Array<{
    id: string;
    name: string;
    kind: "main-stage" | "team-room" | "quiet-orbit";
    teamId?: string;
    memberCount: number;
    audibleSummary: string;
    active: boolean;
  }>;
  conversation: {
    speakerId: string | null;
    raisedHandId: string | null;
    queuedIds: string[];
    listeningIds: string[];
    callout: string;
  };
  openClawSeats: RoomSeatViewModel[];
  listenerEntities: ListenerEntityViewModel[];
  roomMembers: RoomMemberViewModel[];
  audibleSignals: AudienceInteraction[];
  currentUser: {
    id: "hallway-guide";
    roomId: string;
    mode: "perimeter" | "listening";
  };
};

type RoomActionApi = {
  switchRoom: (roomId: string) => void;
  joinConversation: () => void;
  leaveConversation: () => void;
  setAudioMode: (mode: "nearby" | "focus" | "muted") => void;
  toggleFeedPaused: () => void;
  injectScenario: (scenario: "wave-over" | "quiet-room" | "empty-room" | "none") => void;
  resetDemo: () => void;
};
```

允许命名有所调整，但职责不应变化：`App.tsx` 只消费 `snapshot -> viewModel + actionApi`，不再自己拼房间规则。

### 5.2 多房间 hallway 的最小闭环

本周的多房间不追求完整导航系统，只做最小可演示闭环：

- `Main stage`：当前全局舞台 / 主对话房间
- `Team rooms`：根据现有组队结果生成 2-3 个队伍房间
- `Quiet orbit`：外围监听区或候场区

每个房间需要有：

- 房间 ID、名称、类型、当前状态说明
- 房间成员列表与可听信号摘要
- 当前用户所在房间和可切换目标

这足以把“空间关系”从单画面视觉隐喻推进到真正可操作的产品概念。

#### 5.2.0 房间生成规则

本周房间 ID 规则固定如下：

- `main-stage`
- `team-room-1`, `team-room-2`, `team-room-3`
- `quiet-orbit`

`team-room-*` 与队伍的映射固定为当前 `buildTeams(...)` 结果顺序：

- `team-room-1 -> teams[0]`
- `team-room-2 -> teams[1]`
- `team-room-3 -> teams[2]`

每个房间都要携带 `teamId`（若适用），以便在 stage/team 变化后保持 deterministic mapping。

房间成员规则固定如下：

- `main-stage`
  - 当前 `conversation` 的 speaker、raised-hand、listening、queued contestants
- `team-room-*`
  - 对应队伍的全部成员
- `quiet-orbit`
  - 当前不在 `main-stage conversation` 中的 contestants
  - 全部非 contestant listener entities

回退规则：

- 若 `currentRoomId` 无效，重置为 `main-stage`
- 若队伍数不足 3，只生成已有队伍对应的 `team-room-*`
- 若 stage 或 team composition 变化，房间成员以最新推导结果重建，但 room ID 规则不变
- 若某个 `scenarioOverride.targetRoomId` 在重建后已不存在，则自动清除该 override

不同房间的 conversation / signal 规则：

- `main-stage`
  - 使用完整的 stage-driven `deriveConversationState(...)`
- `team-room-*`
  - 若房间对应当前 `focusTeam`，使用 `deriveConversationState(...)` 结果并过滤到该 team members
  - 若房间不对应当前 `focusTeam`，则：
    - `speakerId = team.members[0]?.id ?? null`
    - `raisedHandId = team.members[1]?.id ?? null`
    - `listeningIds = team.members.map(id).slice(0, 3)`
    - `queuedIds = []`
    - `statusLabel = "Team discussion"`
    - `audibleSignals =` 只取该 team member 的最近互动
- `quiet-orbit`
  - `speakerId = null`
  - `raisedHandId = null`
  - `queuedIds = []`
  - `listeningIds = []`
  - `statusLabel = "Quiet orbit"`
  - `audibleSignals = []`，除非用户处于 `nearby` 且当前有外围 listener 摘要

#### 5.2.1 当前用户模型

为了避免在本周引入真实登录和 presence 身份系统，本周使用一个明确的本地 demo persona：

- `currentUser.id = "hallway-guide"`
- 角色定位：本地演示控制者 / 观察者，不占用选手席位，不会成为主麦
- 默认起点：`main-stage`
- 默认模式：`perimeter`

本周“切换房间 / 加入 / 离开 conversation”语义定义如下：

- `switchRoom(roomId)`：
  - 改变当前用户所在房间
  - 更新当前房间上下文和可听信号来源
  - 不改变选手队列和主麦状态
- `joinConversation()`：
  - 将当前用户模式从 `perimeter` 切到 `listening`
  - 表示当前用户贴近当前 conversation 监听，不进入发言席位
  - 不把当前用户加入 contestant seat 或 queue
- `leaveConversation()`：
  - 将当前用户模式从 `listening` 切回 `perimeter`
  - 视觉上回到房间外围 / hallway

也就是说，本周的 “join/leave” 是观察者语义，不是参赛者上麦语义；这样既能支撑 hallway 概念，也不与“只有选手接入 `OpenClaw`”冲突。

### 5.3 演示控制面

增加轻量 demo controls，服务于讲解而不是内部运维：

- 手动切换房间
- 暂停 / 恢复 seed feed
- 快速切换 audio mode
- 注入关键状态：`wave over`、聚焦主麦、空房间、安静房间

控制面可以很轻，但必须让演示路径可控。

#### 5.3.1 Demo controls 行为规则

为了让实现和测试不必临时发明规则，本周的控制优先级固定如下：

1. `scenarioOverride`
2. 显式用户操作：`switchRoom`、`joinConversation`、`leaveConversation`、`setAudioMode`
3. seed feed 自动推进结果

具体行为：

| 控制 | 行为 |
|---|---|
| `toggleFeedPaused()` | 只暂停自动 feed 推进；不阻止手动切房间或切 audio mode |
| `injectScenario("wave-over")` | 将当前选中的选手提升为目标房间 queue 首位，并把 override 绑定到触发时的 `targetRoomId`；切换房间不会把该 override 带走 |
| `injectScenario("quiet-room")` | 绑定到触发时的 `targetRoomId`；保留房间成员，但清空 `audibleSignals`，`speakerId = null` |
| `injectScenario("empty-room")` | 绑定到触发时的 `targetRoomId`；当前房间成员视图为空，`speakerId = null`，`queuedIds = []`，`audibleSignals = []` |
| `injectScenario("none")` | 清空场景覆盖，回到 seed 推导状态 |
| `setAudioMode("focus")` | 只保留当前主麦信号；若 `speakerId = null`，则返回空信号列表 |
| `setAudioMode("muted")` | 总是返回空信号列表 |

空态 / 回退规则：

- 若房间无主麦，conversation dock 显示 idle 文案，不渲染 speaker meter。
- 若房间无人，spatial floor 显示空房间提示，sidebar 仍保留可切换房间列表。
- 若房间安静但有人，显示成员但不显示 room signal feed。
- `switchRoom()` 传入未知房间 ID 时：
  - 若当前 `currentRoomId` 仍有效，则 no-op
  - 否则回退到 `main-stage`
- `joinConversation()` / `leaveConversation()` 在当前模式已满足时为 no-op
- `injectScenario("wave-over")` 若当前没有选中 contestant，则 no-op
- `injectScenario("wave-over")` 若 `targetRoomId !== "main-stage"`，则 no-op
- `injectScenario("wave-over")` 若当前选中 contestant 不属于 `main-stage` 可见成员集合，则 no-op
- `quiet-room` / `empty-room` 若引用了失效房间，则 override 被丢弃
- `Reset demo` 的效果等同于：
  - `currentRoomId = "main-stage"`
  - `selectedContestantId = contestants[0].id`
  - `audioMode = "nearby"`
  - `feedPaused = false`
  - `scenarioOverride = { type: "none" }`
  - `currentUser.mode = "perimeter"`
  - `priorityContestantId = null`
  - `interactions = seedAudienceInteractions`
  - 不重置 `activeStageId`，因为 stage 仍由页面级节奏控制

### 5.4 UI 测试策略

新增 `jsdom + Testing Library`，只覆盖最关键路径：

- 房间切换后上下文和成员视图同步变化
- `joinConversation()` / `leaveConversation()` 会切换当前用户模式和房间提示
- `Wave over` 会把选手推进当前 conversation queue
- `Focus audio` 只保留主麦相关信号
- `Mute all` 会切断可听 feed
- 关键空态和边界态不会导致主视图崩坏

测试目标不是铺满，而是先为后续高频改动区域建保护带。

## 6. 文件与边界

### 新增或强化的房间域文件

- `src/room/types.ts`
- `src/room/deriveConversationState.ts`
- `src/room/buildRoomViewModel.ts`
- `src/room/seedRoomSource.ts`
- `src/room/useSeedRoomSource.ts`
- `src/room/rooms.ts`
- `src/room/index.ts`

### 拆分出来的展示组件

- `src/components/ConversationDock.tsx`
- `src/components/SpatialRoomFloor.tsx`
- `src/components/PresenceSidebar.tsx`
- `src/components/DemoControlPanel.tsx`

### 测试与配置

- `src/room/*.test.ts`
- `src/App.room-flow.test.tsx`
- `src/test/setup.ts`
- `vite.config.ts`
- `package.json`

## 7. 风险与应对

### 风险 1：范围膨胀

多房间和测试一旦摊开，很容易演变成“顺手再做一个完整房间系统”。

应对：只做 seed-backed 多房间，不做真实实时协作，不做复杂路由。

### 风险 2：边界抽离后 UI 回归

从 [src/App.tsx](/home/yrd/projects/XTION_TheFool0/src/App.tsx) 抽逻辑时最容易产生静默回归。

应对：先补纯函数测试，再做 App 接线，再补 UI 测试。

### 风险 3：测试基础设施反客为主

如果一开始把测试脚手架做得过重，会挤压一周内的体验改进时间。

应对：只增加 `jsdom` 和最小 Testing Library 组合，不在本周引入额外复杂测试工具链。

## 8. 验收标准

本周结束时，应能满足以下条件：

1. `App.tsx` 不再直接承载主要房间推导逻辑。
2. seed source 和 room view model 可以独立测试。
3. 原型支持最小多房间 hallway 切换，并保留现有空间房间风格。
4. 至少有一组 UI 测试覆盖：
   - 指定房间切换
   - `joinConversation()` / `leaveConversation()`
   - `Wave over`
   - `Focus audio`
   - `Mute all`
   - `quiet-room` / `empty-room` 回退显示
5. `npm test` 与 `npm run build` 可作为本周收口验证命令。

## 9. 实施建议

本设计对应的实现计划应按四个工作流展开：

1. 房间边界抽离
2. 多房间 hallway 闭环
3. 演示控制与关键展示组件抽离
4. UI 测试与最终收口

对应计划文件：`docs/superpowers/plans/2026-03-11-balanced-room-week.md`
