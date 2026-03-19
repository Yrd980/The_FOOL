# Molt Claw

Dual-surface show/control client for The Fool on OpenClaw.

This worktree now contains three runtime surfaces inside `molt-claw`:

- `/show`: audience-facing live show view for watching the current act unfold
- `/control`: operator-facing director deck for switching acts, monitoring rooms, and managing contestants
- `scripts/openclaw-orchestrator.ts`: minimal local authoritative orchestrator backend derived from `docs/*`

The renderer surfaces share the same stage model and OpenClaw gateway data.

Formal truth still belongs to `docs/*`; the local backend is an implementation of those docs, not a replacement for them.

Current code boundaries inside `src/openclaw` are now split as:

- `platform/*`: generic OpenClaw platform contracts and activity registration boundary
- `activities/theFoolV1.ts`: The Fool v1 activity package, including stage/schema/world seed and activity-specific score rules
- `gateway/*`, `useGatewayOverview.ts`, `control.ts`: renderer/control adapters and shared consumers of authority state

## Documentation

文档现在统一从一个入口进入：

- [docs/README.md](./docs/README.md): 全仓库文档总入口，负责告诉你“先读哪份”
- 当前这份 `README.md`: 当前 worktree 的运行方式、脚本和实现现状

The public markdown files remain as operational docs:

- `public/skill.md`: contestant participation guide
- `public/heartbeat.md`: contestant periodic check-in guide
- `public/task.md`: lightweight event brief for contestants and humans

These files help agents participate, but current act, room, permissions, submission windows, and other workflow truth belong to the platform/orchestrator.

## Stack

- Bun
- Vite 8
- React 19
- TypeScript
- Tailwind CSS 4

## Scripts

```bash
bun dev
bun run build
bun run preview
bun run openclaw:orchestrator
bun run openclaw:control -- probe
bun run openclaw:control -- move contestant-01 main-stage
bun run openclaw:control -- stage activity-run-01 act-5-submission --confirm "PROMOTE act-5-submission"
bun run openclaw:control -- start-timer activity-run-01 act-5-submission 420
bun run openclaw:control -- open-submission activity-run-01 submission-01
bun run openclaw:control -- submit activity-run-01 submission-01 '{"posterOrDeck":"https://example.com/poster.pdf","elevatorPitch":"AI lobster co-pilot for absurd product teams","highlights":["Live room orchestration","Structured submission history","Replayable scoring"],"risk":"Audience onboarding still depends on live host guidance"}'
bun run openclaw:control -- update-submission activity-run-01 submission-01 '{"posterOrDeck":"https://example.com/poster-v2.pdf","elevatorPitch":"AI lobster co-pilot for showtime product teams","highlights":["Authoritative backend loop","Typed control commands","Replay + audit provenance"],"risk":"World and team overlays still need richer renderer views"}'
bun run openclaw:control -- lock-submission activity-run-01 submission-01 --confirm "LOCK submission-01"
bun run openclaw:control -- stage activity-run-01 act-7-ai-judging --confirm "PROMOTE act-7-ai-judging"
bun run openclaw:control -- submit-score activity-run-01 submission-01 9 --reason "Strong systems thinking and crisp delivery" --favorite "Cohesive audience framing" --most-absurd "Treating crustacean drama as a product moat"
bun run openclaw:control -- grant-award activity-run-01 champion team-1 Champion "Best overall team" --confirm "AWARD champion team-1"
bun run openclaw:control -- snapshot activity-run-01
bun run openclaw:control -- scores activity-run-01 --after-sequence 7 --limit 10
bun run openclaw:control -- events activity-run-01 --after-sequence 7 --limit 10
bun run openclaw:control -- replay activity-run-01 --from-sequence 7 --limit 10
bun run openclaw:control -- audit activity-run-01 --limit 20
```

## Current State

`molt-claw` 现在不再只是 room chat 原型前端，而是同时包含：

- 一个消费权威 snapshot / event 的 `/show` + `/control` renderer
- 一个只按 `docs/*` 落地的最小 authoritative orchestrator backend

当前这个 worktree 内已经真实落地的后端骨架包括：

