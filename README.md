# AI Pixel War (Bun + TypeScript)

全自动 AI 像素大战 MVP：
- 画布对抗（占地 + 进攻 + 防守 + 爆破）
- AI 公开发言 / 私聊 / 条约提案
- 情绪与关系影响行动
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

完整模拟（实时调用 DeepSeek）：

```bash
bun run start
```

自定义参数：

```bash
bun run src/index.ts --rounds=20 --width=96 --height=96 --agents=20 --concurrency=10 --model=deepseek-chat
```

输出 replay 会保存到 `output/replay-*.json`。

## 数字分身（OpenClaw风格）

使用样例分身文件（10个分身）：

```bash
bun run src/index.ts --rounds=20 --width=96 --height=96 --profiles=profiles/openclaw-sample.json --concurrency=10
```

说明：
- `--profiles` 提供分身档案 JSON（数组或 `{ "profiles": [...] }`）
- 若提供 `--profiles`，实际 agent 数量以档案数量为准
- 推荐 `10-30` 个分身时将 `--concurrency` 设为 `8-16`
- replay 中包含 `persona_notes` 与 `round_metrics`，可直接用于“热闹度”可视化

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
  deepseekClient.ts
  engine.ts
  index.ts
  mockAgent.ts
  types.ts
output/
```
