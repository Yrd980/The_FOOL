# Findings & Decisions

## Requirements
- 用户希望“生成这个项目的 PRD 文件”
- 需要基于当前仓库内容产出，而不是泛化模板
- 最终交付物应直接落在项目内，便于后续继续维护

## Research Findings
- 已确认仓库协作规范要求：复杂任务需启用 `planning-with-files`
- 已确认当前会话没有可恢复的历史上下文输出
- 项目根目录存在 `src`、`viewer`、`schemas`、`profiles`、`output` 等目录，说明仓库同时包含核心逻辑、前端查看器、数据结构约束和样例配置
- 仓库技术栈以 Bun/TypeScript 为主，关键文件包括 `package.json`、`tsconfig.json` 和 `viewer/vite.config.ts`
- 当前没有现成的 PRD 或 docs 目录，新增 PRD 放在项目根目录会更直接
- 项目名为 `AI Pixel War`，README 将其定义为“全自动 AI 像素大战 MVP”
- 核心体验由两部分组成：像素领地/作画对抗，以及 AI 角色之间的公开发言、私聊、结盟与情绪关系演化
- 支持两种运行模式：`--dry-run` 的离线模拟，以及依赖 DeepSeek API 的实时决策模式
- CLI 支持 `rounds / width / height / agents / concurrency / profiles / myth / model` 等参数，说明产品同时支持玩法配置、主题设定和角色档案接入
- 前端 Viewer 用于回放 replay，能够展示像素画布、社交信息、人格注释、回合指标和关系透镜
- README 明确将当前阶段定义为 MVP，PRD 需要区分“已实现能力”和“未来演进方向”
- `src/types.ts` 显示产品核心实体包括 `AgentState`、`IdentityDNA`、`Emotion`、`Relation`、`Treaty`、`TurnDecision` 与 `ReplayRound`
- 系统不只是“抢地盘”，还把情绪变化、记忆事件、盟约提案、私聊、公聊和艺术方向纳入统一回合决策
- `PixelWarEngine` 负责完整 orchestration：初始化画布与角色、生成艺术方向、校验 schema、并发请求决策、执行动作、产出 replay 与最终排名
- 回放数据包含 `art_phase`、`canvas_updates`、`action_steps`、`public_messages`、`private_messages`、`persona_notes`、`round_metrics`、`social_metrics`、`social_snapshot` 与 `highlights`
- Viewer 前端不是静态结果页，而是具备轮询最新 replay、构建逐回合 frame、展示代理目录和关系信息的观战应用
- `socialState` 模块会在事件发生后动态调整 `trust / affinity / debt`，并进一步推导 `tension`、最强联结、最热对立和社交指标
- 社交指标已被产品化为 `alliance_links`、`rivalry_links`、`max_tension`、`avg_trust`、`avg_debt` 等可视化数据
- `viewerServer` 暴露 `/api/replays`、`/api/latest`、`/api/replay/:name`、`/health`，说明产品已有基础数据服务层
- Viewer 支持 API-only 模式和静态资源服务，意味着产品既能本地观战，也具备拆分前后端部署的基础能力
- 在重新读取 `task_plan.md` 时，发现文件中保留了一段旧的发布跟进记录；它与本次 PRD 任务无直接冲突，当前保持原样不动
- `profiles/openclaw-sample.json` 提供了 10 个示例数字分身档案，字段覆盖 `archetype`、价值观、表达风格、风险偏好、攻击/外交/创意倾向和 `goal_weights`
- 样例分身证明本产品支持“人格可配置的角色池”，并且能把人格参数映射到行为和艺术偏好
- `output/` 目录中已经积累大量 replay 文件，说明该项目具备持续跑模拟和保存结果的使用方式
- 最新 replay 示例显示输出中包含 `config`、`art_direction`、`ranking`、`final_highlights` 和多轮 `replay` 数据，可支撑观战、分析和复盘
- 最新示例采用 64x64、8 回合、6 个 agent 的 dry-run 配置，并自动生成神话主题、配色、motif 与分区说明
- 已基于以上证据生成项目级 PRD，内容覆盖产品定位、用户、范围、功能需求、数据/API、非功能要求、指标、风险与路线图
- 完成一次人工自检，确认 PRD 中“当前已实现范围”与仓库主干能力一致，新增建议项均被明确标识为后续方向

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 使用项目内 markdown 文件保存规划过程 | 符合仓库的 AGENTS.md 约束 |
| 先从 README、`package.json` 和 `src/index.ts` 还原产品目标 | 这些文件通常最能代表项目定位、运行方式和功能入口 |
| PRD 应围绕“模拟引擎 + 回放观战 + 数字分身配置”三大模块组织 | 这三个部分已经在 README 和脚本中形成稳定产品结构 |
| PRD 需要把“叙事可视化”列为核心价值，而不只是技术展示 | 当前数据结构和前端设计明显强调过程可解释性与社交戏剧性 |
| PRD 中应增加“数据输出与 API”章节 | Viewer server 已经形成可被产品消费的接口能力 |
| PRD 文件命名为 `PRD.md` 并放在项目根目录 | 仓库目前没有 docs 目录，根目录放置最便于查找和协作 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `task_plan.md` 中存在与本次任务无关的旧发布记录 | 保留原内容，避免覆盖潜在用户上下文；本次仅在相关区域继续更新 |

