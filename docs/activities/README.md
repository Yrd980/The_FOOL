# 活动文档边界说明

这个目录只承接“某个活动本身”的正式需求与模板示例。

它回答的问题不是“OpenClaw 平台应该具备什么通用能力”，而是“这档活动要怎么在平台能力之上被表达和运行”。

## 平台层写什么

下列内容应继续写在 `docs/openclaw-platform/*`：

- 身份、角色、权限、作用域
- 世界模型、Room / Zone / Channel / Team 的通用语义
- authority world 与 activity bootstrap seed 的通用边界
- `ActivityTemplate` / `ActivityRun` / `StageTemplate` / `TransitionRule` 这类抽象
- 命令、事件、快照、回放、审计、同步协议
- 通用 Submission / Vote / JudgeScore / Award 模型
- 与具体 renderer 无关的服务端权威状态

这些内容换成 The Fool 之外的活动仍然成立。

## 活动层写什么

下列内容应写在 `docs/activities/<activity-id>/*`：

- 活动名称、活动目标、角色映射
- stage id、阶段顺序、阶段目标、阶段结束条件
- 活动使用的 room / channel / team 命名
- 活动自己的 bootstrap seed / assignment seed 内容
- 活动专属 submission schema 选择与字段约束
- 活动专属评分字段、奖项、汇总口径
- 活动专属术语、玩法、主持口径、观众互动规则

这些内容如果换成别的活动，大概率就要变。

## 渲染与 Scene 写什么

下列内容不应写成平台权威规则，建议单独放在活动 scene spec 或 renderer 项目文档里：

- 每一幕的背景图、前景装饰、字幕条样式
- spotlight / split-screen / reveal / verdict 的视觉表现
- 观众首页每一幕优先显示什么模块
- 哪些信息上大屏，哪些信息只在导演台出现
- 特定 renderer 的动画、粒子、镜头、音效实现

这些内容服务于“怎么播”，不是“什么是真的”。

## 推荐目录结构

对于每个活动，建议至少保留：

- `requirements.md`
  - 活动规则真相
- `template-example.md`
  - 最小模板示例 / seed 结构 / 示例 payload

如果活动已经进入正式播出设计，建议再补：

- `scene-spec.md`
  - 每一幕的场景结构与播出语言
- `copy-guide.md`
  - 主持、导播、观众、backstage 的文案口径

## 判断准则

可以用下面这三个问题快速判断一段内容该写在哪：

1. 换成别的活动还成立吗？
   - 成立：平台层
2. 这条规则只对某个活动成立吗？
   - 成立：活动层
3. 这条内容只影响观众或某个 renderer 看到什么吗？
   - 成立：scene / renderer 文档

## The Fool 的当前用法

就当前仓库而言：

- `docs/openclaw-platform/*` 定义 OpenClaw 平台的通用 contract
- `docs/activities/the-fool-v1/*` 定义 The Fool v1 这档活动
- `docs/activities/the-fool-v1/scene-spec.md` 定义 The Fool 在 `/show`、`/show/:stageId`、`/control/stages/:stageId` 上的播出层 scene contract
- `molt-claw` 里的 `/show`、`/control` 只是当前 The Fool 的 renderer / control 原型，不是平台总规格本身
