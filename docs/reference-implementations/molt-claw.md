# molt-claw 当前实现现状

## 1. 文档定位

本文记录 `molt-claw` 这个 worktree 当前已经实现到哪里。

它不是 OpenClaw 平台的正式 requirements，也不是 The Fool v1 的规则真相来源。

它的用途是保留这些有价值但不应写回 contract 的信息：

- 当前 local authoritative backend 已经覆盖了哪些平台能力
- 当前 browser consumer 已经把哪些 authority projection 接进 `/show` 与 `/control`
- 当前 `/show` 到底已经做成了什么节目侧编排
- 当前还有哪些已知 gap

正式 contract 仍以以下文档为准：

- `docs/openclaw-platform/requirements.md`
- `docs/openclaw-platform/design.md`
- `docs/activities/the-fool-v1/requirements.md`
- `docs/activities/the-fool-v1/scene-spec.md`

## 2. 当前最小闭环

截至当前 `molt-claw` worktree，本地最小 authoritative backend 至少已经覆盖：

- `ActivityRun`
- current stage
- timer state
- submission lifecycle
- score state / score summary
- award state
- command receipt / error / idempotency 语义
- replay / audit 最小 query contract
- `transition_stage`
- `start_timer`
- `open_submission`
- `submit`
- `update_submission`
- `lock_submission`
- `submit_score`
- `grant_award`
- `draw`
- `move_entity`
- `assign_team`
- `activityRun` snapshot
- `GET /api/orchestrator/scores`
- `GET /api/orchestrator/events`
- `GET /api/orchestrator/replay`
- `GET /api/orchestrator/audit`
- `submission.opened`
- `stage.changed`
- `timer.started`
- `timer.paused`
- `timer.ended`
- `submission.updated`
- `submission.locked`
- `judge.score_submitted`
- `award.granted`
- `draw.submitted`
- `entity.moved`
- `team.assigned`

## 3. Local Backend Support Matrix

当前 local backend support matrix 可以先理解成：

- command
  - `transition_stage`
  - `start_timer`
  - `open_submission`
  - `submit`
  - `update_submission`
  - `lock_submission`
  - `submit_score`
  - `grant_award`
  - `draw`
  - `move_entity`
  - `assign_team`
- query
  - current snapshot
  - current submission payload / version history
  - current score projection / score summary
  - recent events
  - recent score events
  - `afterSequence` / `fromSequence` / `toSequence` + `limit`
  - replay from sequence
  - recent audit records
- receipt / error
  - `receipt.status`
  - `replayed`
  - `replayedFromIdempotency`
  - `eventIds`
  - stable `code + message`

这些能力虽然已经进入最小 support matrix，但当前仍停留在“最小可用版”，也需要明确写出来，避免把活动 contract 误读成“已经完整实现”：

- `TransitionRule` evaluator 已覆盖 `timer_expired` / `all_required_submissions_locked` / `scores_completed`，但更通用的 `condition_satisfied` / richer declarative predicates 还没有 runtime 化
- Act III 已提供最小 `team.assigned` / `entity.moved` command 闭环，但还缺少更高层的分队约束校验、批量分配工具和主持工作流
- Act IX 已提供 `draw` authoritative command / event / replay 最小闭环，但还没有持续的 canvas projection / palette rule / 共创结果聚合
- Act IX 的个人诗歌路径现在支持“首个 `submit` 自动开 shell”，`open_submission` 已降级为可选路径而不是硬前置

当前代码结构上的平台 / 活动边界也已经开始落地：

