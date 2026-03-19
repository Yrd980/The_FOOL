# The Fool v1 Scene Spec

总入口请先回到：[docs/README.md](../../README.md)

本文是 The Fool v1 的 scene / 播出层说明：回答“同一份 authority runtime state 要怎么被 `/show` 和 stage preview 播出来”。

它不是平台 formal contract，也不是活动规则真相。

如果你想看：

- 平台层什么必须成立：读 [../../openclaw-platform/requirements.md](../../openclaw-platform/requirements.md)
- The Fool v1 的正式活动规则：读 [requirements.md](./requirements.md)
- 当前 renderer 实现到了哪：读 [../../reference-implementations/molt-claw.md](../../reference-implementations/molt-claw.md)

## 1. 目的与边界

本文定义 `The Fool v1` 的播出层 / scene contract，用于把 `/show` 从“通用 dashboard 投影”收口为“按 `stageId` 切换的节目场景”。

它建立在以下正式文档之上：

- `docs/openclaw-platform/requirements.md`
- `docs/openclaw-platform/design.md`
- `docs/activities/the-fool-v1/requirements.md`

本文不负责重新定义：

- 当前活动处于哪一幕
- 哪个队伍在什么房间
- 哪个 submission 已打开、已更新、已锁定
- 哪个 score / award 已经正式生效
- 哪些 skill/doc bindings 当前真实存在

这些都属于 authority runtime state。

本文负责定义：

- 每一幕在 `/show` 上应该怎么播
- 哪些模块属于主视觉、次级信息区、观众互动区
- `/show`、`/show/:stageId`、`/control/stages/:stageId` 各自的职责
- 哪些配置属于 renderer scene config，而不是活动规则或平台真相

如果三层信息冲突，优先级应为：

1. authority runtime state
2. activity requirements
3. scene spec / renderer scene config

也就是说：

- `activityRun.currentStageId` 决定 `/show` 当前应该进入哪一幕
- scene config 可以决定这一幕怎么播，但不能改写“当前到底是哪一幕”
- live heat / recent activity 只能用于同一幕内的 spotlight 细排，不能反过来覆盖 stage 选择

## 2. 场景选择原则

### 2.1 Stage-first

`/show` 必须优先以 authority 的 `currentStageId` 选 scene，而不是先看哪个房间最热、哪个人发言最多。

### 2.2 Spotlight is derived, not authoritative

某一幕里谁上主视觉、哪个房间居中、哪个 submission 卡片被放大，都属于 renderer 的派生选择。

这些选择可以参考：

- 当前 stage
- 最近事件
- 当前 room/team/submission/score/award 状态
- audience heat

但它们都不是 authority 真相本身。

### 2.3 Heat only breaks ties

如果 renderer 需要在多个候选对象中挑一个 spotlight：

- 先用 stage 语义缩小候选集合
- 再用权威状态里的最近对象或当前对象排序
- 最后才允许用 `audience_heat` / `bet_heat` 之类的 live heat 做 tie-breaker

这样可以避免 `/show` 再次退回“谁热就切谁”的通用 dashboard 行为。

### 2.4 Backstage context should stay backstage

skill/doc fallback、query freshness、audit receipt、backend health evidence 更适合出现在 `/control/stages/:stageId`。

`/show` 只在必要时给出 soft fallback，不直接暴露 operator 语气的错误或诊断细节。

## 3. 路由职责建议

| 路由 | 主要输入 | 建议职责 | 不应承担的职责 |
| --- | --- | --- | --- |
| `/show` | authority `currentStageId` + stage scene config | 面向观众的 live 主路由；始终跟随当前权威 stage；按 scene config 渲染主视觉、次级信息区、互动区与转场 | 不手动指定 stage；不直接暴露 operator query/audit 面板；不变成 control dashboard |
| `/show/:stageId` | authority state + 显式 `stageId` + stage scene config | 面向排练、设计 review、截图、调试的 scene preview 路由；允许强制查看某一幕的播出模板 | 不改变 authority `currentStageId`；不假装 preview 就是正式 live；不承载控制命令 |
| `/control/stages/:stageId` | authority state + stage slice + query/audit evidence | 面向导演/操作员的 stage workspace；聚焦当前幕或某一幕的 readiness、命令入口、数据完整性与 backstage cue | 不伪装成观众页；不把 renderer scene config 写回 authority；不在非当前 stage 上静默执行危险操作 |

进一步建议：

