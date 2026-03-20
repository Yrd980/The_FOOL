# 参考实现目录说明

总入口请先回到：[docs/README.md](../README.md)

这个目录不是文档总入口，也不是正式 contract。

只有当你要回答“当前某个实现做到了哪、还差什么”时，再读这里。

它负责记录：

- 当前已经跑通了什么
- 当前还缺什么
- formal contract 在某个实现里如何被消费
- 某个 backend / browser shell / 其他实现当前如何把 authority state 落成实际系统

阅读这里时要注意：

- 这里记录的是“实现现状”，不是 formal contract
- 当前 `molt-claw` 已经转成 backend-first worktree
- The Fool 的 scene spec 仍存在，但不表示 `molt-claw` 还保留富内容 show/control renderer

当前参考实现：

- [molt-claw 当前实现现状](./molt-claw.md)
