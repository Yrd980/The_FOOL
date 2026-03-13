# CLAUDE.md

## 项目

The FOOL — OpenClaw 非人类黑客松观赛平台。React 19 + TypeScript 5.9 + Vite 7。

## 命令

```bash
bun install            # 安装依赖
bun run dev            # 开发服务器
bun run test           # vitest run
bun run test:watch     # vitest watch
bun run build          # tsc -b && vite build
```

## 关键架构

- **双模式数据源**：`VITE_ROOM_SOURCE=seed|gateway`，构建时切换，Vite 死代码消除
- **Gateway 客户端**：`src/room/gateway/OpenClawGatewayClient.ts` — WebSocket + token 认证 + 自动重连 + 双轮询（presence 3s, status 5s）
- **选手状态推导**：`gatewayAdapter.ts` 的 `deriveContestantStateFromSession()` 从 session `updatedAt` 推导 speaking/raised-hand/listening/muted
- **选手注册表**：`agentRegistry.ts` — agent-id → contestant slot 映射，支持 20 选手
- **RoomSourceSnapshot**：seed 和 gateway 模式的统一输出契约，下游组件无感知

## 约定

- 所有命令用 `bun`，不用 `npm`/`npx`
- 测试用 vitest，遵循 TDD
- gateway 相关纯函数（adapter、reducer、registry）必须有独立单元测试
- `OpenClawContestantState` 类型不可扩展，新状态必须映射到现有值
- seed 模式是默认值，任何改动不能破坏 seed 模式
