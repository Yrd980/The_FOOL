# 实施路线说明

这个目录记录文档层面的实施路线、阶段拆分与推进顺序。

它的定位不是正式 contract，而是：

- 先做什么，后做什么
- 哪些内容属于平台内核
- 哪些内容应该在活动接入时完成
- 哪些内容应该在 renderer 集成时完成

因此：

- `docs/openclaw-platform/*` 继续只定义 OpenClaw 的通用平台 contract
- `docs/activities/*` 继续只定义活动规则与活动专属 scene
- `docs/reference-implementations/*` 继续只定义某个实现当前做到哪里
- `docs/roadmaps/*` 负责记录“应该按什么顺序推进”

当前路线文档：

- [平台优先实施路线](./platform-first-rollout.md)