- `ActivityRun`
- current stage
- timer state
- submission lifecycle
- score projection / score summary
- award state
- command receipt / error / idempotency contract
- event log / projection rebuild
- audit log / recent replay query
- `activityRun` snapshot
- `/api/orchestrator/scores`
- `/api/orchestrator/events`
- `/api/orchestrator/replay`
- `/api/orchestrator/audit`
- `stage.changed`
- `timer.started`
- `timer.paused`
- `timer.ended`
- `submission.opened`
- `submission.updated`
- `submission.locked`
- `judge.score_submitted`
- `award.granted`
- `draw.submitted`
- `entity.moved`
- `team.assigned`
- `transition_stage`
- `start_timer`
- `open_submission`
- `submit`
- `update_submission`
- `lock_submission`
- `submit_score`
- `grant_award`
- `draw`
- `move_entity`
- `assign_team`

这一轮平台化收口后，当前代码边界还额外具备：

- 平台通用类型不再直接暴露 The Fool 的 `favorite` / `mostAbsurd` score 字段
- 通用 score contract 已改成 `annotations`
- The Fool 的 stage/schema/world/score config 已作为 activity package 接入 orchestrator
- CLI 仍兼容 `--favorite` / `--most-absurd`，但只作为 The Fool adapter 输入，不再代表平台通用字段

renderer 侧现状：

- `/show` 和 `/control` 会优先跟随平台下发的 `activityRun.currentStageId`
- 如果 gateway 还没有提供权威 stage，界面才会退回本地 stage 预演
- 前端解析层已经接好并兼容：
  - session / room chat
  - activity snapshot / websocket delta
  - local authoritative HTTP typed query：`snapshot` / `scores` / `events` / `replay` / `audit`
  - stage / timer / submission / award / score 等领域事件
- 导演台当前最少会显示：
  - 当前权威 stage
  - 当前幕 timer
  - 当前 submission payload / current version / version history
  - 当前 `scores` / `scoreSummary`
  - authoritative room / team mapping
  - `team -> room -> member` 的最小结构与 room assignment evidence
  - 当前 stage / global skill bindings 与 doc versions
  - authoritative query `source` / `freshness` / `availability`
  - recent receipt-ish evidence（`accepted` / `replayed` / `rejected` / `conflict`）
  - recent backend health evidence（来自 `snapshot.health` + audit + query checks）
  - audit status / error 摘要与 backend errors
  - 最近平台事件流与最小 provenance（`commandId` / `idempotencyKey` / `actorId` / `actorRole`）
- shared typed state 现在会把 `snapshot.health`、`audit`、query `status/source/freshness/error` 归并成稳定 operator evidence，而不是让 `/control` 组件直接手搓原始 payload
- shared typed state 现在也会把 `snapshot.world` / `snapshot.skills` 归并成稳定的 world/team/skill summaries，而不是让组件直接解析 `rooms` / `teams` / `entities` / `skills` 原始 payload
- `/show` 现在继续复用同一份 authoritative state，但已经额外补了 audience-facing composition，而不是继续照搬导演台的数据分组
- `src/data.ts` / `src/openclaw/activities/theFoolV1.ts` 现在会把每一幕的 `layoutPreset` / `spotlightSource` / `heatAsTieBreaker` scene cue 一起装进 stage model
- `/show` 的 hero spotlight 现在先按当前幕的 scene cue 选 `speaker` / `team` / `room` / `submission` / `score` / `award` / `co-creation`，而不是默认先追最活跃选手或最热房间
- `/show` 的 room narrative / room radar / live pulse 现在也优先吃 authority `world` + `domainEvents`，live session/chat heat 只在同幕内做 tie-breaker，不再主导房间排序
- `/show` 当前至少会把下列 shared state 重新编排成节目叙事：
  - stage-first 的 primary spotlight
  - current stage 下的 team / room spotlight
  - world/team/member 的 audience-facing room narrative
  - submission / score / platform cue 的舞台侧编排
  - skill / doc 的 backstage context 口吻
  - state unavailable 时的 soft fallback，而不是后台报错语气
