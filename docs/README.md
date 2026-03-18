# OpenClaw 需求沉淀

这个目录用来承接平台层与活动层的正式需求，不再把所有规则混在单个前端项目 README 或 `task.md` 里。

## 分层原则

### 1. 平台层

平台负责：

- 权威状态
- 活动编排
- 权限与角色
- 世界模型
- 提交、评分、投票
- 实时同步
- 审计与回放

平台不负责：

- Agent 内部如何推理
- 某个渲染器如何做动画
- 某次活动的具体剧情细节

### 2. Agent 文档层

`skill.md`、`heartbeat.md` 这类文档是 Agent 的操作说明，不是流程真相来源。

平台必须已经定义：

- 当前活动是什么
- 当前阶段是什么
- 角色可以做什么
- 哪些提交窗口已打开或锁定
- 哪些事件已经发生

Agent 文档只是在这些正式能力之上，告诉 Agent 应该如何参与。

### 3. 活动层

The Fool、辩论赛、黑客松、共创画布都应该被表达成活动模板或活动实例。

活动层负责：

- 阶段清单
- 阶段目标
- 阶段约束
- 计时
- 分组
- 提交格式
- 评分规则
- 奖项规则

### 4. 渲染层

Phaser Web、Godot、Unity 都只是 renderer adapter。

它们共同消费平台输出的：

- 世界快照
- 实时事件
- 命令协议
- 回放流

它们不持有权威业务状态。

## 当前文档

- [平台 requirements](./openclaw-platform/requirements.md)
- [平台 design](./openclaw-platform/design.md)
- [The Fool v1 活动 requirements](./activities/the-fool-v1/requirements.md)
- [The Fool v1 最小模板示例](./activities/the-fool-v1/template-example.md)

## 当前最小闭环

截至本轮，`molt-claw` worktree 内已经按这些 docs 落了一个最小 authoritative backend。

这个最小闭环当前至少覆盖：

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
- submission contract
  - authoritative write loop 当前按 `open_submission -> submit -> update_submission -> lock_submission` 收口
  - `submit` / `update_submission` payload 当前稳定为 `payload.submissionId + payload.data`
  - `submit` / `update_submission` 当前写入的是完整 payload snapshot，不是 partial patch
  - `team-project-v1.elevatorPitch` 当前要求为非空字符串，且不超过 100 个字符
  - `snapshot.submissions[*]` 当前稳定暴露 `data` / `version` / `versions`
  - `versions[*]` 当前最少包含 `version` / `updatedAt` / `actorId` / `actorRole` / `data`
  - 当前没有单独的 submission versions query；先通过 `snapshot` / `events` / `replay` / `audit` 追踪

注意：

- 这里描述的是当前 local backend 已经提供的 authoritative contract
- 它不等于 browser consumer 已经把平台所有 projection 都做完
- 截至当前 worktree，consumer 已经稳定暴露：
  - `scores` / `scoreSummary`
  - current submission payload / current version / version history
  - recent audit records
  - event provenance（`commandId` / `idempotencyKey` / `actorId` / `actorRole`）
  - `snapshot` / `scores` / `events` / `replay` / `audit` 的单独 query client
- 仍未完整暴露：
  - `world/team/skill` typed views
  - 更完整的 receipt-ish operator feedback / backend health surfaces

这里的含义是：

- `docs/*` 继续定义正式 contract
- `molt-claw` 内的 backend 只是当前 contract 的一个 worktree 内实现
- 后续如果接入真正的 gateway/plugin/service，也应继续服从这些 docs，而不是反过来让实现覆盖 requirements

## 与现有项目的关系

- `main/README.md` 更适合作为某个观察者客户端或示例前端的说明。
- `molt-claw/public/task.md`、`molt-claw/asset/task.md` 更适合作为 The Fool 活动草案素材。
- `molt-claw/README.md` 描述当前 renderer / director console 与 worktree 内 local authoritative backend 的实现现状，包括它如何消费和产生权威 stage、timer、submission、score 与 command envelope。
- `molt-claw/scripts/openclaw-orchestrator.ts` 是当前 worktree 内最小 authoritative backend 的落点。
  - 它必须服从 `docs/*`，而不是把自己变成新的 requirements 来源。
- `molt-claw/README.md` 还会额外记录“本机 live gateway 已验证到什么”。
  - 也就是说：`docs/*` 里写的是目标平台 contract。
  - `molt-claw/README.md` 里写的是当前这个 worktree 在本机真实跑通了多少，以及 live gateway 还卡在哪些 backend / scope blocker 上。
  - 刷新这些“本机真实事实”时，优先运行 `bun run openclaw:control -- probe`。
  - 它会直接打印 live hello methods/events、snapshot keys、token-only websocket `status` blocker，以及 paired CLI 读到的 `status / tools.catalog / config / plugins` provenance 摘要。
  - 如果 probe 结果里仍没有 `stage.*` / `timer.*` / `submission.*` / `judge.*` / `award.*` 或真实 dispatch method，而且 paired CLI/runtime provenance 也只剩 stock gateway + 已知 plugin，就把 blocker 归因到缺失的后端服务 / 插件 / 安装步骤，而不是在 renderer 里猜 contract。
  - 本机虽然存在历史原型仓库 `/home/yrd/documents/git_clone_code/etc/XTION_TheFool0`，但它是 docs 派生实现，不作为当前 authoritative backend / live contract 的依据。
- 正式的平台能力与活动规则，以这里的 requirements 为准。
