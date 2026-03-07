# AI Pixel War (Bun + TypeScript)

全自动 AI 像素大战 MVP：
- 画布对抗（占地 + 进攻 + 防守 + 爆破）
- AI 公开发言 / 私聊 / 条约提案
- 情绪、关系、共享历史影响行动
- 支持数字分身档案（`identity_dna`）批量接入
- DeepSeek 驱动回合决策（可切 `--dry-run`）

## 环境要求

- Bun `>=1.0`
- DeepSeek API Key（仅实时模式需要）

## 安装

```bash
bun install
```

## fish 设置 DeepSeek Key

当前 shell 生效：

```fish
set -x DEEPSEEK_API_KEY \"your_deepseek_key\"
```

长期生效（所有新 shell）：

```fish
set -Ux DEEPSEEK_API_KEY \"your_deepseek_key\"
```

## 运行

快速干跑（不调用 API）：

```bash
bun run check
```

说明：
- 默认 `check` 现在会生成 `8` 回合回放，而不是 `5` 回合
- 画布会按回合渐进收束，不再在最后一步突然补完整张图
- 回放现在带有 `art_phase`，会显示当前回合是在搭大形、补轮廓、补内部 motif、扩背景还是收束

完整模拟（实时调用 DeepSeek）：

```bash
bun run start
```

神话壁画主题（推荐主线玩法）：

```bash
bun run src/index.ts --dry-run --rounds=6 --width=72 --height=72 --myth="a shattered throne blooming into a tidal cathedral, solemn but dangerous"
```

自定义参数：

```bash
bun run src/index.ts --rounds=20 --width=96 --height=96 --agents=20 --concurrency=10 --model=deepseek-chat
```

输出 replay 会保存到 `output/replay-*.json`。

## 网页观战（直接看效果）

启动本地可视化：

```bash
bun run viewer
```

开发模式（React 热更新 + Bun replay API）：

```bash
bun run viewer:dev
```

如只想构建前端产物：

```bash
bun run viewer:build
```

打开：

```text
http://localhost:4173
```

功能：
- 基于 `React + Tailwind CSS + Vite` 的观战前端
- 自动读取 `output/` 最新 replay（也可切换历史 replay）
- 像素画布逐回合播放
- 使用真实 `canvas_updates` 回放画布颜色，而不只是按 territory owner 着色
- 支持“跟随最新”自动切换新 replay（轮询观战）
- 支持“循环播放”回放模式
- 同步显示公开发言、私聊、人格注释（`persona_notes`）
- 显示每回合热闹度指标（`round_metrics`）
- 显示每回合社交热度（`social_metrics`）
- 提供 `Twin Lens` 关系透镜，可查看单个分身的情绪、最近摘要、强关系与高张力关系
- `Round Pulse` 头部会显示当前生成阶段（`art_phase`），方便理解现在是在搭主体、补轮廓、补内部、扩背景还是收束

如果你主要想看 AI 在“聊什么 / 心情如何”：

- `Public Voice`：公开发言
- `Private Wire`：私聊
- `Persona Notes`：这一回合的人格倾向说明
- `Twin Lens`：单个分身的情绪、最近摘要、关系网络

## 数字分身（OpenClaw风格）

使用样例分身文件（10个分身）：

```bash
bun run src/index.ts --rounds=20 --width=96 --height=96 --profiles=profiles/openclaw-sample.json --concurrency=10
```

说明：
- `--profiles` 提供分身档案 JSON（数组或 `{ "profiles": [...] }`）
- 若提供 `--profiles`，实际 agent 数量以档案数量为准
- 推荐 `10-30` 个分身时将 `--concurrency` 设为 `8-16`
- 行为主导字段是 `identity_dna`，`persona` 现在仅作为可选兼容标签
- 分身会根据 `trust / affinity / debt / recent_shared_events` 调整协商、结盟、复仇与发言
- `dry-run` / fallback 也走 DNA + 关系驱动逻辑，不再是简单 persona 脚本
- replay 中包含 `persona_notes`、`round_metrics`、`social_metrics` 与 `social_snapshot`，可直接用于“热闹度”与人际关系可视化
- 最后一回合会执行画布收束填充，确保最终呈现出完整像素画

