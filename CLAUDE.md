# AI Pixel War

## Tech Stack
- Runtime: Bun
- Language: TypeScript (strict mode via tsconfig)
- Frontend: React 18 + Tailwind CSS 4 + Vite
- LLM: LLMProvider interface (default: DeepSeek, via `src/llm/deepseekProvider.ts`)
- Schema Validation: AJV 2020 (`schemas/` directory)
- Package Manager: Bun

## Project Structure
```
src/
  index.ts              # CLI 入口 + 参数解析
  cli.ts                # CLI 解析/验证/帮助工具函数
  engine.ts             # 主引擎编排（PixelWarEngine 类）
  engine/               # 引擎子模块
    artDirector.ts      # 艺术方向生成
    artRuntime.ts       # 艺术阶段推进
    canvasRuntime.ts    # 画布操作与冲突解算
    constants.ts        # 默认配置、调色板、人格模板
    decisionService.ts  # 决策请求与回退
    engineContext.ts    # EngineContext 接口（统一运行时上下文）
    scoreboard.ts       # 评分计算
    socialState.ts      # 关系/条约/社交指标
    strategyService.ts  # 策略提示与身份导向
    twinFactory.ts      # 角色初始化
  llm/                  # LLM 抽象层
    types.ts            # LLMProvider 接口
    deepseekProvider.ts # DeepSeek 实现
    prompts.ts          # Agent 系统/用户提示词构建
    jsonExtractor.ts    # LLM 响应 JSON 提取
  decisionNormalizer.ts # schema 修复与规范化
  mockAgent.ts          # dry-run 模式的模拟决策
  types.ts              # 核心类型定义
  viewerServer.ts       # Replay API + 静态服务
viewer/
  src/
    App.tsx             # 前端主界面（组件化架构，布局编排）
    types.ts            # Viewer 共享类型
    utils.ts            # 工具函数与常量
    hooks/              # 自定义 hooks
      useReplayData.ts  # Replay 加载、轮询、列表管理、筛选
      usePlaybackControl.ts # 回合/步骤播放状态机
      useCanvasRenderer.ts  # Canvas 绘制逻辑
    components/         # UI 组件
      ArtMission.tsx    # 艺术方向展示
      BattleCanvas.tsx  # 画布 + 播放控制
      RoundPulse.tsx    # 回合指标 + 排名（显示角色名）
      ErrorPanel.tsx    # 回合错误面板（按类型着色）
      PublicVoice.tsx   # 公开发言列表
      PrivateWire.tsx   # 私聊消息列表
      PersonaNotes.tsx  # 人格注释列表
      TwinLens.tsx      # Agent 详情卡片
      MetricCard.tsx    # 可复用指标卡片
      RelationCard.tsx  # 可复用关系卡片
profiles/               # 数字分身配置样例
schemas/                # JSON Schema 约束
output/                 # replay 产物目录
docs/superpowers/specs/ # 设计文档
```

## Commands
- `bun run typecheck` — TypeScript 类型检查
- `bun run check` — lint 检查
- `bun run viewer:build` — 构建 Viewer 前端
- `bun audit` — 依赖安全审计
- `bun run start -- --dry-run` — 启动 dry-run 模拟
- `bun run viewer` — 启动 Viewer 服务

## Development Conventions

### Code Style
- 组件文件控制在 300 行以内，超出需拆分
- 纯函数模块优先，方便测试
- 避免 `any`，使用 `unknown` + 类型守卫

### Replay Schema
- 变更 `SimulationResult` 或 `ReplayRound` 结构时，必须：
  1. 同步更新 `PRD.md` 中的相关描述
  2. 更新 `SCHEMA_VERSION`（`src/engine/constants.ts`）
  3. 确保 Viewer 兼容旧格式

### Git
- 当前分支：`pixel_war`
- 提交前运行 `bun run typecheck`
- 提交消息使用 conventional commits 格式

### Testing
- 框架：Bun 内置 test runner（`bun test`）
- 测试文件放在 `src/__tests__/`
- 已覆盖：scoreboard、socialState、canvasRuntime、decisionNormalizer、engine、cli、mockAgent、jsonExtractor

## Key Architecture Notes
- `EngineContext`（`src/engine/engineContext.ts`）统一传递 board/art/color 回调，消除重复 lambda
- `LLMProvider` 接口（`src/llm/types.ts`）抽象 LLM 调用，DeepSeek 为默认实现
- Viewer 采用 hooks + components 组件化架构，App.tsx 仅负责布局编排
- Replay 输出包含 `schema_version`（当前 "1.0"），Viewer 兼容旧格式
- Treaty 系统支持 `no_attack` 和 `joint_attack`（含 +15% 攻击加成与互不侵犯）
- Viewer 错误面板按类型着色显示回合错误
- Replay API 支持按模式/agent 数量筛选（`?mode=dry-run&agents_min=N`）
- 排名面板显示角色名而非 agent ID

## Design Documents
- `PRD.md` — 产品需求文档
- `docs/superpowers/specs/2026-03-12-v0.2-architecture-design.md` — 架构重构设计
- `docs/superpowers/specs/2026-03-12-v0.2-feature-backlog-design.md` — 功能补齐设计
