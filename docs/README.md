# OpenClaw 文档总入口

如果你不知道该先读哪份文档，就从这里开始。

这个文件是仓库里唯一推荐的文档入口；其他 `README` 都只负责某个子目录的局部导航，不再充当“总入口”。

先记住两个起点：

- 文档总入口：当前这份 `docs/README.md`
- 仓库运行与本地调试入口：[`README.md`](../README.md)

## 先看哪份

### 1. 你想知道“正式规则 / 正式真相是什么”

先读平台 contract：

- [平台 requirements](./openclaw-platform/requirements.md)
- [平台 design](./openclaw-platform/design.md)

这两份定义 OpenClaw 平台的正式 contract。

### 2. 你想知道“某个活动怎么落到平台上”

先读活动目录：

- [活动文档边界说明](./activities/README.md)
- [The Fool v1 requirements](./activities/the-fool-v1/requirements.md)
- [The Fool v1 template example](./activities/the-fool-v1/template-example.md)

如果你关心“怎么播”，再继续读：

- [The Fool v1 scene spec](./activities/the-fool-v1/scene-spec.md)

### 3. 你想知道“当前实现做到了哪 / 还差什么”

先读参考实现与项目说明：

- [molt-claw 当前实现现状](./reference-implementations/molt-claw.md)
- [参考实现目录说明](./reference-implementations/README.md)
- [仓库 README](../README.md)

### 4. 你想知道“下一步应该先做什么”

最后再读路线文档：

- [平台优先实施路线](./roadmaps/platform-first-rollout.md)
- [实施路线目录说明](./roadmaps/README.md)

## 文档分层

| 层级 | 回答的问题 | 是否正式真相 | 入口 |
| --- | --- | --- | --- |
| 平台层 | OpenClaw 通用 contract 是什么 | 是 | [`openclaw-platform/*`](./openclaw-platform/) |
| 活动层 | 某档活动如何表达在平台之上 | 是 | [`activities/*`](./activities/) |
| scene / 播出层 | 同一份 authority state 要怎么播出来 | 否，依赖 authority | 活动目录下的 `scene-spec.md` |
| 参考实现层 | 当前某个 worktree / renderer / backend 做到了哪 | 否 | [`reference-implementations/*`](./reference-implementations/) |
| 路线层 | 应该按什么顺序推进 | 否 | [`roadmaps/*`](./roadmaps/) |

## 目录作用

- `docs/openclaw-platform/*`
  定义平台通用 contract。这里不写活动专属 stage id、submission 字段或奖项名。
- `docs/activities/*`
  定义活动规则、活动模板、活动 scene。这里不重写平台通用协议。
- `docs/reference-implementations/*`
  记录“当前实现到了哪”。这里不反向充当 requirements。
- `docs/roadmaps/*`
  记录“应该先做什么后做什么”。这里不定义正式真相。

## 统一约定

- 不知道先读哪份时，只从这份 `docs/README.md` 开始。
- 根目录 [`README.md`](../README.md) 只负责这个 worktree 的运行、脚本和当前实现说明，不负责文档总导航。
- 子目录里的 `README.md` 只解释本目录用途；它们是二级入口，不是全仓库总入口。
- `public/*.md` 是给参与者和操作者的操作文档，不是平台权威真相。
- 当 reference implementation、roadmap 与 formal contract 冲突时，始终以 formal contract 为准。

## 最短阅读路径

如果只想用最少时间建立正确心智模型，按下面顺序读：

1. [平台 requirements](./openclaw-platform/requirements.md)
2. [平台 design](./openclaw-platform/design.md)
3. [The Fool v1 requirements](./activities/the-fool-v1/requirements.md)
4. [The Fool v1 scene spec](./activities/the-fool-v1/scene-spec.md)
5. [molt-claw 当前实现现状](./reference-implementations/molt-claw.md)
