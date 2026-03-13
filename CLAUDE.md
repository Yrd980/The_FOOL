# AI Pixel War

## Commands
- `bun run typecheck` — 类型检查（提交前必须通过）
- `bun test` — 运行测试
- `bun run viewer:build` — 构建 Viewer
- `bun run start -- --dry-run` — dry-run 模拟
- `bun run viewer` — 启动 Viewer 服务

## Key Constraints
- 变更 `SimulationResult` 或 `ReplayRound` 时，必须同步更新 `SCHEMA_VERSION`（`src/engine/constants.ts`），并确保 Viewer 兼容旧格式
- 组件文件 ≤300 行，超出需拆分
- 避免 `any`，用 `unknown` + 类型守卫
- 测试放 `src/__tests__/`
- Git 分支：`pixel_war`，conventional commits

## Architecture Decisions
- **EngineContext**（`src/engine/engineContext.ts`）统一传递 board/art/color 回调，不要在 engine.ts 中重复构造 lambda
- **LLMProvider**（`src/llm/types.ts`）抽象 LLM 调用，新增模型只需实现接口
- **Treaty** 支持 `no_attack` 和 `joint_attack` 两种类型，joint_attack 含攻击加成和互不侵犯副作用
- Viewer 用 hooks + components 组件化，App.tsx 只做布局编排，不引入状态管理库
- Replay API 支持 `?mode=&agents_min=&agents_max=` 筛选