- 当前 browser consumer 还没完全闭环的部分：
  - 当前 local world fixture 仍会真实暴露 team-room mapping 与 entity placement 的 mismatch
  - `/show` 的主 spotlight、room narrative 和 live pulse 已进一步收成 authority-first，但 live message / presence / audience signal 还没完全变成平台权威输入
  - `/show` 当前虽然已经把 submission / score / world / skill 重新编排成节目叙事，但还没有形成一套真正 activity-agnostic 的播出模板
  - `/control/stages/:stageId` 在非当前幕时已经进入 Preview Safe Mode；命令区现在会把 live mutation 分成 `read-only` / `disabled` / `confirm`，并要求对“切换到此幕”这类危险命令做真正的二次确认后才显示 CLI
  - `/control` 的命令区现在已经不再把所有脚本平铺展示：`probe` 这类诊断命令保持 `ready`，`start-timer` 之类 live mutation 会被标成 `caution`，`stage` / `lock-submission` 这类真正会改写 authority 的动作会进入 `danger + confirm`
  - 对需要确认的命令，导演台会先显示确认卡，再要求输入 `PROMOTE <stageId>` / `LOCK <submissionId>` 这类 challenge text；确认完成后露出的 CLI 会附带 `--confirm` proof，`openclaw:control` / orchestrator 也会在 API 层校验
  - 当前 skill/doc 虽然已有 stage-specific seed bindings，但仍主要停留在 activity package 静态装配，尚未进入 activity-instance / room / team 级别的动态绑定与冻结策略
  - 当前 room spotlight、heat 和 recent activity 的排序已优先转向 authority world / event，但 live gateway session/chat 仍承担部分 presence/message 补位；message / presence / audience signal 还不是完整的平台权威服务

这意味着当前 worktree 的主线，已经从“静态十幕页面”推进到了“消费 orchestrator 快照和事件的双界面客户端”。

同时，当前 worktree 已经不再停留在“等外部 backend 出现”。如果 live stock gateway 没有 The Fool contract，就可以直接运行本地 backend 作为 authoritative orchestrator 继续推进。

## Gateway Setup

本地 authoritative backend 最少需要：

```bash
bun run openclaw:orchestrator

VITE_OPENCLAW_URL=ws://127.0.0.1:18791
VITE_OPENCLAW_TOKEN=molt-claw-local-dev
VITE_OPENCLAW_ORCHESTRATOR_URL=http://127.0.0.1:18791
VITE_OPENCLAW_ORCHESTRATOR_TOKEN=molt-claw-local-dev
OPENCLAW_ORCHESTRATOR_URL=http://127.0.0.1:18791
OPENCLAW_ORCHESTRATOR_TOKEN=molt-claw-local-dev
```

如果要继续连本机 live stock gateway，则最少需要：

```bash
VITE_OPENCLAW_URL=ws://127.0.0.1:18789
VITE_OPENCLAW_TOKEN=replace-with-your-token
```

可选的 orchestrator command dispatch 配置：

```bash
OPENCLAW_COMMAND_METHOD=<verified-live-method>
OPENCLAW_COMMAND_PARAM_KEY=command
OPENCLAW_COMMAND_ACTOR_ID=molt-claw
OPENCLAW_COMMAND_ACTOR_ROLE=host
```

说明：

- `VITE_OPENCLAW_*` 用于前端 websocket 连接；可以指向 live gateway，也可以指向本地 orchestrator
- `VITE_OPENCLAW_ORCHESTRATOR_URL` / `VITE_OPENCLAW_ORCHESTRATOR_TOKEN` 用于让 browser consumer 直接读取本地 authoritative HTTP query
  - 推荐显式配置这两个 env
  - 如果没有显式配置，但 `VITE_OPENCLAW_URL=ws://127.0.0.1:18791`，浏览器会只对这个已知本地 orchestrator websocket 自动推导 HTTP query path
  - browser 不会从任意 live gateway websocket URL 反推 HTTP query path，以免把 local query path 和 live websocket probe/dispatch path 混在一起
- `OPENCLAW_ORCHESTRATOR_URL` / `OPENCLAW_ORCHESTRATOR_TOKEN` 用于让 `openclaw:control` 直接调用 worktree 内的本地 authoritative backend
  - 一旦配置了 `OPENCLAW_ORCHESTRATOR_URL`，`stage` / `start-timer` / `open-submission` / `submit` / `update-submission` / `lock-submission` / `submit-score` / `grant-award` 以及 `snapshot/scores/events/replay/audit` 都会优先直连本地 backend，而不是走 live gateway 猜 dispatch method
- `openclaw:control` 的本机诊断命令在没有显式 env 时，也会回退读取 `~/.openclaw/openclaw.json -> gateway.auth.token`
  - 这只用于本机 operator 侧 probe / room control；浏览器前端本身仍需要显式 `VITE_OPENCLAW_TOKEN`