## Resources
- `~/.codex/skills/planning-with-files/SKILL.md`
- `task_plan.md`
- `findings.md`
- `progress.md`
- `README.md`
- `package.json`
- `src/`
- `viewer/`
- `src/index.ts`
- `src/types.ts`
- `src/engine.ts`
- `viewer/src/App.tsx`
- `src/engine/socialState.ts`
- `src/viewerServer.ts`
- `profiles/openclaw-sample.json`
- `output/replay-2026-03-09T14-36-35-930Z.json`
- `PRD.md`

## Visual/Browser Findings
- 本任务暂无图片、PDF 或浏览器内容需要记录

## 2026-03-09 Publish Follow-up Findings

- 当前功能主题是“像素画逐动作回放”，核心改动已经在代码里完成。
- 发布前检查已通过：`bun audit`、`bun run typecheck`、`bun run check`、`bun run viewer:build`。
- 已创建分支：`feat/pixel-replay-action-steps`。
- 已配置远程：`origin -> git@github.com:Yrd980/The_FOOL.git`。
- 已创建本地提交：`e6708a9 feat: add action-step pixel replay`。
- 本次提交只包含功能代码文件：`src/engine.ts`、`src/engine/canvasRuntime.ts`、`src/types.ts`、`viewer/src/App.tsx`。
- 未纳入提交的本地工作区项包括：`AGENTS.md` 删除、`task_plan.md`、`findings.md`、`progress.md`。
- `git push` 首次尝试卡在 SSH 阶段；后续 `ssh -T github.com:22`、`ssh -T ssh.github.com:443`、`git ls-remote https://github.com/...` 均在超时窗口内无输出返回，说明当前环境到 GitHub 的出站连通性不可用。

## 2026-03-09 Publish Rename Findings

- 用户要求将分支名简化为 `pixel_war`，因为这只是系统的一部分内容，不适合用完整 feature 描述作为分支名。
- 当前仓库状态包含额外未跟踪文件 `PRD.md`，本次仅处理 Git 分支名与网络连通性，不会动该文件。
- 当前本地分支已成功重命名为 `pixel_war`。
- GitHub 连通性已恢复：
- `ssh -T git@github.com` 返回 “Hi Yrd980! You've successfully authenticated...”
- `ssh -T -p 443 git@ssh.github.com` 也成功认证
- `git ls-remote https://github.com/Yrd980/The_FOOL.git HEAD` 退出码为 `0`
- 已成功执行 `git push -u origin pixel_war`。
- 当前远程跟踪状态为 `pixel_war...origin/pixel_war`。
- 推送后的工作区仍保留未提交项：`AGENTS.md` 删除、`task_plan.md`、`findings.md`、`progress.md`、`PRD.md`。

## 2026-03-09 Unified Commit Findings

- 当前剩余未提交内容全部是文档/协作文件层面的变更，而不是运行时代码。
- 待统一提交的范围包括：新增 `PRD.md`，重写/更新 `task_plan.md`、`findings.md`、`progress.md`，以及删除 `AGENTS.md`。
- `AGENTS.md` 删除会改变仓库未来的本地协作说明范围，因此本次统一提交不仅是文档新增，也包含仓库协作约束的移除。
- 发布前检查结果：
- `bun audit`：通过，无已知漏洞。
- `bun run typecheck`：通过。