## 当前设计重点

- 核心体验是“一群有鲜明人格的数字分身在抢像素地盘、协商、冲突、作画”
- 默认行为优先由 `identity_dna`、情绪、关系与共享历史共同决定
- 默认启用 `Myth Mode`，即共享一份神话艺术方向（`art_direction`），而不是去临摹现实物体
- 默认回放采用分阶段作画：先主体大形，再轮廓，再内部 motif，再背景，最后整体收束
- `persona` 仅保留为兼容标签，不再作为主要行为分流依据
- agent 会记住具体对象之间的事件，例如签约、毁约、进攻、失地与冲突胜负
- 若传入 `--myth="..."`，系统会围绕这句主题生成调色板、motif、构图区和共享审美宪法

## 当前代码结构（模块化后）

当前的运行链路仍然是：

```text
CLI (`src/index.ts`)
  -> `PixelWarEngine` orchestrator (`src/engine.ts`)
  -> replay JSON (`output/replay-*.json`)
  -> viewer API / React viewer
```

但 `src/engine.ts` 现在主要负责“编排”，不再独自承载全部逻辑。引擎内部已经拆成这些职责模块：

- `src/engine.ts`
  - 回合主循环 orchestrator
  - 维护共享状态容器（board / agents / events / treaties）
  - 串联各个 engine 子模块
- `src/engine/constants.ts`
  - 默认神话 prompt、动作耗能、默认 twin DNA、基础常量
- `src/engine/artDirector.ts`
  - 启动期生成共享 `art_direction`
  - 生成 render palette 与目标画布 `artTargetColors`
- `src/engine/artRuntime.ts`
  - 运行期的神话构图数学逻辑
  - 例如 `motifMask`、`zoneWeight`、`artPhaseForRound`、`targetPriorityAt`
- `src/engine/twinFactory.ts`
  - 读取 `profiles`
  - 规范化 DNA / goal weights
  - 创建初始 agents 与初始落点
- `src/engine/socialState.ts`
  - relations / memory / treaties
  - `social_snapshot` 与 `social_metrics`
- `src/engine/decisionService.ts`
  - 对手摘要
  - 模型请求、repair、sanitize、bound
  - 决策协议收口
- `src/engine/strategyService.ts`
  - `buildActionHints`
  - `applyIdentitySteering`
  - `personalMythReading`
  - 审美评分与外交目标选择
- `src/engine/canvasRuntime.ts`
  - board helper / geometry
  - 动作落子与渐进式画布收束
- `src/engine/scoreboard.ts`
  - 最终 territory / art / reputation 汇总评分

可以把它理解成 4 层：

- **世界层**：`artDirector` + `artRuntime`
- **角色层**：`twinFactory` + `socialState`
- **决策层**：`decisionService` + `strategyService`
- **执行/结算层**：`canvasRuntime` + `scoreboard`

## 类型检查

```bash
bun run typecheck
```

## Git 管理建议

初始化仓库：

```bash
git init
git add .
git commit -m \"chore: bootstrap ai pixel war mvp with bun + ts\"
```

日常流程：

```bash
git checkout -b feat/xxx
# 开发...
bun run typecheck && bun run check
git add .
git commit -m \"feat: xxx\"
```

## 目录结构

```text
schemas/
  agent-state.schema.json
  turn-decision.schema.json
src/
  engine/
    artDirector.ts
    artRuntime.ts
    canvasRuntime.ts
    constants.ts
    decisionService.ts
    scoreboard.ts
    socialState.ts
    strategyService.ts
    twinFactory.ts
  deepseekClient.ts
  engine.ts
  index.ts
  mockAgent.ts
  types.ts
  viewerServer.ts
viewer/
  src/
    App.tsx
    main.tsx
    index.css
  index.html
  tsconfig.json
  vite.config.ts
output/
```