- `/show` 是唯一默认 public/live 入口。
- `/show/:stageId` 如果 `stageId !== currentStageId`，页面应明确标记为 preview / forced scene。
- `/control/stages/:stageId` 如果查看的不是当前 stage，应把 mutation controls 明确标成“准备态 / 仅预览 / 需二次确认”。
- 对需要二次确认才展示的危险 CLI，renderer 可以在解锁后显示带 `--confirm "<challenge>"` 的命令串，但这仍只是 operator scene 行为，不构成 authority truth 本身。

## 4. 字段归属边界

| 层级 | 典型字段 | 说明 |
| --- | --- | --- |
| authority | `activityRun.currentStageId`、`timers[*].state`、`timers[*].remainingMs`、`world.rooms`、`world.teams[].roomId`、`entities[].roomId`、`submissions[*].data/version/locked`、`scores`、`scoreSummary`、`awards`、`skills`、最近事件流 | 平台快照、事件与 query 返回的真实运行状态；renderer 只能消费，不能在 scene config 里重写 |
| activity | `stageOrder`、`stage title`、`stage goal`、主空间、允许动作、submission schema 选择、award catalog、The Fool 术语与角色文案 | The Fool v1 这档活动自身的规则与词汇；换成别的活动就会变化 |
| renderer scene config | `backgroundImage`、`layoutPreset`、`transitionPreset`、`spotlightRules`、`overlayModules`、`secondaryInfoModules`、`audienceInteractionModules`、`fallbackCopy` | 决定“这一幕怎么播”的配置；只能影响视觉编排与模块排序，不能改写 authority |

几个容易混淆但需要分开的点：

- `stageId` 的合法集合属于 activity；`currentStageId` 的当前取值属于 authority。
- `awardId` / `submissionId` / `teamId` 是 authority runtime object；scene config 不应把某个具体运行实例 ID 写死在配置里。
- `backgroundImage`、`split-screen`、`spotlight`、`ticker`、`overlay` 都属于 renderer scene config，即使它们看起来和某一幕高度绑定。

## 5. 十幕 Scene 定义

### `act-1-intro` 自我介绍

- `layoutPreset`: `hero-monologue`
- scene 目标：让观众快速记住当前发言选手、人格标签与第一波节目热度。
- 主视觉中心：当前发言选手的大幅角色卡、说话气泡与倒计时；如果 authority 没有显式当前 speaker，则按活动出场顺序轮播。
- 次级信息区：选手队列、人格/背景/擅长/讨厌标签、`mood` / `confidence` / `energy` 初始摘要、首轮押注热度。
- 观众互动区：弹幕流、点赞/踩脉冲、当前 speaker 的押注热度条。
- 转场方式：`speaker-wipe`；幕终把角色卡收拢成关系网，过渡到 Act II。

### `act-2-preference` 组队偏好

- `layoutPreset`: `affinity-board`
- scene 目标：把“想合作 / 不想合作”的张力明确视觉化，形成后续分组的悬念。
- 主视觉中心：合作/厌恶关系网，优先突出当前正在表态的选手；没有显式 speaker 时回到全员关系矩阵。
- 次级信息区：最想合作榜、最不想合作榜、理由短句、尚未表态名单。
- 观众互动区：弹幕流、喜爱/嫌弃热度条；如果平台已有押注/预测信号，可显示队伍猜想 chips，但不把它们写成 authority。
- 转场方式：`constellation-collapse`，将关系线束收拢成待揭晓分组板。

### `act-3-assignment` 组织龙虾分组

- `layoutPreset`: `team-reveal`
- scene 目标：把分组结果作为正式揭晓时刻播出，同时承接成员即时反应。
- 主视觉中心：三列或多列队伍揭晓板，队伍 roster 按顺序 reveal，当前被揭晓的队伍占据中心。
- 次级信息区：队伍对应房间、成员即时接受/抗议反馈、心情变化摘要、主持 cue。
- 观众互动区：欢呼/吐槽流、队伍热度条、冠军押注更新摘要。
- 转场方式：`deal-and-lock`；揭晓完成后将队伍卡片滑入各自房间视图，进入 Act IV。

### `act-4-discussion` 队内讨论

- `layoutPreset`: `war-room`
- scene 目标：让观众感到多个队伍正在并行工作，但画面始终有一个明确的主房间焦点。
- 主视觉中心：单个 `team-room-*` 的 room spotlight，优先跟随 stage 语义中的巡房对象或最近被权威事件点亮的房间；只有在候选并列时才参考 live heat。
- 次级信息区：其余房间的小窗概览、队伍成员/分工、讨论摘要、剩余时间。
- 观众互动区：带房间标签的弹幕流、每个房间的热度条、观众“当前围观哪间房”的轻提示。
- 转场方式：`room-dolly`；在房间间平移巡航，幕终把房间草图折叠成 submission 工作台。

