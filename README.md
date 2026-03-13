# AI Pixel War (Bun + TypeScript)

全自动 AI 像素大战——多数字分身在共享画布上对抗、协商、结盟、作画：
- 画布对抗（占地 + 进攻 + 防守 + 爆破）
- AI 公开发言 / 私聊 / 条约提案（`no_attack` + `joint_attack`）
- 情绪、关系、共享历史影响行动
- 支持数字分身档案（`identity_dna`）批量接入
- DeepSeek 驱动回合决策（可切 `--dry-run`）
- 神话壁画主题共同作画（Myth Mode）

## 环境要求

- Bun `>=1.0`
- DeepSeek API Key（仅实时模式需要）

## 安装

```bash
bun install
```

## 设置 DeepSeek Key

```fish
# 当前 shell
set -x DEEPSEEK_API_KEY "your_deepseek_key"

# 长期生效
set -Ux DEEPSEEK_API_KEY "your_deepseek_key"
```

## 运行

快速干跑（不调用 API）：

```bash
bun run start -- --dry-run
```

完整模拟（实时调用 DeepSeek）：

```bash
bun run start
```

神话壁画主题（推荐玩法）：

```bash
bun run src/index.ts --dry-run --rounds=6 --width=72 --height=72 --myth="a shattered throne blooming into a tidal cathedral, solemn but dangerous"
```

自定义参数：

```bash
bun run src/index.ts --rounds=20 --width=96 --height=96 --agents=20 --concurrency=10 --model=deepseek-chat
```

查看所有参数：

```bash
bun run src/index.ts --help
```

输出 replay 保存到 `output/replay-*.json`。

## 网页观战

```bash
bun run viewer
```

打开 `http://localhost:4173`，功能：

- 像素画布逐回合/逐动作播放
- 支持按模式（dry-run / live）和 agent 数量筛选 replay
- 排名面板显示角色名和领地份额
- 错误面板按类型着色显示回合错误
- 公开发言、私聊、人格注释同步展示
- 回合指标（`round_metrics`）和社交热度（`social_metrics`）
- Twin Lens 关系透镜：查看分身情绪、摘要、强关系与高张力关系
- 艺术阶段标签（搭主体 → 补轮廓 → motif → 背景 → 收束）
- 跟随最新 / 循环播放模式

开发模式（React 热更新）：

```bash
bun run viewer:dev
```

## 数字分身

使用样例分身文件（10 个分身）：

```bash
bun run src/index.ts --rounds=20 --width=96 --height=96 --profiles=profiles/openclaw-sample.json --concurrency=10
```

- `--profiles` 提供分身档案 JSON（数组或 `{ "profiles": [...] }`）
- 行为由 `identity_dna`（archetype / core_values / aggression / diplomacy / creativity）驱动
- 分身根据 trust / affinity / debt / recent_shared_events 调整协商、结盟、复仇与发言

## Treaty 系统

- **no_attack**：互不侵犯条约，违约扣声望和信任
- **joint_attack**：联合攻击条约，对共同目标 +15% 攻击力，联盟方之间自动互不侵犯

条约通过双向提案匹配自动签署，到期自动失效。

## 代码结构

```text
src/
  index.ts              # CLI 入口
  cli.ts                # CLI 解析 + --help
  engine.ts             # 主引擎编排
  engine/               # 引擎子模块
    artDirector.ts      # 艺术方向生成
    artRuntime.ts       # 艺术阶段推进
    canvasRuntime.ts    # 画布操作与冲突解算
    constants.ts        # 默认配置与常量
    decisionService.ts  # 决策请求与回退
    engineContext.ts    # 统一运行时上下文
    scoreboard.ts       # 评分计算
    socialState.ts      # 关系/条约/社交指标
    strategyService.ts  # 策略与身份导向
    twinFactory.ts      # 角色初始化
  llm/                  # LLM 抽象层
    types.ts            # LLMProvider 接口
    deepseekProvider.ts # DeepSeek 实现
    prompts.ts          # 提示词构建
    jsonExtractor.ts    # JSON 提取
  __tests__/            # 测试（bun test）
  decisionNormalizer.ts # schema 修复
  mockAgent.ts          # dry-run 模拟决策
  types.ts              # 核心类型
  viewerServer.ts       # Replay API + 静态服务
viewer/
  src/
    App.tsx             # 布局编排
    hooks/              # useReplayData / usePlaybackControl / useCanvasRenderer
    components/         # BattleCanvas / RoundPulse / ErrorPanel / TwinLens / ...
profiles/               # 数字分身配置
schemas/                # JSON Schema
output/                 # replay 产物
```

引擎四层架构：

- **世界层**：artDirector + artRuntime
- **角色层**：twinFactory + socialState
- **决策层**：decisionService + strategyService
- **执行层**：canvasRuntime + scoreboard

## 开发

```bash
bun run typecheck    # 类型检查
bun test             # 运行测试
bun run viewer:build # 构建 Viewer
```
