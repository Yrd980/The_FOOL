# Molt Claw Architecture

## Runtime Model

molt-claw is a backend-first authoritative runtime.

The live execution loop is:

1. a command enters through CLI, HTTP, or WebSocket
2. the orchestrator validates it and emits authority events
3. events are appended to storage
4. the projection is updated and persisted
5. queries read the projection and event history
6. terminal and other consumers render read models from authority-backed queries

Current storage model:

- \`events.jsonl\` and \`audit.jsonl\` store historical facts
- \`projection.json\` stores live authority state

Use this wording:

- event log = historical fact
- projection = live authority state

## Architecture Boundaries

### Domain core

- [src/openclaw/platform/contracts.ts](./src/openclaw/platform/contracts.ts): actor roles, commands, events, world, submissions, scores, and social aggregates
- [src/openclaw/platform/activityRegistry.ts](./src/openclaw/platform/activityRegistry.ts): activity package registration and extension seam
- [src/openclaw/activityRuntime.ts](./src/openclaw/activityRuntime.ts): activity resolution, room catalogs, score annotation normalization, and presentation summaries
- [src/openclaw/activities/theFoolV1](./src/openclaw/activities/theFoolV1): first built-in activity package

### Runtime and persistence

- [scripts/openclaw-orchestrator.ts](./scripts/openclaw-orchestrator.ts): thin authority entrypoint that wires the runtime modules together
- [scripts/orchestrator/bootstrap.ts](./scripts/orchestrator/bootstrap.ts): seed projection construction, startup bootstrapping, event-log rebuild, and projection load
- [scripts/orchestrator/projection.ts](./scripts/orchestrator/projection.ts): projection reducers, score summaries, timer folding, and social aggregate recomputation
- [scripts/orchestrator/runtimeLoop.ts](./scripts/orchestrator/runtimeLoop.ts): committed event application, timer scheduling, and automatic stage-transition evaluation
- [scripts/orchestrator/commandShell.ts](./scripts/orchestrator/commandShell.ts): idempotency journal rebuild, replay/conflict handling, and audit shell around fresh command execution
- [scripts/orchestrator/query.ts](./scripts/orchestrator/query.ts): server-side query core for snapshot, events, replay, audit, and scores
- [scripts/orchestrator/server.ts](./scripts/orchestrator/server.ts): HTTP route and WebSocket RPC glue
- [scripts/orchestrator/commands](./scripts/orchestrator/commands): command-family execution handlers
- [scripts/orchestrator/support.ts](./scripts/orchestrator/support.ts): storage helpers, projection types, journaling, and stable error types

### Control and presentation

- [src/openclaw/control.ts](./src/openclaw/control.ts): stable control helper barrel over split control modules
- [scripts/openclaw-control.ts](./scripts/openclaw-control.ts): operator CLI entrypoint
- [scripts/control](./scripts/control): CLI parsing, probe, query, and command-family handlers
- [scripts/autonomy/orchestratorRpc.ts](./scripts/autonomy/orchestratorRpc.ts): WebSocket RPC adapter used by the real-agent autonomy runner
- [scripts/autonomy/theFoolAutonomy.ts](./scripts/autonomy/theFoolAutonomy.ts): The Fool branch-local real-agent ingress loop that builds prompts from authority state and emits authoritative commands
- [scripts/openclaw-autonomy-the-fool.ts](./scripts/openclaw-autonomy-the-fool.ts): autonomy runner entrypoint
- [src/openclaw/orchestratorQueryClient.ts](./src/openclaw/orchestratorQueryClient.ts): client-side HTTP query adapter
- [src/openclaw/asciiOverview.ts](./src/openclaw/asciiOverview.ts): stable ASCII watch entrypoint
- [src/openclaw/asciiOverviewReadModel.ts](./src/openclaw/asciiOverviewReadModel.ts): authority-backed event normalization and section read-model assembly
- [src/openclaw/asciiOverviewRender.ts](./src/openclaw/asciiOverviewRender.ts): ASCII layout and rendering
- [src/openclaw/asciiOverviewSupport.ts](./src/openclaw/asciiOverviewSupport.ts): shared ASCII helpers

The presentation boundary for this repo is intentionally narrow: backend authority plus terminal ASCII observation only. There is no promoted web frontend surface in this worktree.

### Branch-local autonomy ingress

The current branch also carries a real OpenClaw agent ingress path for The Fool. Its intended flow is:

1. autonomy runner reads authority snapshot, event history, and formal activity docs
2. for safe same-stage windows, runner may prompt multiple real OpenClaw gateway agents concurrently from the same baseline authority snapshot
3. runner validates and converts each JSON reply into a normal authoritative command envelope
4. prepared commands are still dispatched serially into the same orchestrator command -> event -> projection loop
5. control queries and ASCII continue to observe the authoritative result
6. on restart, autonomy keeps ledger-completed steps but refreshes its autonomy run id before issuing unfinished commands so recovery does not pin future retries to an old rejected idempotency key
7. free-text fallback coercion must not treat gateway / LLM infrastructure failures as valid participant output; those errors stay in the ingress retry path instead of becoming authoritative talk payloads
8. missing authority state is now a hard failure; ingress must not fall back to bootstrap room catalogs, implicit run ids, or default room placement

This is an ingress adapter, not a second runtime. Runtime truth still lives only in the orchestrator.

## Stable Contracts

### External transport

HTTP:

- \`GET /health\`
- \`GET /api/orchestrator/snapshot\`
- \`GET /api/orchestrator/events\`
- \`GET /api/orchestrator/replay\`
- \`GET /api/orchestrator/audit\`
- \`GET /api/orchestrator/scores\`
- \`POST /api/orchestrator/commands\`

WebSocket RPC:

- \`connect\`
- \`status\`
- \`orchestrator.command\`
- \`orchestrator.snapshot\`
- \`orchestrator.events\`
- \`orchestrator.replay\`
- \`orchestrator.audit\`
- \`orchestrator.scores\`

CLI surface:

- \`probe\`, \`snapshot\`, \`events\`, \`replay\`, \`audit\`, \`scores\`, \`ascii\`, and command dispatch flows

### Authority invariants

- runtime truth lives in the orchestrator, not in docs, CLI output, or a renderer
- \`bootstrap.world\` is initialization-only; live world truth comes from the projection
- activity bootstrap must still seed every actor that autonomy later resolves through authoritative \`snapshot.world\`, including host, judge, and viewer entities used for room placement
- control and autonomy room resolution must come from authoritative \`snapshot.world\`; bootstrap/dev room fallback is no longer part of the live runtime path
- operator mutation dispatch is authority-only; there is no gateway mutation fallback or preview-only downgrade path in the control flow
- local authority startup requires explicit \`OPENCLAW_ACTIVITY_RUN_ID\`, \`OPENCLAW_ACTIVITY_TEMPLATE_ID\`, and \`OPENCLAW_ORCHESTRATOR_TOKEN\`
- real gateway agent calls require explicit `OPENCLAW_GATEWAY_URL` and `OPENCLAW_GATEWAY_TOKEN`; no hidden config fallback remains in control or autonomy
- future renderers must consume the same authority-backed query surface instead of becoming a new truth source
- autonomy ingress must remain an adapter into the same command surface; it must not become a sidecar truth source
- local concurrency is allowed only in pre-dispatch prompt preparation; authority mutations such as stage changes, finish, timers, movement, submission locks, and awards remain serialized
- the promoted real-run entrypoint is the autonomy runner, while authority verification still comes from the same query and control surface
- repo-local automated test suites are not part of the current delivery path; runtime issues are expected to be debugged through one real OpenClaw run at a time plus authority-backed query/ascii inspection

## Activity Package Boundary

Belongs in an activity package:

- stage templates
- submission schemas
- score annotation policy
- room aliases
- skill bindings
- activity-local presentation helpers

Must not leak back into generic runtime modules:

- The Fool stage ids
- The Fool room ids
- The Fool score annotation keys
- The Fool submission field semantics
