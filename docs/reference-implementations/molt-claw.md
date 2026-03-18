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

当前代码结构上的平台 / 活动边界也已经开始落地：

- `src/openclaw/platform/contracts.ts` 收口平台通用 contract
- `src/openclaw/platform/activityRegistry.ts` 提供活动包注册与加载边界
- `src/openclaw/activities/theFoolV1.ts` 承载 The Fool v1 的 stage/schema/world/score config
- `src/openclaw/activities/theFoolV1.ts` 现在也承载 The Fool v1 的前端 stage copy、runtime guide、room aliases、UI summary 等 activity metadata
- `src/data.ts` 不再维护 The Fool 静态 stage 数组，而是从 activity package 装配 activity-driven view model
- `scripts/openclaw-orchestrator.ts` 不再直接把 The Fool 的十幕、schema 和 world seed 写死在主文件里，而是从 activity package 装配
- `src/openclaw/control.ts` 的 room alias / room catalog 已改成从 activity package 的 world + metadata 派生；`scripts/openclaw-control.ts` 仍保留 The Fool CLI 兼容输入

当前 The Fool v1 在这个 worktree 里的 submission write loop 已收口为：

- `open_submission -> submit -> update_submission -> lock_submission`
- `submit` / `update_submission` payload 当前稳定为 `payload.submissionId + payload.data`
- `submit` / `update_submission` 当前写入的是完整 payload snapshot，不是 partial patch
- `snapshot.submissions[*]` 当前稳定暴露 `data` / `version` / `versions`
- `versions[*]` 当前最少包含 `version` / `updatedAt` / `actorId` / `actorRole` / `data`
- 当前没有单独的 submission versions query；先通过 `snapshot` / `events` / `replay` / `audit` 追踪

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
- 当前还没有实现 `scores_completed` 自动切阶段；Act VII -> Act VIII 仍由主持手动收口
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
  - `--favorite`
  - `--most-absurd`
  - `--weirdest`
  - `--absurd`
  但它们会先映射到通用 `annotations` 再进入平台 command

### 4.3 Act VIII Award Grant

- `grant_award` 产生 `award.granted`
- awards projection 必须真实更新，而不是只停留在静态模板
- 同一个 `awardId` 重复 grant 当前直接 reject

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
- score annotations 的 typed summary；renderer 侧兼容读取旧 `favorite` / `mostAbsurd` 字段，但 shared state 内部优先使用通用 `annotations`
- `/show`、`/show/:stageId`、`/control/stages/:stageId` 当前都已经改成按 authority stage + activity metadata 解析 active stage，不再以内建 The Fool stages 作为唯一来源
- `src/presentation.ts` 的 stage desk / submission / score narrative 已改成消费 stage capabilities + activity metadata，不再依赖 `stageId.includes("submission" | "judging" | "award")`

`/show` 侧当前已经在同一层 shared state 之上补出 show-specific composition，而不是继续直接复用 control-first 分组：

- current stage 下的 team / room spotlight
- world/team/member 的 audience-facing room narrative
- submission / score / platform cue 的节目侧编排
- skill / doc 的 backstage context 口吻
- state unavailable 时的 soft fallback

## 6. 当前 Known Gaps

当前仍未完整暴露或未完全闭环的点：

- 当前 local fixture 暴露出来的 team-room / entity placement mismatch 仍未被 backend 修正
- stage-specific skill bindings 仍未在 seed data 内提供
- `/show` 当前 room spotlight 仍会部分受 live session heat 影响；在 live session 很稀疏时，还没有完全收敛到更强的 act-level world cue
- `src/presentation.ts` 里仍保留部分 The Fool room naming heuristic（例如 `quiet-orbit`、`team-room-*` 的文案分支）；这一层还没有完全抽成 activity scene adapter
- browser / CLI 侧仍保留一轮 The Fool 兼容层：
  - `favorite` / `mostAbsurd` annotation key
  - `TeamProjectSubmissionData` / `normalizeTheFoolTeamProjectSubmissionData`
- orchestrator 当前虽然已经支持 activity package 注册与按 `templateId` 解析，但默认 bootstrap 仍直接从 The Fool v1 activity package 启动第一条本地 run

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