- `src/openclaw/platform/contracts.ts` 收口平台通用 contract
- `src/openclaw/platform/activityRegistry.ts` 提供活动包注册与加载边界
- `src/openclaw/activities/index.ts` 现在作为显式 activity registration/bootstrap 入口，避免 browser 侧再依赖隐式 side effect
- `src/openclaw/activities/theFoolV1.ts` 承载 The Fool v1 的 stage/schema/world seed/score config
- `src/openclaw/activities/theFoolV1.ts` 现在也承载 The Fool v1 的前端 stage copy、runtime guide、room aliases、room scene roles、UI summary，以及 stage-specific skill/doc bindings 等 activity metadata
- `src/data.ts` 不再维护 The Fool 静态 stage 数组，而是从 activity package 装配 activity-driven view model；当 authority/template 还没解出来时，前端会退回通用 pending shell，也不再在 pending copy 里默认借用 The Fool 口吻
- `scripts/openclaw-orchestrator.ts` 不再直接把 The Fool 的十幕、schema 和 world seed 写死在主文件里，而是从 activity package 装配；bootstrap 语义也已改成支持 `OPENCLAW_REFERENCE_ACTIVITY_TEMPLATE_ID` 的显式 reference activity，但 `snapshot.world` / `skills` 仍有直接读取活动包的路径，尚未完全做到 projection-only
- `src/presentation.ts` 的 room narrative / live copy 已改成消费 activity metadata 里的 room scene roles，不再硬编码 `main-stage` / `team-room-*` / `quiet-orbit`
- `src/openclaw/useGatewayOverview.ts` 与 `src/openclaw/overviewSharedState.ts` 在拿不到 `templateId` 时，已优先退回 authority world label / raw room id，而不是默认套用 The Fool room catalog
- `src/openclaw/useGatewayOverview.ts` 与 `scripts/openclaw-orchestrator.ts` 读取 score annotations 时，旧 `favorite` / `mostAbsurd` 顶层字段兼容已下沉到 activity package 的 `scoreConfig.extractLegacyAnnotations`
- `src/openclaw/control.ts` 的 room alias / room catalog 现在既能从 activity package 派生，也能从 authority `snapshot.world` 派生；`scripts/openclaw-control.ts` 的 `move` / `say` 在严格路径下会优先读取 authority snapshot 做 activity-scoped room resolution，但显式 `--activity-package-id` 仍保留 package fallback，默认隐式 fallback 还没有完全拔干净
- `src/openclaw/control.ts` 的 `submit` / `update_submission` / `submit_score` envelope builder 已收口成平台通用 payload，`scripts/openclaw-control.ts` 则改成通用 payload / annotations 输入 + The Fool 兼容别名

当前 The Fool v1 在这个 worktree 里的 submission write loop 已收口为：

- Act V 团队项目路径：`open_submission -> submit -> update_submission -> lock_submission`
- `submit` / `update_submission` payload 当前稳定为 `payload.submissionId + payload.data`
- `submit` / `update_submission` 当前写入的是完整 payload snapshot，不是 partial patch
- `snapshot.submissions[*]` 当前稳定暴露 `data` / `version` / `versions`
- `versions[*]` 当前最少包含 `version` / `updatedAt` / `actorId` / `actorRole` / `data`
- 当前没有单独的 submission versions query；先通过 `snapshot` / `events` / `replay` / `audit` 追踪
- Act IX 个人诗歌路径：首个 `submit` 在缺 shell 时会自动补出 `submission.opened`

## 4. The Fool v1 实现细节

下面这些内容属于 The Fool v1 在当前 `molt-claw` worktree 里的具体实现语义，不应反向写回平台 contract。

### 4.1 Act V Submission Loop

- submission 不再通过初始 projection 预置 unlocked entries
- `host` / `admin` 通过 `open_submission` 显式打开窗口
- `submit` 写入首个 team-project 结构化 payload
- `update_submission` 在已 opened 且未 locked 时追加完整 payload 新版本
- `submit` / `update_submission` 都按完整 payload replacement 处理，不支持 partial patch
- `team-project-v1` 当前 payload 固定为：
  - `posterOrDeck: string`
  - `elevatorPitch: string <= 100 chars`
  - `highlights: [string, string, string]`
  - `risk: string`
- `lock_submission` 只能锁定已 `opened` 的 submission
- 同一个 submission 若已 locked，再次 `lock_submission` 应被 reject
- locked 后再次 `update_submission` 应被 reject
- `all_required_submissions_locked` 已接入 runtime，但只会在所有必需队伍的 submission 都存在且 locked 时自动切到 Act VI；主持锁定空壳 submission 也计入“已收口”

### 4.2 Act VII AI Judging

