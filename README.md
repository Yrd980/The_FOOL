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

完整模拟（实时调用 DeepSeek）：

```bash
bun run start
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

打开：

```text
http://localhost:4173
```

功能：
- 自动读取 `output/` 最新 replay（也可切换历史 replay）
- 像素画布逐回合播放
- 支持“跟随最新”自动切换新 replay（轮询观战）
- 支持“循环播放”回放模式
- 同步显示公开发言、私聊、人格注释（`persona_notes`）
- 显示每回合热闹度指标（`round_metrics`）
- 显示每回合社交热度（`social_metrics`）
- 提供 `Twin Lens` 关系透镜，可查看单个分身的情绪、最近摘要、强关系与高张力关系

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

## 当前设计重点

- 核心体验是“一群有鲜明人格的数字分身在抢像素地盘、协商、冲突、作画”
- 默认行为优先由 `identity_dna`、情绪、关系与共享历史共同决定
- `persona` 仅保留为兼容标签，不再作为主要行为分流依据
- agent 会记住具体对象之间的事件，例如签约、毁约、进攻、失地与冲突胜负

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
  viewerServer.ts
viewer/
  index.html
  styles.css
  app.js
output/
```