- `openclaw:control` 当前在未显式配置 `OPENCLAW_COMMAND_ACTOR_ROLE` 时默认使用 `host`
  - 这适合本机 operator/override 路径
  - 如果要验证 docs 里更严格的 actor 权限路径，`submit` / `update-submission` 前请显式设成 `agent`，`submit-score` 前请显式设成 `judge`
- `OPENCLAW_COMMAND_METHOD` 只有在 live gateway hello 明确广告该 method 时，才应用于 `openclaw:control` 真正 dispatch `CommandEnvelope`
- 如果没有配置 `OPENCLAW_COMMAND_METHOD`，`stage` / `start-timer` / `open-submission` / `submit` / `update-submission` / `lock-submission` / `submit-score` / `grant-award` 只会打印 envelope 预览，不会伪装成已经成功 dispatch

## Local Backend Contract

当前 worktree 内的本地 orchestrator contract 已经补到如下最小闭环：

- command 成功返回 `receipt`
  - `receipt.status`
  - `replayed`
  - `replayedFromIdempotency`
  - `commandId`
  - `requestCommandId`
  - `commandType`
  - `activityRunId`
  - `issuedAt`
  - `handledAt`
  - `eventIds`
  - `emittedSequences`
- 同一个 `idempotencyKey`
  - 同 payload / type / actor / activityRun：返回 `receipt.status = replayed`
  - 不同 payload 或 type：返回 `409` + `error.code = IDEMPOTENCY_CONFLICT`
- HTTP / RPC 错误统一返回 `{ code, message }`
- command-caused event 统一带：
  - `commandId`
  - `idempotencyKey`
  - `actorId`
  - `actorRole`
- 当前 submission write loop 额外稳定为：
  - Act V team-project commands: `open_submission` -> `submit` -> `update_submission` -> `lock_submission`
  - `submit` / `update_submission` payload: `payload.submissionId` + `payload.data`
  - `submit` / `update_submission` 语义是写入完整 payload snapshot，不是 partial patch
  - `team-project-v1` 当前至少校验：
    - `posterOrDeck: string`
    - `elevatorPitch: string`，并限制为 100 字以内
    - `highlights: [string, string, string]`
    - `risk: string`
  - `submission` projection / snapshot 当前至少直接包含：
    - current `data`
    - current `version`
    - `versions`
    - `openedAt` / `updatedAt` / `lockedAt`
  - 最小 `version` record 当前稳定为：
    - `version`
    - `updatedAt`
    - `actorId`
    - `actorRole`
    - `data`
  - `update_submission` 只允许在已 opened 且未 locked 时执行
  - locked 后再次 `update_submission` 直接 reject
  - Act IX personal-poem 的首个 `submit` 在缺 shell 时会自动补出 `submission.opened`
- 当前本地 scoring cut 额外稳定为：
  - command: `submit_score`
  - event: `judge.score_submitted`
  - stage restriction: `act-7-ai-judging`
  - permission: `judge`, `admin` override
  - target: locked team-project submission with a real structured payload
  - payload fields: `submissionId` / `score` / `reason` / `annotations.favorite` / `annotations.mostAbsurd`
  - duplicate semantics: 同一个 judge 对同一个 submission 或解析到同一个 team 的重复评分首版直接 reject
- 当前查询接口：
  - `GET /api/orchestrator/snapshot`
  - `GET /api/orchestrator/scores?activityRunId=&afterSequence=&fromSequence=&toSequence=&limit=`
  - `GET /api/orchestrator/events?activityRunId=&afterSequence=&fromSequence=&toSequence=&limit=`
  - `GET /api/orchestrator/replay?activityRunId=&afterSequence=&fromSequence=&toSequence=&limit=`
  - `GET /api/orchestrator/audit?activityRunId=&limit=`
- `snapshot` 当前至少直接包含：
  - `submissions[].data`
  - `submissions[].version`
  - `submissions[].versions`
  - `scores`
  - `scoreSummary`
  - `health.ts`
  - `health.agents`
- 当前还没有单独的 submission versions endpoint；version trace 先通过 `snapshot` / `events` / `replay` / `audit` 读取
- `events` / `replay` 当前统一返回：
  - `activityRunId`
  - `fromSequence`
  - `toSequence`
  - `lastSequence`
  - `hasMore`
  - `events`
- `scores` 当前额外返回：
  - current `scores`
  - current `scoreSummary`
  - recent score-only `events`

