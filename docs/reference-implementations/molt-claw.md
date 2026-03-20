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
- command receipt / error / idempotency
- event log / replay / audit query
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

## 4. 现在的边界

当前这轮收口后的关键边界是：

- \`src/openclaw/platform/contracts.ts\` 继续只承载平台通用 contract
- \`src/openclaw/platform/activityRegistry.ts\` 只承载活动定义、房间 alias 配置、score config、compat adapter 等后端运行时需要的内容
- \`src/openclaw/localPlatformConfig.ts\` 明确声明本地 bootstrap 默认值
- \`src/openclaw/activities/theFoolV1/*\` 承载 The Fool 的 stage/schema/bootstrap world/score compat/room alias
- \`scripts/openclaw-orchestrator.ts\` 只从显式 bootstrap config + registry 装配首个 activity
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

它不再负责：

- 节目叙事编排
- stage preview
- operator workspace
- scene preset / spotlight / heat tie-break
- activity-specific presenter copy

## 7. 已知剩余事项

当前还没有解决、但现在也被明确隔离的问题：

- \`scripts/openclaw-orchestrator.ts\` 仍然是单进程本地实现，不是完整平台服务
- 只有 The Fool 这一份 built-in activity 真正接入并验证过
- 浏览器壳层虽然还会消费 authority/query summaries，但这层已经不再尝试成为通用活动前端
- 更多活动接入时，需要继续验证 registry/bootstrapping 是否足够通用