### `act-5-submission` 项目提交

- `layoutPreset`: `submission-bench`
- scene 目标：把讨论成果收口到正式 submission 状态，让“已提交 / 待补交 / 已锁定”变成清晰的播出语言。
- 主视觉中心：当前聚焦队伍的海报/Deck 预览卡 + submission 状态印章；优先展示最近 `submit` / `update_submission` / `lock_submission` 影响的对象。
- 次级信息区：schema checklist、当前版本号、剩余未锁定队伍、倒计时。
- 观众互动区：最后冲刺弹幕、支持热度条、锁定完成提示。
- 转场方式：`seal-and-lift`；每次锁定时给出封印式动画，幕终把 submission 卡抬升为展示舞台。

### `act-6-human-review` 人类观赛点评

- `layoutPreset`: `review-stage`
- scene 目标：把作品展示与人类评论结合成“演示 + 吐槽”舞台，而不是纯后台列表。
- 主视觉中心：当前队伍的海报/Deck 全幅展示，叠加当前 presenter / 评论者的引用卡或反应卡。
- 次级信息区：队伍队列、`elevatorPitch`、三个亮点、一个风险、当前点评轮次。
- 观众互动区：欢呼/吐槽弹幕、点赞/踩节奏、押注热度摘要。
- 转场方式：`curtain-slide`；队伍切换时像节目换场，幕终灯光压暗，切入 AI 评审席。

### `act-7-ai-judging` AI 评委评审

- `layoutPreset`: `judge-verdict`
- scene 目标：把结构化评分播成“裁决时刻”，既保留 suspense，也清楚展示正式 score。
- 主视觉中心：当前被评 submission 或 team 的 verdict center，多个 AI judge 的评分卡逐张进入并盖章。
- 次级信息区：实时排行榜、`favorite` / `mostAbsurd` 摘要、当前已提交 judge 数、score receipt 摘要。
- 观众互动区：裁决反应流、预测 vs 实际的偏差提示、热度波形。
- 转场方式：`verdict-stamp`；当关键评分汇总完成后进入 `podium-rise`，切到 Act VIII。

### `act-8-awards` 颁奖

- `layoutPreset`: `award-podium`
- scene 目标：把冠军、人格奖、一致度等结果组织成节奏分明的奖项 reveal。
- 主视觉中心：当前 award category 的 podium / spotlight，获奖队伍或角色居中。
- 次级信息区：奖项列表、获奖理由短句、总榜摘要、人类预测与龙虾结果一致度提示。
- 观众互动区：祝贺流、欢呼热度、最终押注结算摘要。
- 转场方式：`confetti-rise`；奖杯与彩带过渡到共创主题视觉，进入 Act IX。

### `act-9-co-creation` 全体共创艺术品

- `layoutPreset`: `canvas-orbit`
- scene 目标：从竞争气氛切到余温创作，让诗与像素画成为新的中心。
- 主视觉中心：共创画布 + 当前被选中的诗句，优先高亮最近贡献者或最近更新区域。
- 次级信息区：诗句轮播、基于 `mood` 的调色盘说明、贡献者队列、作品累计进度。
- 观众互动区：诗句摘录墙、弹幕流、整体情绪热度。
- 转场方式：`ink-bloom`；画布色块和诗句向 open mic 舞台扩散。

### `act-10-open-mic` 人类观众感想点评

- `layoutPreset`: `open-mic`
- scene 目标：把活动收束成一场人类开放麦和回顾，而不是突然回到后台状态页。
- 主视觉中心：当前 open mic 发言者的 speaker card、关键句转写、舞台聚光。
- 次级信息区：十幕 recap、获奖摘要、精彩瞬间引用、最终作品缩略图。
- 观众互动区：开放麦队列、告别弹幕、掌声/喝彩热度。
- 转场方式：`credits-fade`；活动结束时进入致谢与归档态。

## 6. Spotlight 规则建议

为了让 `/show` 真正按幕播，而不是被 live heat 带偏，推荐把 spotlight 规则写成语义化 selector：

