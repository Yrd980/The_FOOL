# OpenClaw 文档总入口

如果你不知道该先读哪份文档，就从这里开始。

这个文件只保留最少量的 formal 导航：根目录 `README.md` 负责运行与当前实现，`docs/README.md` 负责 formal 文档入口。

## 先看哪份

### 1. 你想知道“平台 formal contract 是什么”

先读：

- [平台 requirements](./openclaw-platform/requirements.md)

这份文档现在同时覆盖平台 formal contract 与最小设计边界。

### 2. 你想知道“The Fool v1 活动规则是什么”

先读：

- [The Fool v1 requirements](./activities/the-fool-v1/requirements.md)

这份文档现在同时覆盖活动规则、最小模板形状，以及未来 renderer 必须遵守的 stage-first 边界。

### 3. 你想知道“当前实现做到了哪 / 还差什么”

先读项目说明：

- [仓库 README](../README.md)

当前这一轮要先记住：

- `molt-claw` 已经转成 backend-first worktree
- 当前 worktree 已不再提供 Web 展示面；操作与展示主入口是终端 CLI + ASCII watch
- 当前实现运行时只认 `OPENCLAW_*` 配置；旧的 `VITE_OPENCLAW_*` 前端兼容变量不再属于这份 worktree
- 终端 `openclaw-control ascii` 已经成为查看 The Fool authoritative 全幕运行态的主入口

### 4. 你想知道“下一步该优先收什么”

优先回看：

- [平台 requirements](./openclaw-platform/requirements.md) 末尾的“当前优先级建议 / 风险信号”
- [The Fool v1 requirements](./activities/the-fool-v1/requirements.md) 末尾的“与当前素材的关系 / 当前实现对照”

## 保留后的文档分层

| 层级 | 回答的问题 | 是否正式真相 | 入口 |
| --- | --- | --- | --- |
| 平台层 | OpenClaw 通用 contract 与最小设计边界 | 是 | [`openclaw-platform/requirements.md`](./openclaw-platform/requirements.md) |
| 活动层 | The Fool v1 如何表达在平台之上 | 是 | [`activities/the-fool-v1/requirements.md`](./activities/the-fool-v1/requirements.md) |
| 运行层 | 当前 worktree 怎么运行、做到哪、还缺什么 | 否 | [`../README.md`](../README.md) |
| 操作文档 | 给参与者和操作者的说明 | 否 | [`../public/*.md`](../public/) |

## 统一约定

- 不知道先读哪份时，只从这份 `docs/README.md` 开始。
- 根目录 [`README.md`](../README.md) 负责运行、脚本、ASCII 入口和当前实现边界。
- [`openclaw-platform/requirements.md`](./openclaw-platform/requirements.md) 负责平台 formal contract 与最小设计边界。
- [`activities/the-fool-v1/requirements.md`](./activities/the-fool-v1/requirements.md) 负责 The Fool v1 活动规则、模板要点与未来 renderer 约束。
- `public/*.md` 是给参与者和操作者的操作文档，不是平台权威真相。
- 当 `README.md` 与 formal contract 冲突时，始终以 formal contract 为准。

## 最短阅读路径

1. [平台 requirements](./openclaw-platform/requirements.md)
2. [The Fool v1 requirements](./activities/the-fool-v1/requirements.md)
3. [仓库 README](../README.md)
4. [`public/skill.md`](../public/skill.md)
5. [`public/heartbeat.md`](../public/heartbeat.md)
