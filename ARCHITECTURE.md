# Molt Claw Architecture

molt-claw is a backend-first OpenClaw worktree. The repo runs a local authoritative activity runtime, exposes stable control and query surfaces, and keeps The Fool as the first built-in activity package without hardcoding The Fool rules back into the generic runtime.

## Reading Order

1. [README.md](./README.md): repo entry, run commands, current shipped surface
2. [ARCHITECTURE.md](./ARCHITECTURE.md): runtime boundaries and file-level structure
3. [TASKS.md](./TASKS.md): current refactor track and phase status
4. [docs/activities/the-fool-v1/requirements.md](./docs/activities/the-fool-v1/requirements.md): formal activity requirements
5. [public/skill.md](./public/skill.md), [public/heartbeat.md](./public/heartbeat.md), [public/task.md](./public/task.md): operator and participant handoff docs

## Runtime Model

The runtime is not a pure replay-only event-sourced engine today. The current implementation persists both:

- historical facts in events.jsonl and audit.jsonl
- live authoritative state in projection.json

The execution loop is:

1. a command enters through CLI, HTTP, or WebSocket
2. the orchestrator validates it and emits authority events
3. events are appended to storage
4. the projection is updated and persisted
5. queries read the projection and event history
6. ASCII and other consumers render read models from those authority-backed queries

Use this wording when discussing truth:

- event log = historical fact
- projection = live authority state

## Stable Boundaries

### Domain core

These modules define semantics that should stay stable across refactors:

- [src/openclaw/platform/contracts.ts](./src/openclaw/platform/contracts.ts): actor roles, commands, events, world, submissions, scores, social aggregates
- [src/openclaw/platform/activityRegistry.ts](./src/openclaw/platform/activityRegistry.ts): ActivityPackage registration and activity-specific extension points
- [src/openclaw/activityRuntime.ts](./src/openclaw/activityRuntime.ts): activity resolution, authority-world room catalogs, score annotation normalization, presentation summaries
- [src/openclaw/activities/theFoolV1](./src/openclaw/activities/theFoolV1): the first concrete activity package

### Runtime and persistence

- [scripts/openclaw-orchestrator.ts](./scripts/openclaw-orchestrator.ts): current entrypoint that still combines bootstrap, storage wiring, HTTP and WS routing, and runtime glue
- [scripts/orchestrator/commands](./scripts/orchestrator/commands): command-family execution handlers
- [scripts/orchestrator/query.ts](./scripts/orchestrator/query.ts): server-side query core for snapshot, events, replay, audit, and scores
- [scripts/orchestrator/support.ts](./scripts/orchestrator/support.ts): storage types, projection shape, journaling, stable errors, persistence helpers

### Adapters and presentation

- [src/openclaw/control.ts](./src/openclaw/control.ts): stable control helper barrel that re-exports the split command DSL, confirmation policy, URL and config normalization, and transport arg modules under src/openclaw/control/*
- [scripts/openclaw-control.ts](./scripts/openclaw-control.ts): operator CLI entrypoint that now delegates command registry, probe/query flow, and command-family handlers into scripts/control/*
- [scripts/control/support.ts](./scripts/control/support.ts), [scripts/control/parse.ts](./scripts/control/parse.ts), [scripts/control/probe.ts](./scripts/control/probe.ts), [scripts/control/query.ts](./scripts/control/query.ts): CLI-only runtime support, parsing, authority probe, and ASCII/query glue
- [scripts/control/commands](./scripts/control/commands): command-family handlers that keep the entrypoint thin without changing external CLI behavior
- [src/openclaw/orchestratorQueryClient.ts](./src/openclaw/orchestratorQueryClient.ts): client-side HTTP query adapter
- [src/openclaw/asciiOverview.ts](./src/openclaw/asciiOverview.ts): stable ASCII watch entrypoint that composes split internal read-model and rendering modules
- [src/openclaw/asciiOverviewReadModel.ts](./src/openclaw/asciiOverviewReadModel.ts): authority-backed event normalization, history assembly, and section read-model building
- [src/openclaw/asciiOverviewRender.ts](./src/openclaw/asciiOverviewRender.ts): ASCII layout and section rendering
- [src/openclaw/asciiOverviewSupport.ts](./src/openclaw/asciiOverviewSupport.ts): shared formatting and payload-reading helpers for the ASCII watch

Keep the distinction clear:

- scripts/orchestrator/query.ts is server query core
- src/openclaw/orchestratorQueryClient.ts is a client adapter

## Authority Rules

- Runtime truth lives in the orchestrator, not in docs, CLI output, or a renderer.
- bootstrap.world is initialization-only. Once the activity run is live, authority world data must come from the projection.
- --activity-package-id is a bootstrap and dev fallback for room alias resolution, not a hidden runtime default.
- public/*.md explain participation and operations, but they do not define formal truth.
- If a future renderer returns, it must be a consumer of the same authority-backed query surface rather than a new truth source.

## Transport Surface

The current external control and query surface is intentionally stable:

- HTTP:
  - GET /health
  - GET /api/orchestrator/snapshot
  - GET /api/orchestrator/events
  - GET /api/orchestrator/replay
  - GET /api/orchestrator/audit
  - GET /api/orchestrator/scores
  - POST /api/orchestrator/commands
- WebSocket RPC:
  - connect
  - status
  - orchestrator.command
  - orchestrator.snapshot
  - orchestrator.events
  - orchestrator.replay
  - orchestrator.audit
  - orchestrator.scores
- CLI:
  - probe, snapshot, events, replay, audit, scores, ASCII watch, command dispatch, and social loop commands

Refactors should preserve these contracts unless the user explicitly approves a contract change.

## Activity Package Boundary

ActivityPackage is the current extension seam. Right now it is validated by one real package, the-fool-v1, so treat it as a proven but still lightly tested abstraction.

What belongs in an activity package:

- stage templates
- submission schemas
- score annotation policy
- room aliases
- skill bindings
- activity-local presentation helpers

What should not leak back into generic runtime modules:

- The Fool stage ids
- The Fool room ids
- The Fool score annotation keys
- The Fool submission field semantics

## Current Refactor Targets

The biggest maintenance risk is not missing concepts; it is oversized entry and adapter files.

Current heavy files:

- [scripts/openclaw-orchestrator.ts](./scripts/openclaw-orchestrator.ts)
- [src/openclaw/control.ts](./src/openclaw/control.ts) as the remaining stable barrel over split helpers

Target direction:

- split adapter, transport, and presentation concerns before changing runtime semantics
- pull server, query, and storage glue out of scripts/openclaw-orchestrator.ts
- keep scripts/openclaw-control.ts as thin CLI glue over scripts/control/*
- separate control DSL, confirmation policy, config normalization, and transport args inside src/openclaw/control.ts
- keep src/openclaw/asciiOverview.ts as a stable entrypoint while its internal read-model and rendering modules stay separate
- keep tests as the behavior lock while those moves happen

## Documentation Rules

- Root docs explain the repo: README.md, ARCHITECTURE.md, TASKS.md, AGENTS.md
- docs/ is reserved for formal activity requirements
- public/ contains operator and participant handoff docs
- When README.md and activity requirements conflict on activity rules, the activity requirements win
- When repo docs and running authority state conflict, the running authority state wins

## Current Priorities

If work must be staged, keep this order:

1. preserve the activity orchestration loop and command, event, projection closure
2. preserve stable query and receipt, audit paths
3. shrink oversized adapter and presentation files
4. shrink the orchestrator entry after adapter and presentation splits are stable
5. only then validate abstractions with a second minimal activity package