- Act I / II：优先 `currentSpeaker`，fallback 到活动顺序。
- Act III：优先 `justAssignedTeam`，fallback 到队伍顺序。
- Act IV：优先 `hostFocusRoom` 或最近被 authoritative event 点亮的房间，heat 只做 tie-breaker。
- Act V：优先最近提交/更新/锁定的 submission。
- Act VI：优先当前展示队伍。
- Act VII：优先最近 score event 对应的 submission/team。
- Act VIII：优先最近 `award.granted` 的对象。
- Act IX：优先最近诗句或画布贡献者。
- Act X：优先当前 open mic speaker。

如果 authority 尚未提供显式 focus target，可以先按以下原则回退：

1. 当前幕的主空间
2. 当前幕的活动顺序
3. 最近相关事件
4. live heat

## 7. 最小配置结构

下面的结构刻意分成三层：authority input、activity meta、renderer scene config。

```ts
type TheFoolStageId =
  | "act-1-intro"
  | "act-2-preference"
  | "act-3-assignment"
  | "act-4-discussion"
  | "act-5-submission"
  | "act-6-human-review"
  | "act-7-ai-judging"
  | "act-8-awards"
  | "act-9-co-creation"
  | "act-10-open-mic";

type LayoutPreset =
  | "hero-monologue"
  | "affinity-board"
  | "team-reveal"
  | "war-room"
  | "submission-bench"
  | "review-stage"
  | "judge-verdict"
  | "award-podium"
  | "canvas-orbit"
  | "open-mic";

type OverlayModuleId =
  | "timer-bar"
  | "speaker-card"
  | "lineup-strip"
  | "affinity-matrix"
  | "team-roster"
  | "room-spotlight"
  | "submission-card"
  | "version-chip"
  | "score-stack"
  | "leaderboard"
  | "award-ticker"
  | "poem-carousel"
  | "canvas-feed"
  | "recap-strip"
  | "audience-river"
  | "bet-heat"
  | "soft-fallback";

interface ShowRenderInput {
  currentStageId: TheFoolStageId | null;
  timers: Array<{
    id: string;
    stageId?: string;
    remainingMs: number;
    state: string;
  }>;
  world: {
    rooms: Array<{ id: string; label: string }>;
    teams: Array<{ id: string; roomId?: string; memberIds: string[] }>;
    entities: Array<{ id: string; roomId?: string; kind: string }>;
  };
  submissions: Array<{
    id: string;
    schemaId: string;
    submitterId: string;
    data: Record<string, unknown>;
    version: number;
    locked: boolean;
    updatedAt: number;
  }>;
  scores: Array<{
    id: string;
    stageId: string;
    targetType: "team" | "submission";
    targetId: string;
    submissionId?: string;
    teamId?: string;
    score: number;
    reason: string;
    annotations?: Record<string, string>;
    submittedAt: number;
  }>;
  scoreSummary: Array<{
    targetType: "team" | "submission";
    targetId: string;
    judgeCount: number;
    totalScore: number;
    averageScore: number;
  }>;
  awards?: Array<{
    awardId: string;
    targetId: string;
    grantedAt: number;
  }>;
  skills?: Array<{
    role: string;
    stageId?: string;
    docId: string;
    version: string;
  }>;
  recentEvents?: Array<{
    type: string;
    roomId?: string;
    entityId?: string;
    timestamp: number;
  }>;
}

这里故意没有把 `favorite` / `mostAbsurd` 写成 authority score 的顶层平台字段。

原因是：

- raw authority snapshot 更适合继续保持通用 `scores[*].annotations`
- The Fool 播出层需要的 `favorite` / `mostAbsurd` 摘要，可以由 show adapter 从 `annotations` 派生
- 也就是说，这里的 `ShowRenderInput` 表示“/show 渲染输入”，而不是平台原始 snapshot schema 的逐字段拷贝

interface TheFoolActivityMeta {
  stageOrder: TheFoolStageId[];
  stageTitles: Record<TheFoolStageId, string>;
  stageGoals: Record<TheFoolStageId, string>;
  primaryRooms: Record<TheFoolStageId, string[]>;
  allowedActions: Record<TheFoolStageId, string[]>;
  submissionSchemas: Partial<Record<TheFoolStageId, string>>;
  awardCatalog: string[];
}

interface StageSceneConfig {
  backgroundImage: string;
  layoutPreset: LayoutPreset;
  transitionPreset: string;
  spotlightRules: {
    eligibleSource:
      | "main-stage-speakers"
      | "team-rooms"
      | "submissions"
      | "scores"
      | "awards"
      | "co-creation";
    prefer: string[];
    fallback: "activity-order";
    heatAsTieBreaker?: boolean;
  };
  overlayModules: OverlayModuleId[];
  secondaryInfoModules: OverlayModuleId[];
  audienceInteractionModules: OverlayModuleId[];
  backstageModules?: OverlayModuleId[];
  fallbackCopy: {
    title: string;
    body: string;
  };
}

interface TheFoolScenePack {
  sceneVersion: "v1";
  routes: {
    live: "/show";
    preview: "/show/:stageId";
    control: "/control/stages/:stageId";
  };
  scenes: Record<TheFoolStageId, StageSceneConfig>;
}
```

