# 平台优先实施路线

总入口请先回到：[docs/README.md](../README.md)

本文不是正式 contract；它只回答“平台化应该按什么顺序推进”。

如果你还没先确认正式真相，建议先读：

- [../openclaw-platform/requirements.md](../openclaw-platform/requirements.md)
- [../openclaw-platform/design.md](../openclaw-platform/design.md)
- [../activities/the-fool-v1/requirements.md](../activities/the-fool-v1/requirements.md)

## 1. 目标

这份路线文档回答的问题不是“OpenClaw 应该具备什么能力”，而是“如果要避免继续把流程写死在某个 renderer 里，应该按什么顺序把平台做起来”。

推荐策略不是：

- 先做一个完全脱离真实活动的抽象平台
- 最后再想办法接入 The Fool

推荐策略是：

- 先把 OpenClaw 的通用平台内核实现出来
- 同时始终用 The Fool 作为第一份 reference activity 做验收

可以把它概括成：

> platform-first, activity-validated, renderer-thin

## 2. 基本原则

### 2.1 平台先行，但不脱离真实活动

平台层优先实现通用能力，但每一轮都要拿真实活动验证，否则平台会越来越抽象，最后接不住 The Fool 这种完整活动。

### 2.2 The Fool 是首个活动，不是平台默认规则

The Fool 应作为第一份 `ActivityTemplate` / `ActivityRun` 接入平台，而不是继续藏在平台通用类型、通用命令或通用 snapshot 字段里。

### 2.3 Renderer 尽量变薄

`/show` 与 `/control` 应越来越像平台 state 的消费者，而不是流程真相的维护者。

### 2.4 每一层都有明确完成标准

只有当前一层已经能独立成立，才进入下一层。否则很容易把下一层的临时逻辑反向写回上一层。

## 3. 推荐阶段拆分

### Phase 1: Platform Core

目标：

- 先让 OpenClaw 成为一个不依赖 The Fool 文案也能运行的活动编排平台骨架。

应完成：

- `ActivityTemplate` / `ActivityRun`
- `StageTemplate` / `TransitionRule`
- `Timer` / `Lock`
- 统一 `CommandEnvelope` / `CommandReceipt` / `CommandError`
- `EventEnvelope` / sequence / replay / audit
- `World` / `Room` / `Team` / `Entity`
- 通用 `SubmissionSchema` / `Submission` / `SubmissionVersion`
- 通用 `JudgeScore` / `Aggregation` / `Award`
- `SkillBinding` / 文档版本冻结
- snapshot / delta / replay / audit query

完成标准：

- 不依赖 The Fool 的 stage id 或字段名，也能描述一个活动 run
- 平台能独立维护 stage / timer / submission / score / award 权威状态
- renderer 只消费 snapshot / event，不再自己保存流程真相

不应在这一阶段做的事：

- 把 `team-project-v1`、`favorite`、`mostAbsurd` 写进平台通用 schema
- 把 `/show` 当前 layout 直接当成平台模型
- 用 renderer 内局部 state 代替 authority 状态

### Phase 2: Activity Runtime Adapter

目标：

- 让平台真正能“加载一个活动”，而不是只拥有一组抽象类型。

应完成：

- `ActivityTemplate` 的注册与加载
- `SubmissionSchema` / `ScoringRule` / `AwardCatalog` 的活动级绑定
- `TransitionRule` 的活动级配置与执行
- 活动级 room / team / assignment seed 装配
- 活动级 skill binding 装配
- 活动启动、恢复、结束的最小 lifecycle

完成标准：

- 平台可以不改通用代码，仅通过活动模板配置启动不同活动
- 同一套 command / event / snapshot contract 可以承载不同活动
- 活动专属字段只出现在活动包与活动 seed 中，不出现在平台通用 contract 中

不应在这一阶段做的事：

- 把某一档活动的阶段顺序写进 orchestrator 主流程
- 让活动模板绕过平台通用命令直接操纵 renderer

### Phase 3: The Fool Integration

目标：

- 把 The Fool 作为第一份正式活动模板接入平台，验证平台抽象是否足够承载真实活动。

应完成：

- The Fool 的 10 幕 `StageTemplate`
- The Fool 的 room / team / assignment seed
- `team-project-v1` submission schema
- AI judge scoring rule
- award catalog
- The Fool 的 skill binding 与 doc version 策略
- The Fool 的 scene spec 与活动规则映射

完成标准：

- The Fool 可以作为一份活动包被加载，而不是写死在平台 runtime 中
- The Fool 的 submission / scoring / award 只通过活动配置接入平台
- 需要修改的若仍是平台通用类型，说明平台抽象还没收稳

不应在这一阶段做的事：

- 为了接 The Fool，再把 `act-*`、`team-project-v1` 等内容回写到 `docs/openclaw-platform/*`
- 用 The Fool 的特殊字段重命名平台通用 score / submission 模型

### Phase 4: Show / Control Integration

目标：

- 让 `/show` 与 `/control` 彻底建立在平台 state 之上，而不是半平台半前端硬编码。

应完成：

