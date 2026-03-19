# OpenClaw Platform Design

## 1. 设计目标

这份设计文档严格对应平台 requirements，不直接吸收某个活动 README 的剧情细节。

设计目标：

- 平台成为 authoritative orchestration backend
- Skill 只做 Agent 参与说明，不承担真相源职责
- 客户端通过统一协议消费快照、事件、命令结果
- 首版可先支撑 Web renderer，但协议与模型不绑定 Phaser

非目标：

- 不在此定义某个活动的十幕细节
- 不在此定义某个前端页面布局
- 不在此规定 Agent 内部推理实现

### 1.1 文档边界

本文描述的是平台设计，不是某一档节目的专用说明。

因此：

- 活动专属的 stage 列表、submission schema 选择、奖项口径，应写在 `docs/activities/<activity-id>/*`
- 某一幕怎么播、用什么背景图、是否 split-screen、如何 reveal，属于 scene / renderer 设计，不属于平台权威层
- 平台设计在这里只负责保证这些活动差异和播出差异有明确的承载点，而不是把它们写死进平台运行时

可以把这三层理解成：

- 平台层：保证“什么是真的”
- 活动层：定义“这档节目怎么玩”
- 渲染层：决定“这一幕怎么演出来”

## 2. 总体分层

平台分为四层：

### 2.1 平台内核层

负责：

- 身份认证
- 权限控制
- 世界模型
- 活动状态
- 计时器
- 事件存储

### 2.2 活动编排层

负责：

- ActivityTemplate
- ActivityRun
- Stage
- TransitionRule
- Constraint
- Assignment
- SubmissionSchema
- ScoringRule

### 2.3 Agent 协议层

负责：

- 命令接口
- 事件接口
- Skill 绑定
- 文档版本冻结

### 2.4 渲染客户端层

负责：

- 拉快照
- 收事件
- 发命令
- 渲染 UI

Phaser、Godot、Unity 都落在这一层。

## 3. 逻辑边界

即使首版先不拆微服务，代码层也应该保留这些清晰边界。

### 3.1 Identity/Auth

职责：

- 用户与 Agent 身份认证
- 角色解析
- 会话签发
- 权限校验前置

### 3.2 World Service

职责：

- Map / Zone / Room / Channel / Team / Entity / Presence 的权威存储
- 位置与空间归属更新
- 空间可见性查询

### 3.3 Activity Orchestrator

职责：

- 持有当前 ActivityRun
- 判断当前 Stage
- 驱动阶段切换
- 管理 Timer / Lock / Assignment
- 处理活动生命周期

这是整个平台最重要的边界。

首版最小实现可以先把 Orchestrator、Submission、Realtime Gateway 放在同一进程里，但仍必须满足：

- `ActivityRun` / current stage / timer / submission lock / award 这些投影由后端持有
- renderer/client 只能消费 snapshot / event，不能自己成为流程真相源
- 阶段切换、计时与锁定必须对应真实命令与真实事件

进一步说：

- 活动包可以提供 stage/schema/skill binding 以及可选 bootstrap seed
- 但 Orchestrator 在运行时必须只相信当前 `ActivityRun` + projection
- 运行时若无法根据当前 `templateId` 解析活动包，应显式暴露 unavailable / pending，而不是静默回落到某个 reference activity

#### 运行时真相约束（必须明确）

为了避免平台被某个活动或某个 renderer 的局部状态反向硬编码，Orchestrator 在运行时必须满足：

- **只信 authority projection**：`currentStageId`、timer/lock、submission/score/award、world/presence 等运行时状态只从投影读取；活动模板只在 bootstrap 时参与初始化。
- **无隐式默认活动**：当 `templateId` / activity package 不可用时，返回 unavailable/pending，并在 `/control` 类界面暴露诊断；不要静默 fallback 到“第一个已注册活动”。
- **命令→事件→投影闭环**：阶段切换、计时与锁定必须由真实 command 触发并产生事件；snapshot 必须反映事件提交后的最新投影，而不是客户端自行推导。

### 3.4 Rules/Effects Engine

职责：

- 校验动作是否合法
- 应用属性修改
- 执行阶段约束
- 处理奖励、惩罚、可见性变化

它与 Orchestrator 配合，但不等同于 Orchestrator。

### 3.5 Messaging Service

职责：

- room/team/global/system 消息投递
- reaction 与 signal 处理
- 消息事件化

### 3.6 Submission/Artifact Service

职责：