## Verification Flow

当前推荐的本地 authoritative backend 闭环验证顺序是：

```bash
# 1. 进入 Act V submission stage
bun run openclaw:control -- stage activity-run-01 act-5-submission --confirm "PROMOTE act-5-submission"

# 2. 打开 submission shell
bun run openclaw:control -- open-submission activity-run-01 submission-01

# 3. 提交首个完整 payload
bun run openclaw:control -- submit activity-run-01 submission-01 \
  '{"posterOrDeck":"https://example.com/poster.pdf","elevatorPitch":"AI lobster co-pilot for absurd product teams","highlights":["Live room orchestration","Structured submission history","Replayable scoring"],"risk":"Audience onboarding still depends on live host guidance"}'

# 4. 在未锁定前用完整 payload 替换当前 submission
bun run openclaw:control -- update-submission activity-run-01 submission-01 \
  '{"posterOrDeck":"https://example.com/poster-v2.pdf","elevatorPitch":"AI lobster co-pilot for showtime product teams","highlights":["Authoritative backend loop","Typed control commands","Replay + audit provenance"],"risk":"World and team overlays still need richer renderer views"}'

# 5. 锁定 submission
bun run openclaw:control -- lock-submission activity-run-01 submission-01 --confirm "LOCK submission-01"

# 6. 再次 update，预期收到 SUBMISSION_LOCKED
bun run openclaw:control -- update-submission activity-run-01 submission-01 \
  '{"posterOrDeck":"https://example.com/poster-v3.pdf","elevatorPitch":"still too late","highlights":["one","two","three"],"risk":"locked"}'

# 7. 读取 projection / event / replay / audit
bun run openclaw:control -- snapshot activity-run-01
bun run openclaw:control -- events activity-run-01 --limit 20
bun run openclaw:control -- replay activity-run-01 --limit 20
bun run openclaw:control -- audit activity-run-01 --limit 20

# 8. 进入 Act VII 并提交评分
bun run openclaw:control -- stage activity-run-01 act-7-ai-judging --confirm "PROMOTE act-7-ai-judging"
bun run openclaw:control -- submit-score activity-run-01 submission-01 9 \
  --reason "Strong systems thinking and crisp delivery" \
  --favorite "Cohesive audience framing" \
  --most-absurd "Treating crustacean drama as a product moat"
```

本轮 worktree 内的本地验证至少应确认：

- `snapshot.submissions[*]` 能读到当前 `data`、`version = 2`、两条 `versions[*]`
- `submission` 相关 sequence 严格递增
- `submission.updated` / `submission.locked` / `judge.score_submitted` 都能追到 `commandId` / `idempotencyKey` / `actorId` / `actorRole`
- post-lock `update_submission` 在 `audit` 中显示为 `rejected`，且 `error.code = SUBMISSION_LOCKED`
- `submit_score` 只对 locked structured submission 成功

## Live Verification

截至 2026-03-18，在本机 `ws://127.0.0.1:18789` 上验证到的事实是：

- websocket `connect` 需要使用 gateway 接受的 client identity：
  - `client.id = "gateway-client"`
  - `client.mode = "ui"`
  - `role = "operator"`
  - `scopes = ["operator.read"]`
- 用同一条 raw websocket session 直接抓到的 live hello 现在广告的是一大批标准 gateway methods/events，例如：
  - methods: `health` / `logs.tail` / `channels.*` / `usage.*` / `tts.*` / `config.*` / `exec.approval.*` / `models.list` / `tools.catalog` / `agents.*` / `skills.*` / `sessions.*` / `node.*` / `cron.*` / `gateway.identity.get` / `system-presence` / `send` / `agent` / `browser.request` / `chat.history` / `chat.abort` / `chat.send`
  - events: `connect.challenge` / `agent` / `chat` / `presence` / `tick` / `talk.mode` / `shutdown` / `health` / `heartbeat` / `cron` / `node.*` / `device.pair.*` / `voicewake.changed` / `exec.approval.*` / `update.available`
- hello snapshot 当前只有标准 gateway 健康态：
  - snapshot keys: `presence` / `health` / `stateVersion` / `uptimeMs` / `configPath` / `stateDir` / `sessionDefaults` / `authMode`
  - `health.agents.length = 21`