- `/control` 只通过通用 command 接口驱动 stage / timer / submission / score / award
- `/show` 只通过 authority `currentStageId` + activity scene config 选场景
- `/show/:stageId` 成为 preview route
- `/control/stages/:stageId` 成为 operator workspace
- shared state adapter 统一消费 snapshot / delta / query
- state unavailable / freshness / audit / provenance 的 operator-facing 分层展示

完成标准：

- `/show` 不再依据 live heat 决定“当前是哪一幕”
- `/control` 不再自己发明流程 truth
- show/control 只承接平台 authority + 活动 scene config

不应在这一阶段做的事：

- 在组件里重新解析一遍平台原始 payload 充当私有真相
- 为了视觉方便，在 renderer 内偷偷修改 stage / score / award 语义

## 4. 每阶段的验收问题

进入下一阶段前，建议先问下面这些问题。

### Phase 1 -> Phase 2

- 如果拿掉 The Fool 这个名字，平台还能独立表达一个活动吗？
- 如果换一档活动，command / event / snapshot contract 需要大改吗？

### Phase 2 -> Phase 3

- 活动模板是否已经能装入不同的 stage、schema、scoring rule？
- 平台是否已经支持“活动专属字段在活动层扩展，而不是平台层硬编码”？

### Phase 3 -> Phase 4

- The Fool 是否已经作为活动包存在，而不是 renderer 内流程表？
- `/show` 与 `/control` 是否已经只依赖 authority state 和活动配置？

## 5. 当前建议的实际推进顺序

如果结合当前仓库现状，建议按下面顺序推进：

1. 继续收紧平台通用模型
2. 把 The Fool 现有实现语义彻底收拢到活动包 / reference implementation
3. 补一个活动模板加载或注册边界
4. 让 orchestrator 只跑通用 lifecycle
5. 再让 `/show` / `/control` 只消费平台 authority + The Fool scene config

当前最值得先做的收口点：

- score target 与 submission target 彻底通用化
- `ActivityTemplate` / `ActivityRun` 装配入口
- 让 The Fool 的 seed / stage / schema / award 以活动包形式存在
- 让 `/show` scene 选择函数只依赖 `currentStageId`

结合当前 `molt-claw` worktree，这一轮已经实际落地到：

- 平台通用 contract 已独立收口到 `src/openclaw/platform/contracts.ts`
- 活动包注册边界已独立收口到 `src/openclaw/platform/activityRegistry.ts`
- The Fool v1 的 stage/schema/world/score config 已搬到 `src/openclaw/activities/theFoolV1.ts`
- score projection 已改成通用 `annotations`，The Fool 的 `favorite` / `mostAbsurd` 只留在活动包与 CLI 兼容层

因此下一批最值得继续收口的是：

- 拔掉 `src/openclaw/activityRuntime.ts` / `src/openclaw/control.ts` 里剩余的默认 activity package fallback，尤其是 room catalog 解析路径
- 让 orchestrator snapshot 的 `world` / `skills` 真正来自 projection，而不是继续直接读活动包静态数据
- 让 `/show` / `/control` 的 preview 与 operator workspace 进一步依赖 authority + activity meta，而不是历史遗留的 The Fool 假设

### 当前平台/活动分离收口目标

如果要把 The Fool 从“第一份参考活动”进一步收口成“真正可插拔的活动包”，接下来更具体的工作应是：

- 去掉 renderer / shared runtime 的 implicit fallback
  - 未解析到 `activityPackageId` / `templateId` 时，返回 pending / unavailable，而不是静默退回首个已注册活动包
- 把活动包里的 `world` 语义明确收口为 bootstrap seed
  - world seed 只用于启动时初始化 authority world
  - 运行时 snapshot / query 里的 `world` 一律来自 projection
- 把 orchestrator 里的 reference activity 语义限制在 bootstrap
  - reference activity 只负责起第一条 run 或初始化 seed
  - 不再参与 snapshot 构建、运行时 stage/team 查找或其他隐式默认路径
- 给平台补默认 schema 校验
  - 当某个活动没有自定义 submission normalizer 时，平台仍能按 `SubmissionSchema` 做基础校验
- 把 The Fool 的兼容层继续下沉到活动适配层
  - 旧 score 字段兼容
  - CLI 兼容 flags
  - submissionId -> teamId 的命名推断

做到这一步时，The Fool 仍然是 reference activity，但不再是平台默认规则。

## 6. 风险信号

如果推进过程中出现下面这些现象，通常说明平台和活动又开始混了：

- 平台通用 type 里再次出现 `act-7-ai-judging`
- 平台通用 score schema 里再次出现 `favorite` / `mostAbsurd`
- shared runtime helper 在拿不到活动包时静默回退到某个默认包
- snapshot 中的 `world` 重新直接读取活动模板静态 seed
- renderer 通过本地 heat 或组件状态决定当前 stage
- 活动改一条规则，就要改平台 command shape
- 参考实现现状再次被写回 `docs/openclaw-platform/*`

## 7. 与现有文档的关系

- 平台 contract 见 `docs/openclaw-platform/*`
- The Fool 活动规则见 `docs/activities/the-fool-v1/requirements.md`
- The Fool 播出层见 `docs/activities/the-fool-v1/scene-spec.md`
- 当前 `molt-claw` 参考实现现状见 `docs/reference-implementations/molt-claw.md`

本文只负责说明推进顺序，不替代上述任何一份正式文档。