- authoritative command 为 `submit_score`
- 成功后产生 `judge.score_submitted`
- 只允许 `judge` 发起，`admin` 可作为 override
- 平台 score projection 当前已改成通用 `annotations: Record<string, string>`；`favorite` / `mostAbsurd` 不再作为平台通用 score 字段
- The Fool v1 继续通过 activity package 要求 `favorite` / `mostAbsurd` 两个 annotation，并限制默认只允许在 `act-7-ai-judging` 阶段提交
- score target 当前绑定到 locked team-project submission，且该 submission 必须有真实结构化 payload，不能只是 opened/locked 空壳
- 同一个 judge 对同一个 submission，或解析到同一个 team 的重复评分，当前直接 reject
- snapshot 至少能稳定读到：
  - 当前 `scores`
  - 当前 `scoreSummary`
  - `snapshot.health.ts`
  - `snapshot.health.agents`
- local query 至少支持：
  - `GET /api/orchestrator/scores`
  - 最近 N 条 score 事件
  - 从某个 sequence 之后读取 score 事件
- `scores_completed` 已接入 runtime；只有每个可评分的 locked team-project submission 都拿到 `expectedJudgeCount` 份唯一 judge 评分时，Act VII 才会自动切到 Act VIII
- score command 的 receipt / audit / replay 继续复用统一 contract：
  - `receipt.status`
  - `replayed`
  - `replayedFromIdempotency`
  - `commandId`
  - `commandType`
  - `activityRunId`
  - `issuedAt`
  - `handledAt`
  - `eventIds`
  - `emittedSequences`
- CLI 兼容层当前仍接受：
  - `--annotations-json`
  - `--favorite`
  - `--most-absurd`
  - `--weirdest`
  - `--absurd`
  其中 The Fool 专属 flags 会先映射到通用 `annotations` 再进入平台 command

### 4.3 Act VIII Award Grant

- `grant_award` 产生 `award.granted`
- awards projection 必须真实更新，而不是只停留在静态模板
- 同一个 `awardId` 重复 grant 当前直接 reject

### 4.4 调度与自动切幕

- authoritative stage 当前仍主要由 `transition_stage` 驱动，但 runtime 已落成最小 `TransitionRule` evaluator
- `start_timer` 会产生 `timer.started`
- running timer 在切幕时会先产生 `timer.paused`
- timer 自然到点时会产生 `timer.ended`
- `timer_expired` / `all_required_submissions_locked` / `scores_completed` 现在都会真实推进到下一幕
- 当前还没有更通用的 `condition_satisfied` evaluator，也还没有跨活动共享的 richer declarative transition predicates

### 4.5 Act IX Co-Creation

- `personal-poem-v1` schema 已注册，payload 归一化也已接入 activity package
- Act IX 的首个 `submit` 在缺 shell 时会自动补出 `submission.opened`
- Act IX stage template 当前也保留可选的 `open_submission` 路径，便于主持/导演台显式开窗
- `draw` authoritative command / event / replay 已接入，成功后产生 `draw.submitted`
- `draw` 只有当前 stage 的 `allowedActions` 包含 `draw` 时才会被 authoritative runtime 接受
- 文档里“情绪影响调色盘范围”“持续画布状态 / 聚合结果”“更高层的共创结果模型”目前仍属于活动目标，不是已完成能力

## 5. Browser Consumer 与 `/show`

这里描述的是当前 `molt-claw` browser consumer 已经暴露到界面的能力，不等于平台总 contract。

截至当前 worktree，consumer 已经稳定暴露：

