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
    submissionId: string;
    teamId?: string;
    score: number;
    reason: string;
    favorite: string;
    mostAbsurd: string;
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

当前 worktree 内的最小 query contract 也可以先直接落成：

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

### 7.4 当前 molt-claw worktree 的最小实现轮廓

当前 `molt-claw` worktree 内的首版 backend，可以先采用“单进程 orchestrator + realtime gateway + query API”合并实现，只要语义边界不塌陷。

首版最小实现至少应做到：

- 通过同一份权威投影对外提供 snapshot 与 command result
- command result / error 统一返回稳定 contract
- 对外广播 `stage.changed` / `timer.*` / `submission.*` / `judge.score_submitted`
- 用事件日志重建当前 `ActivityRun` / timer / submission lock / score / award 投影
- 允许 renderer/client 只消费协议，不直接改写活动状态

在当前 worktree 内，首版查询/控制接口可以直接暴露为：

- 一个 websocket 入口，用于 `connect`、snapshot 与 delta event
- 一个 command endpoint，用于接收统一 `CommandEnvelope`
- 一个 snapshot endpoint，用于读取当前权威投影
- 一个 events/replay endpoint，用于读取最近事件与从 sequence 开始的增量
- 一个 scores endpoint，用于读取 score projection 与 score event 增量窗口
- 一个 audit endpoint，用于读取最小 command audit record

这只是当前 worktree 的实现轮廓，不意味着未来正式平台必须绑定这些具体路径或部署形态。

当前 worktree 的集成状态还应额外区分清楚：

- local orchestrator backend 已经提供 `snapshot` / `scores` / `events` / `replay` / `audit`
- browser consumer 目前仍主要依赖 websocket snapshot + delta event
- `scores` / `scoreSummary`、event provenance、`world/team/skill` typed views，以及单独 query client 仍属于后续 integration work
- 这些 integration gap 不改变上面的 authoritative contract

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
- 当前 worktree 没有独立 submission versions query；version trace 通过 `snapshot` / `submission.updated` replay / `audit` 读取

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

对 `team-project-v1`，当前最小实现额外约束为：

- `posterOrDeck`: non-empty string
- `elevatorPitch`: non-empty string, max 100 chars
- `highlights`: exactly 3 non-empty strings
- `risk`: non-empty string

### 10.3 评分与汇总

评分与投票系统不直接写死在活动逻辑里，应由：

- 评分记录
- 汇总规则
- 奖项推导规则

共同完成。

在当前 worktree 的最小 authoritative scoring cut 里，可以先采用：

- 语义动作仍记作 `score`
- authoritative command 落成 `submit_score`
- 当前仅对 `act-7-ai-judging` 开放
- `judge` 提交，`admin` 可 override
- 评分目标先绑定到 locked team-project submission
- 重复评分首版直接 reject，而不是 update

最小 score payload 可以先稳定为：

```ts
export interface SubmitScorePayload {
  submissionId: string;
  score: number; // 1..10
  reason: string;
  favorite: string;
  mostAbsurd: string;
}
```

对应的领域事件可以先稳定为：

```ts
export interface JudgeScoreSubmittedPayload {
  stageId: "act-7-ai-judging";
  judgeScore: {
    id: string;
    submissionId: string;
    teamId?: string;
    judgeId: string;
    judgeRole: "judge" | "admin";
    score: number;
    reason: string;
    favorite: string;
    mostAbsurd: string;
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

### 11.3 当前仓库中的映射

就当前仓库而言，可以粗略理解为：

- `main/` 更像观察者地图或前台 renderer 原型
- `molt-claw/` 更像导演台 / 节目控制 renderer 原型

但它们都不应成为平台真相源。

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