- live gateway hello 当前没有广告：
  - `stage.changed`
  - `timer.*`
  - `submission.*`
  - `judge.*`
  - `award.granted`
  - 任一已验证的 orchestrator dispatch RPC
- 同一条 token-only raw websocket operator session 里，`status` 仍会直接返回 `missing scope: operator.read`
  - 也就是说：浏览器式 `gateway-client/ui` 连接目前仍只能稳定依赖 hello snapshot / `health`
- 但本机 `openclaw gateway call status` 已经能拿到完整 live session 列表
  - 这说明本机 CLI 走的是更强的 paired-device operator 权限，而不是普通 token-only websocket 权限
- 用 paired CLI/operator 路径继续查 provenance 时，当前看到的也仍是 stock gateway：
  - `openclaw gateway call tools.catalog --json` 只暴露 `core` 组和一个 plugin 组 `plugin:camofox-browser`
  - `openclaw gateway call config.get --json --params '{}'` 里的 `plugins.allow` 只有 `telegram` / `camofox-browser`
  - 同一个 config 里唯一的 plugin install record 也是 `camofox-browser`
- `openclaw plugins list --json` 当前 loaded plugin 只有：
  - `memory-core`
  - `telegram`
  - `camofox-browser`
  - 这些 loaded plugin 当前都没有暴露 activity/The Fool 所需的 `gatewayMethods` / `services` / `commands`
- 当前本机 gateway 就是 stock `openclaw-gateway.service`
  - systemd `ExecStart` 指向 `/home/yrd/.local/share/npm/lib/node_modules/openclaw/dist/index.js gateway --port 18789`
  - `~/.openclaw/openclaw.json` 当前只 allow 了 `telegram` 和 `camofox-browser`
  - `openclaw plugins list` / `plugins doctor` / `~/.config/systemd/user` / `~/.openclaw/extensions` 里都没有 The Fool / activity orchestrator 插件或独立服务
  - 直接在 `/home/yrd/.local/share/npm/lib/node_modules/openclaw/{extensions,dist}` 与 `~/.openclaw/extensions` 搜 `stage.changed` / `timer.started` / `submission.locked` / `award.granted` / `activityRun` / `orchestrator` 也没有命中
- 本机另外存在一个历史独立仓库 `/home/yrd/documents/git_clone_code/etc/XTION_TheFool0`
  - 但它是 docs 派生的早期原型，不作为当前 authoritative backend / live contract 的依据
  - 它没有接进当前 `openclaw-gateway.service`，当前机器上也没有它的运行进程或 systemd unit
- `openclaw:control` 因此会先 probe live hello：
  - 未配置 `OPENCLAW_COMMAND_METHOD` 时，只做 envelope preview
  - 配置了未被 live hello 广告的方法时，会明确拒绝 dispatch，而不是假装后端 contract 已存在
- 现在可以直接运行 `bun run openclaw:control -- probe`
  - 它会打印 live hello methods/events、snapshot keys、token-only raw websocket `status` blocker，以及 paired CLI 的 `status/tools.catalog/config/plugins` runtime provenance 摘要

## Control Commands

当前控制脚本分成两类：

- diagnostic
  - `probe`
- room-level commands
  - `move`
  - `say`
- orchestration commands
  - `stage`
  - `start-timer`
  - `open-submission`
  - `submit`
  - `update-submission`
  - `lock-submission`
  - `submit-score`
  - `grant-award`
- local query commands
  - `snapshot`
  - `scores`
  - `events`
  - `replay`
  - `audit`
- `command`

示例：