- `scores` / `scoreSummary`
- current submission payload / current version / version history
- authoritative room / team mapping
- `team -> room -> member` 最小结构
- current/global skill bindings 与 doc versions
- recent audit records
- authoritative query `status` / `source` / `freshness` / `availability`
- recent receipt-ish status summary（`accepted` / `replayed` / `rejected` / `conflict`）
- recent backend health evidence（来自 `snapshot.health`、audit 与 query checks）
- event provenance（`commandId` / `idempotencyKey` / `actorId` / `actorRole`）
- `snapshot` / `scores` / `events` / `replay` / `audit` 的单独 query client
- score annotations 的 typed summary；renderer 侧对旧 `favorite` / `mostAbsurd` 字段的兼容也已收口到 activity package 抽取器，shared state 内部优先使用通用 `annotations`
- `/show`、`/show/:stageId`、`/control/stages/:stageId` 当前都已经改成按 authority stage + activity metadata 解析 active stage，不再以内建 The Fool stages 作为唯一来源
- `src/presentation.ts` 的 stage desk / submission / score narrative 已改成消费 stage capabilities + activity metadata，不再依赖 `stageId.includes("submission" | "judging" | "award")`
- `src/presentation.ts` 的 room stage-fit / heat / activity headline 已改成消费 activity metadata 的 room scene roles，不再在 shared presentation 层解析 The Fool room id 命名
- authority/template 还不可用时，browser app shell 会显示通用 pending activity shell，不再默认退回首个 reference activity package；shared header / show fallback copy 也开始去掉固定 `Molt Claw` / `龙虾` / `contestant` 前台默认文案
- `/control/stages/:stageId` 当前已经支持 preview 某一幕的 workspace，但非当前幕时仍未把命令区显式降级成“准备态 / 需确认”；右侧命令提示仍可能按 preview stage 生成下一幕建议

`/show` 侧当前已经在同一层 shared state 之上补出 show-specific composition，而不是继续直接复用 control-first 分组：

- current stage 下的 team / room spotlight
- world/team/member 的 audience-facing room narrative
- submission / score / platform cue 的节目侧编排
- skill / doc 的 backstage context 口吻
- state unavailable 时的 soft fallback

## 6. 当前 Known Gaps

这一节把“已知差距”改写成可验收清单：每条 gap 都对应一条明确的 contract/约束，并给出完成标准。