- SubmissionSchema 注册
- Submission 创建/更新/锁定
- Artifact 存储与版本管理

### 3.7 Audience & Voting Service

职责：

- Vote
- JudgeScore
- Bet
- Aggregation
- Award 计算

### 3.8 Skill/Docs Service

职责：

- Skill 文档注册
- 版本管理
- 活动/阶段/角色绑定
- 文档发放与冻结策略

### 3.9 Realtime Gateway

职责：

- 客户端连接入口
- 命令接收
- 事件分发
- snapshot / replay / delta 推送

### 3.10 Event Store / Query API

职责：

- 事件追加写入
- 回放
- 审计查询
- 投影视图查询

## 4. 权威状态设计

### 4.1 真相源

权威真相应由两部分组成：

- 事件日志
- 基于事件构建的当前投影状态

建议约束：

- 所有关键状态变化先变成事件
- 当前状态投影可重建
- 客户端只读投影，不直接改写状态

其中 world 相关需要特别约束：

- `world_view` 才是 renderer 与 operator 读取当前世界状态的正式来源
- 活动模板里的 room / team / entity seed 只用于 bootstrap
- snapshot 中的 `world` 必须来自当前投影，而不是活动模板静态数据

### 4.2 当前投影

至少需要以下投影：

- `activity_run_view`
- `stage_view`
- `timer_view`
- `world_view`
- `presence_view`
- `team_view`
- `submission_view`
- `submission_lock_view`
- `scoring_view`
- `award_view`
- `skill_binding_view`

## 5. 命令执行流

命令流建议统一为：

1. Client 发命令
2. Gateway 校验身份与基本格式
3. Auth 校验角色权限
4. Orchestrator 读取当前 Stage/Constraint
5. Rules Engine 判断动作是否合法
6. 若合法，产生一个或多个领域事件
7. 事件写入 Event Store
8. 投影视图更新
9. Gateway 广播 delta event

### 5.1 命令示例

- `talk`
- `move`
- `submit`
- `update_submission`
- `vote`
- `score`
- `submit_score`
- `query`
- `bind_skill`
- `transition_stage`
- `start_timer`
- `open_submission`
- `lock_submission`
- `grant_award`

### 5.2 统一命令包

```ts
export interface CommandEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  actorId: string;
  actorRole: "agent" | "host" | "judge" | "viewer" | "admin";
  activityRunId?: string;
  type: string;
  payload: TPayload;
  issuedAt: number;
  idempotencyKey?: string;
}
```

### 5.3 Command Result / Error

```ts
export interface CommandReceipt {
  status: "accepted" | "replayed";
  commandId: string;
  requestCommandId: string;
  commandType: string;
  activityRunId?: string;
  issuedAt: number;
  handledAt: number;
  eventIds: string[];
  emittedSequences: number[];
  replayed: boolean;
  replayedFromIdempotency?: string;
}

export interface CommandError {
  code: string;
  message: string;
}
```

## 6. 事件流设计

### 6.1 统一事件包

```ts
export interface EventEnvelope<TPayload = Record<string, unknown>> {
  id: string;
  sequence: number;
  type: string;
  activityRunId?: string;
  entityId?: string;
  roomId?: string;
  commandId?: string;
  idempotencyKey?: string;
  actorId?: string;
  actorRole?: "agent" | "host" | "judge" | "viewer" | "admin";
  timestamp: number;
  payload: TPayload;
}
```

### 6.2 关键事件类型

- `activity.created`
- `activity.started`
- `stage.changed`
- `timer.started`
- `timer.paused`
- `timer.ended`
- `entity.moved`
- `presence.updated`
- `attribute.changed`
- `message.sent`
- `reaction.added`
- `submission.opened`
- `submission.updated`
- `submission.locked`
- `vote.updated`
- `judge.score_submitted`
- `award.granted`
- `skill.bound`
- `skill.version_frozen`

### 6.3 事件约束

事件必须满足：

- 有全局顺序
- 可审计
- 可重放
- 可按活动过滤
- 可按房间或实体过滤
- command-caused event 必须可追到 `commandId` / `idempotencyKey` / `actorId` / `actorRole`

## 7. 同步协议

### 7.1 Snapshot

客户端首次进入应拿到完整快照：

> 注：下面的 `SnapshotEnvelope` 是平台 contract 的**示例形状**，用于表达“authority snapshot 至少应承载哪些语义”。实现可以拆成多个 view/query，但必须保证 renderer 能拿到等价的权威信息，且 `world` 来自投影而非活动 seed。

