# AI Pixel War

## Tech Stack
- Runtime: Bun
- Language: TypeScript (strict mode via tsconfig)
- Frontend: React 18 + Tailwind CSS 4 + Vite
- LLM: DeepSeek API (default provider, via `src/deepseekClient.ts`)
- Schema Validation: AJV 2020 (`schemas/` directory)
- Package Manager: Bun

## Project Structure
```
src/
  index.ts              # CLI 入口 + 参数解析
  engine.ts             # 主引擎编排（PixelWarEngine 类）
  engine/               # 引擎子模块
    artDirector.ts      # 艺术方向生成
    artRuntime.ts       # 艺术阶段推进
    canvasRuntime.ts    # 画布操作与冲突解算
    constants.ts        # 默认配置、调色板、人格模板
    decisionService.ts  # 决策请求与回退
    scoreboard.ts       # 评分计算
    socialState.ts      # 关系/条约/社交指标
    strategyService.ts  # 策略提示与身份导向
    twinFactory.ts      # 角色初始化
  deepseekClient.ts     # LLM API 客户端 + prompt 构建
  decisionNormalizer.ts # schema 修复与规范化
  mockAgent.ts          # dry-run 模式的模拟决策
  types.ts              # 核心类型定义
  viewerServer.ts       # Replay API + 静态服务
viewer/
  src/App.tsx           # 前端主界面（待拆分组件化）
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
  2. 更新 `schema_version`（待实现）
  3. 确保 Viewer 兼容旧格式

### Git
- 当前分支：`pixel_war`
- 提交前运行 `bun run typecheck`
- 提交消息使用 conventional commits 格式

### Testing（待建设）
- 框架：Bun 内置 test runner（`bun test`）
- 测试文件放在 `src/__tests__/`
- 优先覆盖：scoreboard、socialState、canvasRuntime、decisionNormalizer

## Key Architecture Notes
- `engine.ts` 中的 `mythColorForPoint` 回调在多处重复传递（V0.2 计划用 EngineContext 统一）
- `viewer/src/App.tsx` 为 1140 行单文件（V0.2 计划拆分为组件化架构）
- DeepSeek 是唯一 LLM 提供者（V0.2 计划抽象为 LLMProvider 接口）
- Treaty 系统仅实现 `no_attack`，`joint_attack` 在类型中定义但无执行逻辑

## Design Documents
- `PRD.md` — 产品需求文档
- `docs/superpowers/specs/2026-03-12-v0.2-architecture-design.md` — 架构重构设计
- `docs/superpowers/specs/2026-03-12-v0.2-feature-backlog-design.md` — 功能补齐设计