| Gap | 违反/触及的 contract 约束（回链） | 完成标准（验收口径） |
| --- | --- | --- |
| local fixture 的 team-room / entity placement mismatch 未修正 | 平台：世界模型的权威状态应来自投影（[../../openclaw-platform/design.md](../openclaw-platform/design.md) 的 `world_view` 约束） | backend 修正 fixture/projection：snapshot 中的 entity/team roomId 一致、可被 replay 重建；renderer 不需要“补救性推断” |
| Act III 只有最小分队 command 闭环，仍缺少更高层约束与主持工作流 | 活动：平台必须记录正式队伍分配结果（[../../activities/the-fool-v1/requirements.md](../activities/the-fool-v1/requirements.md) 的 Act III 要求）与平台：模板不应在运行时重新充当 `ActivityRun` 真相（[../../openclaw-platform/requirements.md](../openclaw-platform/requirements.md) 的模板约束） | `team.assigned` / `entity.moved` 已能由运行时事件驱动；下一步是补齐批量分配、约束校验、冲突提示与更完整导演台工作流 |
| authority world 与 activity bootstrap seed 未完全分开 | 平台：authority world vs bootstrap seed 边界（[../../openclaw-platform/requirements.md](../openclaw-platform/requirements.md) 的 “Authority World 与 Bootstrap Seed”）与 snapshot world 来自投影（[../../openclaw-platform/design.md](../openclaw-platform/design.md) 的 world_view 约束） | orchestrator/snapshot 构建不再读取活动包静态 world 充当运行时真相；活动 seed 只参与 bootstrap；运行时 world 只能来自 projection |
| shared runtime 仍可能默认 fallback 到“首个已注册活动包” | 平台：Orchestrator 无隐式默认活动（[../../openclaw-platform/design.md](../openclaw-platform/design.md) 的 “运行时真相约束”） | 当拿不到 `templateId`/activity package 时，明确返回 unavailable/pending，并在 `/control` 暴露诊断；不得静默 fallback |
| `TransitionRule` 目前只覆盖固定几类规则，`condition_satisfied` 等更通用 predicate 仍未 runtime 化 | 平台：阶段切换至少应支持 timer / 提交完成 / 评分完成等自动规则（[../../openclaw-platform/requirements.md](../openclaw-platform/requirements.md) 的 TransitionRule 要求）与平台设计：还预留了更通用的条件型规则（[../../openclaw-platform/design.md](../openclaw-platform/design.md) 的 TransitionRule 设计） | 在现有 `timer_expired` / `all_required_submissions_locked` / `scores_completed` 之外，再支持可配置的 `condition_satisfied` / richer predicates，并提供稳定诊断口径 |
| `/show` room spotlight 仍会受 live heat 影响，可能带偏 stage-first | Scene：heat 只能做 tie-breaker，scene 选择只依赖 authority stage（[../../activities/the-fool-v1/scene-spec.md](../activities/the-fool-v1/scene-spec.md) 的 “Stage-first” 与实现 checklist） | `/show` 的 scene 选择只看 `currentStageId`；spotlight 只在当前幕候选集内使用 heat 作为 tie-breaker；不得用 heat 覆盖当前幕 |
| `/control/stages/:stageId` 的 preview 仍未完全做成“安全预演态” | Scene：非当前 stage 的 control workspace 应进入准备态 / 需确认（[../../activities/the-fool-v1/scene-spec.md](../activities/the-fool-v1/scene-spec.md) 的路由职责与 checklist） | 当 `stageId !== currentStageId` 时，命令区显式标记 preview/需确认/禁用，避免按 preview stage 静默生成 live mutation 建议 |
| browser/CLI/orchestrator 仍保留旧 score 字段与 flags 的兼容层 | 活动：活动专属字段应映射到平台通用扩展容器（[../../activities/the-fool-v1/requirements.md](../activities/the-fool-v1/requirements.md) 的 “平台能力映射索引” + AI 评分映射说明）与平台：通用 scoring 扩展点口径（[../../openclaw-platform/requirements.md](../openclaw-platform/requirements.md) 的“平台如何被活动扩展”） | 兼容层完全收口到活动包/活动适配层；平台通用 contract 只认识通用 score 结构（如 annotations/extras 容器），不出现活动字段名 |
| Act IX 只有最小 poem/draw authoritative 闭环，仍缺少持续画布状态与更高层共创语义 | 活动：Act IX 允许 `submit` / `draw`，且画布行为需可记录与回放（[../../activities/the-fool-v1/requirements.md](../activities/the-fool-v1/requirements.md) 的 Act IX 要求） | 当前已具备 poem auto-open + `draw.submitted` 最小审计链；下一步需要补齐 canvas projection、回放聚合、palette 约束与更完整的 co-creation result model |
| reference activity bootstrap 仍作为默认路径存在 | 平台：无隐式默认活动（[../../openclaw-platform/design.md](../openclaw-platform/design.md) 的 “运行时真相约束”）与 bootstrap 只在启动阶段生效（[../../openclaw-platform/requirements.md](../openclaw-platform/requirements.md) 的 seed 边界） | reference activity 仅作为本地开发的显式 bootstrap 配置；运行时路径/renderer/shared helpers 不得依赖它来补齐缺失数据；缺失时应 pending/unavailable |

说明：其中部分“兼容/默认值”在参考实现早期是有意保留的开发便利，但一旦开始强调“平台通用化 + 活动可插拔”，就必须逐条拔掉隐式路径，让 authority/projection 成为唯一真相源。

### 6.1 现在算真正分开了吗

如果问题是“文档边界上有没有分开”，答案基本是：

- 是
- 平台 contract、活动规则、scene spec、参考实现现状已经分层落文档

如果问题是“当前 reference implementation 运行时有没有彻底分开”，答案还不是：

- 还没有完全
- The Fool 已经从很多平台通用类型和前台默认文案里退出来了
- 但 authority world、default activity fallback、reference activity bootstrap、CLI 兼容层这几块还没完全拔干净
- `TransitionRule` 已落地到固定规则级别，Act III / Act IX 也已有最小 authority 闭环；真正欠的主要是 richer rule system、richer team-assignment workflow、richer canvas semantics，以及 control preview 安全态

更准确地说，当前状态是：

- 平台与活动已经“结构性分层”
- 但还没有达到“运行时完全无隐式 The Fool 假设”

要说已经真正分开，至少还需要继续收掉：

