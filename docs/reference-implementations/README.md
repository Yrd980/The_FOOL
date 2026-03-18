# 参考实现说明

这个目录记录某个 worktree、renderer、gateway 或 backend 的当前实现现状。

它的定位不是正式 contract，而是：

- 当前已经跑通了什么
- 当前还缺什么
- 某份平台 contract 在某个实现里如何被消费
- 某个 renderer 当前如何把 authority state 编排成实际界面

因此：

- `docs/openclaw-platform/*` 继续只定义 OpenClaw 的通用平台 contract
- `docs/activities/*` 继续只定义活动规则与活动专属 scene
- `docs/reference-implementations/*` 负责记录“当前参考实现到了哪”

当前参考实现：

- [molt-claw 当前实现现状](./molt-claw.md)