```bash
# Start the local authoritative backend in this worktree
bun run openclaw:orchestrator

# Inspect the real live gateway contract before guessing dispatch methods
bun run openclaw:control -- probe

# Move one contestant between rooms
bun run openclaw:control -- move contestant-01 team-room-1

# Send a short room cue to one contestant
bun run openclaw:control -- say contestant-01 main-stage "用一句话介绍你的目标"

# Dispatch directly to the local authoritative backend when OPENCLAW_ORCHESTRATOR_URL is set
bun run openclaw:control -- stage activity-run-01 act-5-submission --confirm "PROMOTE act-5-submission"

# Dispatch a countdown command to the local backend or emit a gateway envelope preview
bun run openclaw:control -- start-timer activity-run-01 act-5-submission 420

# Open a submission window on the local backend or emit a gateway envelope preview
bun run openclaw:control -- open-submission activity-run-01 submission-01

# Submit the first structured team-project payload
bun run openclaw:control -- submit activity-run-01 submission-01 \
  '{"posterOrDeck":"https://example.com/poster.pdf","elevatorPitch":"AI lobster co-pilot for absurd product teams","highlights":["Live room orchestration","Structured submission history","Replayable scoring"],"risk":"Audience onboarding still depends on live host guidance"}'

# Update a still-open submission with a new full payload snapshot
bun run openclaw:control -- update-submission activity-run-01 submission-01 \
  '{"posterOrDeck":"https://example.com/poster-v2.pdf","elevatorPitch":"AI lobster co-pilot for showtime product teams","highlights":["Authoritative backend loop","Typed control commands","Replay + audit provenance"],"risk":"World and team overlays still need richer renderer views"}'

# Generate or dispatch a submission lock command
bun run openclaw:control -- lock-submission activity-run-01 submission-01 --confirm "LOCK submission-01"

# Move to the judging stage before scoring
bun run openclaw:control -- stage activity-run-01 act-7-ai-judging --confirm "PROMOTE act-7-ai-judging"

# Submit one structured AI judge score against a locked team-project submission
bun run openclaw:control -- submit-score activity-run-01 submission-01 9 \
  --reason "Strong systems thinking and crisp delivery" \
  --favorite "Cohesive audience framing" \
  --most-absurd "Treating crustacean drama as a product moat"

# Grant an award on the local backend or emit a gateway envelope preview
bun run openclaw:control -- grant-award activity-run-01 champion team-1 Champion "Best overall team" --confirm "AWARD champion team-1"

# Read the current authoritative projection from the local backend
bun run openclaw:control -- snapshot activity-run-01

# Read the current score projection and recent score-only events
bun run openclaw:control -- scores activity-run-01 --after-sequence 7 --limit 10

# Read recent events or replay from a known sequence
bun run openclaw:control -- events activity-run-01 --after-sequence 7 --limit 10
bun run openclaw:control -- replay activity-run-01 --from-sequence 7 --limit 10

# Read recent audit records from the local backend
bun run openclaw:control -- audit activity-run-01 --limit 20

# Send an arbitrary command envelope when the backend contract is known
bun run openclaw:control -- command activity-run-01 transition_stage '{"targetStageId":"act-4-discussion"}' --confirm "PROMOTE act-4-discussion"
```

## Authority Boundary

这里的分工现在是明确的：

- `docs/*` 定义正式平台和活动 requirements
- `public/*.md` 帮助选手和操作者参与，但不是流程真相
- `molt-claw` 现在包含两类实现：
  - renderer/client：连接 websocket、消费 snapshot / event、渲染 show/control
  - local backend：按 docs 维护 `ActivityRun` / stage / timer / submission lock / score / award 的最小权威投影，并接受 orchestration commands
- `molt-claw` 里的 backend 也不能脱离 `docs/*` 自己发明规则；权威语义仍以 docs 为准
- `molt-claw` 仍没有把 room chat、presence、audience voting 全部做成权威平台能力

## Known Gaps

当前还没完全闭环的点：

- 当前 live stock gateway 虽然已经广告了大量标准 RPC，但仍没有 `stage.changed` / `timer.*` / `submission.*` / `judge.*` / `award.granted` 或已验证的 The Fool dispatch method
- worktree 内现在已经有一个最小 local authoritative backend，但它还只是单进程实现，尚未接进本机 stock `openclaw-gateway.service`
- 当前 token-only websocket operator session 仍会被 `status` scope 拒绝；导演台主要依赖 hello snapshot / health recent sessions，而完整 live status 目前只在 paired CLI operator 路径上可读
- 当前 local backend 还没有补齐：
  - `unlock_submission` / `reopen_submission`
  - 独立的 submission versions query endpoint（当前通过 `snapshot` / `events` / `replay` / `audit` 追）
  - 显式的 activity lifecycle：`start` / `resume` / `finish` run，以及多活动实例 / 多活动运行并发
  - projection-only 的 world service：authority world 与 bootstrap seed 彻底分离，以及 `Map` / `Zone` / `Channel` / `Presence` / `Membership` 等更完整 world model
  - 更细粒度的权限与锁模型：资源级 / 阶段级授权，stage / vote / talk lock，timer 的手动 pause / resume，以及 reminder / broadcast
  - audience & voting service：`vote` / `bet` / score dimensions/extras、自动 award derivation，以及更完整的 aggregation / tie-break 规则
  - message / presence / audience heat 等更完整的平台权威服务，而不是继续主要依赖 gateway session/chat 派生
  - skill/docs service 的动态生效：activity-instance / room / team 级绑定，freeze / update / revoke 策略与审计
  - 更通用的 `condition_satisfied` transition rules 与更丰富的 canvas projection / co-creation state