- authority world 只从 projection 读取
- shared runtime 不再默认回落到某个活动包
- reference activity 只留在 bootstrap，不进入运行时默认路径
- The Fool 兼容 flags / legacy 字段继续收口到活动适配层
- `TransitionRule` 从固定规则迈向更通用的 `condition_satisfied` / declarative predicates
- Act III 从最小命令闭环继续补齐批量分队与约束校验
- Act IX 从最小 poem/draw audit 链继续补齐持续 canvas projection 与共创语义
- `/control/stages/:stageId` 在非当前幕时变成明确的安全预演态

### 6.2 离通用平台还有多少

如果问题是“离一个真正的通用 OpenClaw 平台还有多少”，当前参考实现可以先按下面这个口径估算：

- 如果只看“本地 authoritative backend + The Fool 能跑一场”，当前大约已经到 `75% ~ 80%`
- 如果看“活动可插拔、无隐式 The Fool 假设、规则真正由平台 runtime 执行”，当前更接近 `55% ~ 65%`
- 换句话说，离“真正的通用平台”大约还差 `35% ~ 45%` 的关键工作

这里的估算不是在算“总任务数完成率”，而是在算**平台化关键路径**还差多少。

当前最影响“能不能算通用平台”的，不是 The Fool 再多补几幕文案，而是下面这些平台化缺口：

- `TransitionRule` 已经进入 runtime，但还停留在固定规则集
  - 现在有 `transition_stage` / `start_timer`
  - `timer_expired` / `all_required_submissions_locked` / `scores_completed` 已会自动切幕
  - 但 `condition_satisfied` / richer predicates 还没有
- authority world 还没完全和 bootstrap seed 分开
  - Act III 的正式分队结果还不是命令驱动的 authority 结果
  - `world` 仍有 reference activity / bootstrap seed 的影子
- activity package 边界还没完全拔干净
  - 默认 reference activity
  - room alias fallback
  - The Fool 兼容 flags / legacy 字段
  这些路径还没全部收口
- “第二类活动能力”虽然已经有最小闭环，但还没形成真正通用能力
  - Act IX 的诗歌提交和 `draw` 已进入 authoritative command / event / replay 链
  - 但还缺持续 canvas projection / 聚合结果 / 约束规则，平台对 submission / score / award 之外的玩法承载还不够稳
- `/show` 与 `/control` 还差最后一层平台语义约束
  - `/show` 仍有 live heat 带偏 spotlight 的风险
  - `/control/stages/:stageId` 在非当前幕时还没完全变成安全预演态
- 自动化回归网几乎还没有
  - 当前 build / lint 可以过
  - 但还缺少保证“换活动也不坏”的测试基线

所以更准确的说法是：

- 平台骨架已经出来了
- The Fool 作为首个参考活动也已经能验证不少 contract
- 但距离“真正的通用平台”还差一轮专门的 platform-hardening

如果要把这段评估压成一个最短优先级列表，当前最值得先收掉的是：

1. `TransitionRule` 从固定规则继续走向通用 predicate
2. authority world 与 bootstrap seed 彻底分离
3. activity package / reference fallback / legacy compat 全面拔干净
4. Act IX 这类非 submission-only 流程从最小审计链走向真正的平台级 state model
5. 给平台通用路径补最小自动化回归

这里的含义是：

- `docs/*` 继续定义正式 contract
- `molt-claw` 内的 backend 只是当前 contract 的一个参考实现
- 后续如果接入真正的 gateway/plugin/service，也应继续服从这些 docs，而不是反过来让实现覆盖 requirements

## 7. 与现有项目的关系

- `main/README.md` 更适合作为某个观察者客户端或示例前端的说明
- `molt-claw/public/task.md`、`molt-claw/asset/task.md` 更适合作为 The Fool 活动草案素材
- `molt-claw/README.md` 描述当前 renderer / director console 与 worktree 内 local authoritative backend 的实现现状
- `molt-claw/scripts/openclaw-orchestrator.ts` 是当前 worktree 内最小 authoritative backend 的落点
  - 它必须服从 `docs/*`，而不是把自己变成新的 requirements 来源

如果要刷新这些“本机真实事实”，优先运行：

```bash
bun run openclaw:control -- probe
```

它会直接打印 live hello methods/events、snapshot keys、token-only websocket `status` blocker，以及 paired CLI 读到的 `status / tools.catalog / config / plugins` provenance 摘要。