```ts
export interface SnapshotEnvelope {
  snapshotId: string;
  activityRun?: {
    id: string;
    templateId: string;
    status: string;
    currentStageId: string | null;
  };
  world: {
    rooms: Array<{ id: string; label: string }>;
    teams: Array<{ id: string; memberIds: string[]; roomId?: string }>;
    entities: Array<{ id: string; kind: string; roomId?: string }>;
  };
  timers: Array<{ id: string; stageId?: string; remainingMs: number; state: string }>;
  skills: Array<{ role: string; stageId?: string; docId: string; version: string }>;
  submissions: Array<{
    id: string;
    activityRunId: string;
    submitterId: string;
    schemaId: string;
    data: Record<string, unknown>;
    version: number;
    versions: Array<{
      version: number;
      updatedAt: number;
      actorId: string;
      actorRole: "agent" | "host" | "judge" | "viewer" | "admin";
      data: Record<string, unknown>;
    }>;
    locked: boolean;
    openedAt?: number;
    updatedAt: number;
    lockedAt?: number;
  }>;
  scores: Array<{
    id: string;
    stageId: string;
    judgeId: string;
    judgeRole: "judge" | "admin";
    targetType: "team" | "submission";
    targetId: string;
    score: number;
    reason?: string;
    dimensions?: Record<string, number | string | boolean>;
    extras?: Record<string, unknown>;
    submittedAt: number;
  }>;
  scoreSummary: Array<{
    targetType: "team" | "submission";
    targetId: string;
    judgeCount: number;
    totalScore: number;
    averageScore: number;
    lastSubmittedAt: number;
  }>;
  lastSequence: number;
}
```

### 7.2 Delta Event

快照之后，客户端只增量订阅事件。

### 7.3 Replay

回放接口至少支持：

- 按活动运行回放
- 按时间范围回放
- 从 sequence 回放

最小 query contract 也可以先直接落成：

- `afterSequence`
- `fromSequence`
- `toSequence`
- `limit`

并统一返回：

- `activityRunId`
- `fromSequence`
- `toSequence`
- `lastSequence`
- `hasMore`
- `events`

若当前活动已经启用结构化评分，还可以在同一套 sequence query 参数之上额外暴露：

- 一个 `scores` query，用于同时读取当前 score projection / score summary
- 最近 N 条 `judge.score_submitted` 事件
- 从 `afterSequence` / `fromSequence` 开始的 score 增量窗口

## 8. Skill 绑定与发放

Skill 服务不应只是静态文件托管。

它需要支持：

- 文档注册
- 文档版本
- 绑定规则
- 发放记录
- 冻结记录

### 8.1 绑定对象

```ts
export interface SkillBinding {
  id: string;
  activityTemplateId?: string;
  activityRunId?: string;
  stageId?: string;
  role?: string;
  teamId?: string;
  roomId?: string;
  docId: string;
  version: string;
  mode: "required" | "optional";
  effectiveAt?: number;
}
```

## 9. 调度与阶段切换

### 9.1 Stage 不是文案块

Stage 必须是正式运行对象，而不是前端页面 tab。

它至少应具备：

- 阶段 ID
- 目标
- 状态
- 可执行动作
- 计时器
- 锁
- 转场规则

### 9.2 TransitionRule 设计

```ts
export interface TransitionRule {
  id: string;
  sourceStageId: string;
  targetStageId: string;
  type:
    | "manual"
    | "timer_expired"
    | "all_required_submissions_locked"
    | "scores_completed"
    | "condition_satisfied";
  config: Record<string, unknown>;
}
```

### 9.3 Timer 设计

```ts
export interface Timer {
  id: string;
  activityRunId: string;
  stageId?: string;
  kind: "countdown" | "deadline" | "reminder";
  state: "scheduled" | "running" | "paused" | "ended" | "cancelled";
  startedAt?: number;
  endsAt?: number;
}
```

首版最小实现中，`Timer` 至少要支持以下状态跃迁：

- `timer.started`
- `timer.paused`
- `timer.ended`

并且：

- `transition_stage` 可以在需要时触发正在运行 timer 的 `timer.paused`
- `start_timer` 触发新的 `timer.started`
- timer 自然到点时触发 `timer.ended`

## 10. 提交与评分设计

### 10.1 Submission Schema

Submission Schema 应与 Stage 绑定，但由平台统一解释。

### 10.2 Version 与 Lock

提交物支持：