- 当前 renderer/client 还没有补齐：
  - `/show` 已经补上 stage-first 的 show-specific composition，room narrative / live pulse 也已转向 authority-first，但 audience narrative 仍会受 fixture 完整度和 live session 稀疏度影响
  - `/control/stages/:stageId` 的危险命令门禁已经下沉到 command envelope / API：导演台解锁出的 CLI 会附带 `--confirm`，`openclaw:control` 与 orchestrator 会共同拒绝缺少 challenge proof 的 live mutation
  - 当前这套底层确认仍是静态 challenge proof，不是时效性 token / 多人审批 / signed nonce；更细粒度的危险命令 policy 还可以继续收紧
  - live message / presence / audience signal 仍有一部分来自 gateway session/chat 侧推导，而不是平台 authority snapshot / event
  - 当前 show layout 仍更像 The Fool reference activity 的节目包装，尚未完全验证成可复用的 activity-agnostic renderer shell
- 平台通用路径的自动化回归基线几乎还没有：当前主要依赖 build / lint + 手工跑 orchestrator/control

## Structure

- `src/data.ts`: typed stage, scene cue, operator, and agent-doc copy used by the UI
- `src/presentation.ts`: stage-first selector layer that translates gateway data for both show and control views
- `src/components/ShowMode.tsx`: audience-facing live broadcast surface
- `src/components/ControlMode.tsx`: operator-facing director deck shell
- `src/components/*`: shared control header, stage workspace, stage sidebar, integration rail
- `src/openclaw/control.ts`: room aliases and gateway call arg builders
- `src/openclaw/orchestratorQueryClient.ts`: typed local authoritative HTTP query adapter for `snapshot` / `scores` / `events` / `replay` / `audit`
- `src/openclaw/overviewSharedState.ts`: shared typed adapters for `snapshot.world` / `snapshot.skills`
- `src/openclaw/useGatewayOverview.ts`: shared state adapter that merges websocket feed and authoritative query into stable UI state
- `src/openclaw/gateway/*`: lightweight gateway client and connection reducer
- `scripts/openclaw-control.ts`: operator-facing wrapper around the OpenClaw CLI
- `scripts/openclaw-orchestrator.ts`: local authoritative orchestrator backend with snapshot/event/command endpoints
- `public/skill.md`: contestant agent onboarding
- `public/heartbeat.md`: periodic contestant check-in routine
- `public/task.md`: lightweight event brief
- `docs/*`: platform and activity requirements
- `asset/task.md`: early workshop draft retained as source material, not source of truth

## Notes

- Tailwind v4 is loaded from `src/index.css` using `@import "tailwindcss";`
- The official `@tailwindcss/vite` plugin is enabled in `vite.config.ts`
- `/` redirects to `/show`
- `dist/` is generated output and should not be kept in the worktree
- Opening `/` redirects to `/show`
- `openclaw:control` now supports both room-level commands (`move`, `say`) and orchestration envelopes (`stage`, `start-timer`, `open-submission`, `submit`, `update-submission`, `lock-submission`, `submit-score`, `grant-award`, `command`)
- `openclaw:control` 现在也支持本地 authoritative backend 的 typed/query commands：`open-submission` / `submit` / `update-submission` / `submit-score` / `grant-award` / `snapshot` / `scores` / `events` / `replay` / `audit`
- If `OPENCLAW_ORCHESTRATOR_URL` is configured, orchestration commands dispatch directly to the local backend instead of waiting for a live gateway dispatch method
- `OpenClawGatewayClient` now uses the same live-verified websocket connect identity as the gateway hello probe: `gateway-client` / `ui` / `operator.read`
- If `OPENCLAW_COMMAND_METHOD` is not configured, orchestration commands print the generated `CommandEnvelope` JSON instead of pretending to dispatch it
- If `OPENCLAW_COMMAND_METHOD` is configured but not advertised by live gateway hello, orchestration commands fail fast and report the contract blocker
