# AGENTS.md

本文件作用域覆盖当前仓库全目录。

## 项目目标

- 这是一个基于 Bun + TypeScript 的 AI 像素大战项目。
- 核心体验不是“机械地主动行动”，而是“一群有鲜明人格的数字分身在抢像素地盘、协商、冲突、作画”。
- 行为设计优先保持“像人”的数字分身质感，参考 OpenClaw 风格的人格化分身，而不是简单的职业脚本。

## 技术栈

- 运行时与包管理：`bun`
- 语言：`TypeScript`
- 模块系统：`ESM`
- 校验：`Ajv`
- 前端观战界面：`React + Tailwind CSS + Vite`
- 模型接入：DeepSeek，使用环境变量 `DEEPSEEK_API_KEY`

## 常用命令

- 安装依赖：`bun install`
- 类型检查：`bun run typecheck`
- 干跑模拟：`bun run check`
- 实时模拟：`bun run start`
- 10 人数字分身样例：`bun run crowd`
- 构建 viewer：`bun run viewer:build`
- viewer 开发热更新：`bun run viewer:dev`
- 启动网页观战：`bun run viewer`

默认在提交前至少运行：

- `bun run typecheck`
- `bun run check`

如果改动了网页观战逻辑，额外验证：

- `bun run viewer`
- 打开 `http://localhost:4173`
- 检查 `/health`、`/api/replays`、`/api/latest`

## 目录说明

- `src/index.ts`：CLI 入口，负责解析参数并启动模拟
- `src/engine.ts`：核心回合循环、状态推进、人格驱动决策、replay 生成
- `src/deepseekClient.ts`：DeepSeek API 调用
- `src/decisionNormalizer.ts`：LLM 输出修复与规范化
- `src/types.ts`：核心类型定义，很多地方以这里为准
- `schemas/`：运行时 JSON Schema 校验
- `src/viewerServer.ts`：本地 viewer 服务与 replay API
- `viewer/`：浏览器可视化前端
- `profiles/openclaw-sample.json`：数字分身样例

## 开发约束

- 优先使用 `bun`，不要切回 `npm`、`pnpm` 或引入额外构建工具，除非明确需要。
- 保持 TypeScript 类型、`schemas/*.json`、以及实际运行时行为同步；如果改了一个，检查另外两个是否也要更新。
- 不要硬编码 API Key，不要把密钥写入仓库；仅从环境变量读取 `DEEPSEEK_API_KEY`。
- viewer 现在基于 `React + Tailwind + Vite`，优先沿用当前组件式结构，不要无必要退回原生 DOM 拼接。
- 尽量做小而明确的改动，避免无关重构。

## 人格与行为设计原则

- `identity_dna` 比 `persona` 更重要。若两者冲突，应优先保留数字分身的 DNA 风格一致性。
- 避免新增“如果 persona === 某类型就强行做某动作”的重脚本逻辑，除非用户明确要求。
- “主动性”不应理解为每回合都塞满动作，而应理解为：在能量与局势允许时，更自然地给出 2-3 个合理动作。
- 分身应表现出差异化：说话风格、风险偏好、外交倾向、创作倾向、禁忌、招牌动作都应尽量通过 `identity_dna` 驱动。
- 新增行为逻辑时，优先思考是否能从 `risk_appetite`、`aggression_bias`、`diplomacy_bias`、`creativity_bias`、`core_values` 等字段推导，而不是添加新的硬编码分支。
- 分身之间的协商与敌意应尽量基于“具体对象关系”推进，例如 `trust`、`affinity`、`debt`、`recent_shared_events`，而不是只看全局局势。
- 若新增互动逻辑，优先让双方都能记住事件，避免只有行动发起者有记忆、被影响方却“失忆”。

## 改动建议

- 改模拟核心时，优先查看：`src/types.ts`、`src/engine.ts`、`schemas/`
- 改 LLM 输出稳定性时，优先查看：`src/deepseekClient.ts`、`src/decisionNormalizer.ts`
- 改观战体验时，优先查看：`src/viewerServer.ts`、`viewer/src/App.tsx`、`viewer/src/index.css`、`viewer/index.html`、`viewer/vite.config.ts`
- 改数字分身样例时，保持样例之间有明显人格差异，不要只改名字和颜色
- 改关系/记忆行为时，重点查看：`src/engine.ts` 中 relation 更新、memory 传播、opponent summary 构建，以及 `src/mockAgent.ts` 的 fallback 社交逻辑

## 验收标准

- 能正常生成 replay 到 `output/`
- `bun run typecheck` 通过
- `bun run check` 通过
- 若改 viewer，页面能正常加载并播放 replay
- 若改人格逻辑，`persona_notes` 和回放内容能看出分身差异，而不是趋同

## 提交说明

- 除非用户明确要求，否则不要自动提交 git commit。
- 如果用户要求提交，提交信息应聚焦实际改动范围，例如：
  - `feat: improve replay viewer controls`
  - `feat: deepen digital twin behavior steering`
  - `fix: normalize malformed model decisions`
