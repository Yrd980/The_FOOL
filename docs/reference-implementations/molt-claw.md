# molt-claw 当前实现现状

总入口请先回到：[docs/README.md](../README.md)

## 1. 文档定位

本文只记录这个 worktree 当前已经实现到哪里。

它不是平台正式 contract，也不是 The Fool v1 的规则真相来源。正式真相仍以这些文档为准：

- \`docs/openclaw-platform/requirements.md\`
- \`docs/openclaw-platform/design.md\`
- \`docs/activities/the-fool-v1/requirements.md\`
- \`docs/activities/the-fool-v1/scene-spec.md\`

## 2. 当前主线

\`molt-claw\` 现在是一个后端优先的本地实现，而不是双界面产品原型。

当前 worktree 的主线是：

- 本地 authoritative orchestrator backend
- 通用平台 contract / activity registry
- 显式 local bootstrap config
- 一个最小浏览器状态壳，用来证明 backend truth

已经移除的主线：

- 富内容 \`/show\`
- 富内容 \`/control\`
- 依赖 scene metadata 的前端 view-model / presentation 组合层

浏览器现在只保留只读壳层，不再承担活动脚本、机位编排、导演台命令组织或 activity-specific copy。

## 3. 当前最小闭环

截至当前 worktree，本地最小 authoritative backend 至少已经覆盖：

- \`ActivityRun\`
- current stage
- timer state
- submission lifecycle
- score projection / score summary
- award state
- terminal ASCII live watch built from authoritative query data
- command receipt / error / idempotency
- event log / replay / audit query
- \`talk\`
- \`broadcast\`
- \`reaction\`
- \`bet\`
- \`transition_stage\`
- \`start_timer\`
- \`open_submission\`
- \`submit\`
- \`update_submission\`
- \`lock_submission\`
- \`submit_score\`
- \`grant_award\`
- \`draw\`
- \`move_entity\`
- \`assign_team\`
- \`GET /api/orchestrator/snapshot\`
- \`GET /api/orchestrator/scores\`
- \`GET /api/orchestrator/events\`
- \`GET /api/orchestrator/replay\`
- \`GET /api/orchestrator/audit\`
- \`bun run openclaw:control -- ascii <activity-run-id> --watch <seconds>\`

## 4. 现在的边界

当前这轮收口后的关键边界是：

- \`src/openclaw/platform/contracts.ts\` 继续只承载平台通用 contract
- \`src/openclaw/platform/activityRegistry.ts\` 只承载活动定义、房间 alias 配置、score config、compat adapter 等后端运行时需要的内容
- \`src/openclaw/localPlatformConfig.ts\` 明确声明本地 bootstrap 默认值
- \`src/openclaw/activities/theFoolV1/*\` 承载 The Fool 的 stage/schema/bootstrap world/score compat/room alias
- \`scripts/openclaw-orchestrator.ts\` 只从显式 bootstrap config + registry 装配首个 activity，并承担 routing / journal / HTTP / WS glue
- \`scripts/orchestrator/*\` 承载 query / transport / audit / snapshot 等后端模块
- \`scripts/orchestrator/commands/*\` 承载 command-family handler、fresh command executor、以及 submission/score/confirmation helper
- \`scripts/openclaw-control.ts\` 优先读取 authority \`snapshot.world\`，显式 \`--activity-package-id\` 仅作为 bootstrap/dev fallback

不再允许的路径：

- 在共享平台注册表里塞前端页面 copy、scene layout、operator command 文案
- 在共享 runtime/helper 中偷带 The Fool 默认 template
- 在 authority 缺失时静默借用某个 reference activity 冒充当前活动真相

## 5. The Fool 的当前角色

The Fool 仍然是第一份内置活动，但现在它是“显式配置的首个活动”，不是“平台默认规则”。

这意味着：

- 平台层不再硬编码 \`the-fool-v1\`
- 平台层不再依赖 The Fool 的 room id / annotation key
- The Fool 的兼容字段如 \`favorite\` / \`mostAbsurd\` 仍然存在，但只存在于 The Fool activity adapter
- 本地默认跑 The Fool，是 \`localPlatformConfig\` 的决策，不是共享 runtime 的决策

## 6. 浏览器现状

当前浏览器壳层只负责显示：

- gateway 连接状态
- authoritative query 状态
- 当前 activity/template/stage/timer
- authority world 房间摘要
- 最近 audit 活动
- CLI/operator 入口提示

浏览器内部现在也已经按低耦合方式拆开：

- \`src/openclaw/useGatewayOverview.ts\` 主要负责连接 gateway / query client 与 React state
- \`src/openclaw/overview/runtime.ts\` 主要负责纯 overview/runtime 归一化、summary 组装、事件应用与格式化
- \`src/openclaw/overviewSharedState.ts\` 继续负责 authority world / skill 相关共享摘要

真正的 operator-facing live console 现在主要在终端：

- \`scripts/openclaw-control.ts\` 的 \`ascii\` 子命令会先验证本地 authority，再拉取 \`snapshot + events + replay\`
- \`src/openclaw/asciiOverview.ts\` 负责把真实 authority 数据渲染成持续刷新的 ASCII 直播控制台
- 该视图默认按 The Fool 的 6 个 contestant / 3 队去展示全幕运行状态，而不是只盯单一 stage
- 当前已覆盖的 authoritative social feed 包括 \`agent.talked\`、\`broadcast.sent\`、\`reaction.added\`、\`bet.placed\`

它不再负责：

- 节目叙事编排
- stage preview
- operator workspace
- scene preset / spotlight / heat tie-break
- activity-specific presenter copy

## 7. 当前代码组织快照

如果你只是想快速判断“这份实现现在怎么拆”：

- command 执行主线已经从单个大分支拆成 stage/timer、submission、score、award、entity、team 等 family handler
- fresh command 的统一 role gate、dispatch、commit/broadcast、auto-transition 后处理已经单独收进 \`scripts/orchestrator/commands/execute.ts\`
- submission payload 校验、dangerous confirmation、score projection 构建等 command 专用 helper 已经下沉到 \`scripts/orchestrator/commands/helpers.ts\`
- 主 orchestrator 文件还保留 projection rebuild、timer schedule、transition rule、idempotency journal、query endpoint、HTTP/WS server 这些真正的 orchestration glue

## 8. 验证基线

当前这份参考实现的最小验证基线仍然是：

- \`bun run build\`
- \`bun run lint\`
- \`bun test\`
- 在需要确认 command 语义时，优先走真实 \`/api/orchestrator/commands\` 与 query endpoint 做最小命令链验证
- 在需要确认全幕运行视图时，优先走真实 \`bun run openclaw:control -- ascii <run> --watch 0.5\`

## 9. 已知剩余事项

当前还没有解决、但现在也被明确隔离的问题：

- \`scripts/openclaw-orchestrator.ts\` 仍然是单进程本地实现，不是完整平台服务
- 只有 The Fool 这一份 built-in activity 真正接入并验证过
- 浏览器壳层虽然还会消费 authority/query summaries，但这层已经不再尝试成为通用活动前端
- 更多活动接入时，需要继续验证 registry/bootstrapping 是否足够通用
- audience/viewer 侧真实输入通道还没并入这条 authoritative social runtime
- \`audience_heat\` / \`bet_heat\` / reaction totals 之类的聚合 snapshot 还没有落成独立权威投影