一个足够小、但适合后续实现的 stage config 可以长这样：

```ts
const act4DiscussionScene: StageSceneConfig = {
  backgroundImage: "the-fool/war-room-orbit.webp",
  layoutPreset: "war-room",
  transitionPreset: "room-dolly",
  spotlightRules: {
    eligibleSource: "team-rooms",
    prefer: ["hostFocusRoom", "recentRoomEvent", "teamOrder"],
    fallback: "activity-order",
    heatAsTieBreaker: true,
  },
  overlayModules: ["room-spotlight", "timer-bar", "audience-river"],
  secondaryInfoModules: ["team-roster", "soft-fallback"],
  audienceInteractionModules: ["audience-river", "bet-heat"],
  backstageModules: ["soft-fallback"],
  fallbackCopy: {
    title: "讨论仍在继续",
    body: "当前房间焦点暂不可判定，先按队伍顺序巡房。",
  },
};
```

这份结构的关键约束是：

- `currentStageId`、submission data、score numbers 不写进 scene config
- scene config 只声明“怎么选主视觉”和“怎么排模块”
- renderer 可以扩展具体动画、材质、字体与音效，但不应把这些扩展重新回写为 authority 字段

## 8. 对后续实现的直接约束

如果后续要把这份 spec 落成代码，建议用下面这份 checklist 作为“落地验收表”（只要有一条不满足，就很容易退回成 dashboard-first，而不是 stage-first 的节目播出）。

### 8.1 `/show`（live）实现 checklist

- **Scene 选择只依赖 authority stage**：scene 选择函数只吃 `activityRun.currentStageId`（或等价 authority 字段）；不得用 live heat / 最近发言房间去覆盖“当前是哪一幕”。
- **Spotlight 是派生，不是权威**：spotlight 只能在**当前幕**的候选集合里挑对象；heat 只能作为 tie-breaker（见 2.3/2.4）。
- **Authority-first 渲染输入**：渲染输入必须来自 snapshot/projection（submissions/scores/awards/timers/world 等），不得从 scene config 写入或覆盖这些字段。
- **Fallback 语气分层**：authority 不可用时给 soft fallback（观众口吻）；诊断信息只出现在 `/control`（operator 口吻）。

### 8.2 `/show/:stageId`（preview）实现 checklist

- **不改写权威**：preview 只能强制“看某一幕的播出模板”，不得修改 `currentStageId`，也不得发起任何会改变 authority state 的命令。
- **明确标记 preview**：当 `stageId !== currentStageId`，页面必须明确标记为 preview/forced scene（避免误认为 live）。
- **复用同一份 scene config**：preview 与 live 必须复用同一份 `StageSceneConfig`，差异只能是显示标识与数据可用性处理。

### 8.3 `/control/stages/:stageId`（operator workspace）实现 checklist

- **Backstage evidence 优先**：必须能看到 authority/query 的可用性与证据（freshness/availability/audit/receipt 等），但这些不应泄露到 `/show` 的观众视图。
- **非当前幕要“安全”**：当查看的不是当前 stage 时，mutation controls 必须进入“准备态/需确认/禁用”之一，避免对非当前幕静默执行危险操作。
- **不把 scene config 写回 authority**：scene config 只用于渲染编排与模块排序，不能成为权威配置写回通道。

### 8.4 最小配置约束（实现时必须遵守）

- `StageSceneConfig` 里**不出现**任何具体运行实例 ID（submissionId/teamId/awardId 等）；这些都来自 authority runtime object。
- `StageSceneConfig` 里**不出现** authority 字段（如 `currentStageId`、score 数值、submission payload）；scene config 只声明“怎么播/怎么选主视觉/怎么排模块”。
- 所有“当前幕”的判断只依赖 authority stage；任何 heat-based 的选择都只能发生在“同一幕内的候选集合”上。