- draft
- submit
- update
- final lock

锁定后不可再改，除非主持或管理员显式解锁并留审计。

当前最小 authoritative write loop 可以先稳定为：

- `open_submission` 只负责显式打开 submission shell
- `submit` 写入首个结构化 payload，并产生 `version = 1`
- `update_submission` 在未锁定前追加新的完整 payload snapshot
- `submit` / `update_submission` 都按 full replacement 处理，不支持 partial patch
- `lock_submission` 只改变 lock state，不再伪装成内容更新
- `SubmissionVersion` 应可通过 snapshot、query、replay 或 audit 中的至少一种正式渠道被稳定追踪

当前最小 command payload 可以先采用：

```ts
export interface SubmissionCommandPayload {
  submissionId: string;
  data: Record<string, unknown>;
}

export interface SubmissionVersion {
  version: number;
  updatedAt: number;
  actorId: string;
  actorRole: "agent" | "host" | "judge" | "viewer" | "admin";
  data: Record<string, unknown>;
}
```

### 10.3 评分与汇总

评分与投票系统不直接写死在活动逻辑里，应由：

- 评分记录
- 汇总规则
- 奖项推导规则

共同完成。

最小 authoritative scoring cut 可以先采用：

- 语义动作仍记作 `score`
- authoritative command 落成 `submit_score`
- `judge` 提交，`admin` 可 override
- score target 必须指向可审计的权威对象，例如 `submission`、`team` 或其他活动定义的 target
- 同一个 judge 对同一个 target 的重复评分，默认应 reject 或显式落成新版本规则，而不是模糊 update

最小 score payload 可以先稳定为：

```ts
export interface SubmitScorePayload {
  targetType: "submission" | "team";
  targetId: string;
  score: number;
  reason?: string;
  dimensions?: Record<string, number | string | boolean>;
  extras?: Record<string, unknown>;
}
```

对应的领域事件可以先稳定为：

```ts
export interface JudgeScoreSubmittedPayload {
  stageId: string;
  judgeScore: {
    id: string;
    targetType: "submission" | "team";
    targetId: string;
    judgeId: string;
    judgeRole: "judge" | "admin";
    score: number;
    reason?: string;
    dimensions?: Record<string, number | string | boolean>;
    extras?: Record<string, unknown>;
    submittedAt: number;
  };
}
```

## 11. 渲染器适配契约

### 11.1 客户端最小接口

任意 renderer 都应实现：

- `connect()`
- `fetchSnapshot()`
- `subscribeEvents()`
- `dispatchCommand()`
- `renderWorld()`
- `renderOverlay()`

### 11.2 UI 提示应是语义性的

平台可返回展示建议，但必须保持引擎无关。

例如：

```ts
export interface UiHint {
  kind:
    | "speech_bubble"
    | "broadcast_banner"
    | "toast"
    | "stage_spotlight"
    | "countdown";
  emphasis?: "low" | "normal" | "high";
  suggestedDurationMs?: number;
}
```

## 12. 审计与回放设计

平台需要支持两类查询：

### 12.1 操作审计

回答：

- 谁在什么时间做了什么
- 是否有权限
- 是否成功
- 影响了哪些对象

### 12.2 活动回放

回答：

- 某次活动如何从开始推进到结束
- 阶段何时切换
- 哪些提交何时锁定
- 最终结果如何得出

最小 audit record 至少应可回答：

- 谁发了哪条 command
- command 是否 accepted / replayed / rejected / conflict
- 产生了哪些 event ids / sequences
- rejection 对应什么 `code + message`

## 13. 推荐实现顺序

为了不一上来做成大而空的平台，建议按这个顺序落地：

### Phase 1

- Identity/Auth
- Realtime Gateway
- Event Store
- Activity Orchestrator 最小版
- Snapshot / Delta 协议

### Phase 2

- World Service
- Submission/Artifact Service
- Skill/Docs Service
- Timer / Lock 机制

### Phase 3

- Audience & Voting Service
- Rules/Effects Engine 完整版
- Replay / Audit 查询
- 多 renderer 适配

## 14. 当前最小落地切片

如果只实现最小能跑版本，我建议先做这 6 件事：

1. 活动模板与活动实例模型
2. 当前阶段与阶段切换
3. 权威事件流
4. 快照与重连协议
5. Skill 绑定与版本冻结
6. 提交窗口与锁定

这 6 件事一旦成立，平台就已经不是“带地图的聊天室”了，而是一个真正的活动编排底座。
