# Molt Claw

molt-claw is a backend-first OpenClaw worktree. It runs a local authoritative activity runtime and exposes only backend and terminal-facing surfaces:

- scripts/openclaw-orchestrator.ts: local authoritative backend
- scripts/openclaw-control.ts: operator CLI entrypoint
- src/openclaw/asciiOverview.ts: terminal ASCII watch built from authority-backed queries
- src/openclaw/platform/*: generic contracts and activity registry
- src/openclaw/activities/theFoolV1/*: the first built-in activity package

This worktree no longer ships the old rich /show and /control web experience. Runtime truth stays in the orchestrator, not in CLI output, docs, or a renderer.

## Documentation

- [README.md](./README.md): repo entry, run commands, current shipped surface
- [ARCHITECTURE.md](./ARCHITECTURE.md): runtime boundaries, file responsibilities, refactor targets
- [TASKS.md](./TASKS.md): active refactor track
- [docs/README.md](./docs/README.md): formal activity docs entry
- [docs/activities/the-fool-v1/requirements.md](./docs/activities/the-fool-v1/requirements.md): The Fool v1 formal requirements

Public operational handoff files remain under [public/](./public/):

- [public/skill.md](./public/skill.md)
- [public/heartbeat.md](./public/heartbeat.md)
- [public/task.md](./public/task.md)

## Current Shape

- Generic backend and runtime code lives in src/openclaw/platform/*
- Activity extension points live in src/openclaw/platform/activityRegistry.ts and src/openclaw/activityRuntime.ts
- Orchestrator query, transport, audit, snapshot, and command-family handlers live under scripts/orchestrator/*
- scripts/openclaw-orchestrator.ts now stays as a thin authority entrypoint over scripts/orchestrator/*
- Local projection bootstrap and event-log rebuild now live in scripts/orchestrator/bootstrap.ts
- Projection reducers, score summaries, and social aggregate recomputation now live in scripts/orchestrator/projection.ts
- Timer scheduling and automatic stage-transition evaluation now live in scripts/orchestrator/runtimeLoop.ts
- Idempotency replay, conflict handling, and audit shell wiring now live in scripts/orchestrator/commandShell.ts
- HTTP and WebSocket route glue lives under scripts/orchestrator/server.ts so the entrypoint can stay focused on authority wiring
- scripts/openclaw-control.ts now stays as the stable CLI entrypoint over scripts/control/*
- CLI-only glue now lives under scripts/control/*, with support/config helpers in scripts/control/support.ts, command parsing in scripts/control/parse.ts, gateway and orchestrator probing in scripts/control/probe.ts, query and ASCII wiring in scripts/control/query.ts, and command-family handlers under scripts/control/commands/*
- Control-side command helpers keep the stable entrypoint in src/openclaw/control.ts, with the implementation split across src/openclaw/control/*
- Terminal ASCII watch keeps the stable entrypoint in src/openclaw/asciiOverview.ts, with read-model assembly in src/openclaw/asciiOverviewReadModel.ts, ASCII rendering in src/openclaw/asciiOverviewRender.ts, and shared helpers in src/openclaw/asciiOverviewSupport.ts
- Real OpenClaw agent-ingress work for The Fool currently lives under scripts/autonomy/*, with scripts/openclaw-autonomy-the-fool.ts as the runner entrypoint
- Local authority bootstrap requirements live in src/openclaw/localPlatformConfig.ts

Important boundary rules:

- Generic runtime code must not hardcode The Fool stage ids, room ids, or score annotation keys.
- The Fool remains the first built-in activity only via explicit authority startup config.
- bootstrap.world is initialization-only; running world truth comes from the authority projection.
- The Fool bootstrap world must still include every authority-visible actor that autonomy depends on for room placement, including host, judges, and viewers.
- room alias resolution must come from authoritative snapshot.world; bootstrap/dev fallback resolution is no longer part of the runtime path.
- External CLI, HTTP, and WebSocket contracts should stay stable while internal modules are refactored.

## Scripts

~~~bash
bun run build
bun run lint
bun run openclaw:orchestrator
bun run openclaw:autonomy:the-fool
bun run verify:real
bun run openclaw:control -- probe
bun run openclaw:control -- snapshot activity-run-01
bun run openclaw:control -- events activity-run-01 --limit 10
bun run openclaw:control -- ascii activity-run-01 --limit 20 --watch 0.5
bun run openclaw:control -- talk activity-run-01 "I contain multitudes."
bun run openclaw:control -- reaction activity-run-01 clap "wild opener" --target-entity-id contestant-01
bun run openclaw:control -- bet activity-run-01 team team-1 --amount 3 --stance upset-pick
bun run openclaw:control -- vote activity-run-01 team team-1 --value 2 --note "crowd choice"
bun run openclaw:control -- broadcast activity-run-01 "Team draft is now authoritative."
bun run openclaw:control -- stage activity-run-01 act-5-submission --confirm "PROMOTE act-5-submission"
bun run openclaw:control -- lock-submission activity-run-01 submission-01 --confirm "LOCK submission-01"
bun run openclaw:control -- finish activity-run-01 team team-1 --note "authoritative finale" --confirm "FINISH activity-run-01 team:team-1"
~~~

The CLI and query contract is intentionally kept stable while the internal structure is made more generic. Mutation dispatch is now authority-only: operator commands must target this repo's authoritative orchestrator directly and no longer fall back to gateway dispatch or preview-only behavior.

Current verification baseline for this worktree:

- bun run build
- bun run lint
- bun run verify:real
- observe the authoritative result with openclaw-control snapshot/events/ascii
- do not add repo-local test suites unless the user explicitly asks for them
- keep local verification to one orchestrator plus one autonomy runner at a time so interrupted debug sessions do not pile up extra bun processes

Current promoted end-to-end real run on this branch:

- bun run openclaw:autonomy:the-fool  # real OpenClaw agent ingress for the six-contestant full-run path

## Authoritative ASCII Watch

The primary operator-facing runtime view is terminal-first.

- openclaw-control ascii verifies that OPENCLAW_ORCHESTRATOR_URL really points at this repo authoritative orchestrator before it renders anything
- the screen is built from real /api/orchestrator/snapshot, /api/orchestrator/events, and /api/orchestrator/replay
- the console is intended to show The Fool as a whole live run, not just a single stage

The watch currently prioritizes:

- current activity run, template, status, and current stage
- full-run operator capsule: winner, settlement, finish note, podium, and closeout state
- per-act checkpoints across act-1 through act-10
- pending authoritative obligations for the current stage or closeout
- denser full-run summary so an operator can read the entire landing without opening audit logs
- full room occupancy
- all teams and members
- current contestant room placement
- timers, submissions, lock state, scores, awards
- authoritative social snapshot aggregates: audience_heat, bet_heat, reaction totals, vote summary, bet settlements
- recent authoritative event flow
- live social events backed by real authority events: talk, broadcast, reaction, bet, vote
- finished-run visibility via authoritative activity.finished

Verified authority-side command and query surface in this worktree currently includes:

- queries: snapshot, events, replay, audit, scores
- control mutations: stage, start-timer, move-entity, assign-team
- submission loop: open-submission, submit, update-submission, lock-submission
- scoring loop: submit-score, grant-award, finish
- authority-backed social loop: talk, broadcast, reaction, bet, vote
- The Fool v1 real-agent ingress path: `bun run openclaw:autonomy:the-fool` drives real OpenClaw participants into the same authoritative command surface

Current stage-action enforcement worth knowing:

- move-entity now follows stage allowedActions instead of acting as a cross-stage escape hatch
- Act IV and Act IX explicitly allow move so room truth stays authoritative during team discussion and co-creation
- draw remains stage-gated to Act IX only

## Agent Autonomy Ingress

This branch now includes a real OpenClaw agent ingress path for The Fool.

- contestants 01 through 06 map to real same-named OpenClaw agents
- host-01 maps to the real `main` OpenClaw agent workspace
- judges and viewers are currently mapped onto separate real agent workspaces while preserving authoritative actor ids and roles inside the runtime
- the autonomy runner talks to the orchestrator over real WebSocket RPC and talks to OpenClaw through real gateway `agent` calls
- agent output is constrained into JSON actions which are then converted into authoritative command envelopes before entering the runtime
- prompt generation can now run concurrently for safe same-stage windows such as act-1 intros, act-2 preferences, act-4 talks, act-7 judge reasoning, and act-10 closing talks
- authoritative command dispatch stays serialized even when prompt generation is concurrent, so stage transitions, finish, timer control, movement, submission lock/open, and award commands remain single-threaded at the authority boundary
- branch-local ledger state is persisted under `.autonomy/<activity-run-id>/state.json`
- resume semantics are step-aware: completed steps stay in the ledger, while a restarted autonomy process issues fresh command ids for unfinished steps so recovery does not reuse a rejected idempotency key
- real `team-project-v1` submissions currently require `payload.data.elevatorPitch` to stay at 100 characters or fewer; the autonomy runner now aligns its prompt and normalization with that authority rule
- free-text coercion in the autonomy ingress now rejects gateway / LLM infrastructure failure strings instead of writing those raw transport errors back into authoritative participant speech
- authority-side room placement and activity/run selection are now explicit requirements; autonomy no longer falls back to bootstrap room catalogs, implicit run ids, or default room placement when authority state is missing

Important status boundary:

- the promoted real-run entrypoint is `bun run openclaw:autonomy:the-fool`
- autonomy remains an ingress adapter into the same orchestrator truth surface, not a second runtime
- do not describe real-agent ingress as a second authority source; control queries and ASCII remain the way to inspect runtime truth
- frontend scope is intentionally collapsed to authority-backed terminal ASCII only

Typical local run:

~~~bash
OPENCLAW_ACTIVITY_RUN_ID=activity-run-01 \
OPENCLAW_ACTIVITY_TEMPLATE_ID=the-fool-v1 \
OPENCLAW_ORCHESTRATOR_URL=http://127.0.0.1:18791 \
OPENCLAW_ORCHESTRATOR_TOKEN=<local-token> \
OPENCLAW_GATEWAY_TOKEN=<gateway-token> \
bun run openclaw:autonomy:the-fool

OPENCLAW_ACTIVITY_RUN_ID=activity-run-01 \
OPENCLAW_ACTIVITY_TEMPLATE_ID=the-fool-v1 \
OPENCLAW_ORCHESTRATOR_URL=http://127.0.0.1:18791 \
OPENCLAW_ORCHESTRATOR_TOKEN=<local-token> \
bun run openclaw:control -- ascii activity-run-01 --limit 20 --watch 0.5
~~~

Operational note:

- if a local run is interrupted, any leftover \`bun\` processes are ordinary live processes rather than zombies; clean them up before starting the next real-run verification pass
- keep the debug loop to one local orchestrator and one autonomy runner so ASCII observation stays tied to a single authoritative run
- if you resume a partial run, keep the same orchestrator data dir and activityRunId, then restart exactly one autonomy runner against the same ledger instead of opening a second competing loop
- latest recovered single-run evidence on this branch: one authority-backed chain resumed at `act-10-open-mic`, completed the remaining closing talks, emitted `finish_activity`, and wrote authoritative `activity.finished` with `team-3` settled as winner while ASCII stayed aligned end-to-end
- latest clean end-to-end local run evidence on this branch: isolated authority run `the-fool-live-20260323-201254` started from a fresh data dir, rendered through ASCII watch, and finished with authoritative `activity.finished` for `team-3` after all ten acts plus co-creation closeout
- latest full operator-view evidence on this branch: authoritative replay/event inspection for `the-fool-operator-check-20260323` rendered act-1 through act-10 checkpoints, pending obligations, full-run summary, and closeout capsule from the same snapshot/events/replay chain

Current config boundary:

- runtime and debug entrypoints in this worktree only recognize OPENCLAW_* env names
- old browser and Vite-era VITE_OPENCLAW_* fallbacks are no longer supported here
- OPENCLAW_ORCHESTRATOR_URL, OPENCLAW_ORCHESTRATOR_TOKEN, OPENCLAW_ACTIVITY_RUN_ID, and OPENCLAW_ACTIVITY_TEMPLATE_ID are now explicit authority requirements for local authority-backed work
- OPENCLAW_GATEWAY_TOKEN is now explicit for gateway agent calls; control and autonomy no longer read gateway.auth.token from ~/.openclaw/openclaw.json as a hidden fallback
- openclaw-control mutation commands no longer fall back to OPENCLAW_COMMAND_METHOD or gateway-side dispatch when the authoritative orchestrator is not configured
- if a future renderer is rebuilt, it should live as a separate consumer of the same authority and query contracts

## Local Bootstrap

Local authority startup requirements now live in src/openclaw/localPlatformConfig.ts.

Required local authority env:

- OPENCLAW_ACTIVITY_RUN_ID=<run-id>
- OPENCLAW_ACTIVITY_TEMPLATE_ID=<template-id>
- OPENCLAW_ORCHESTRATOR_TOKEN=<authority-token>

Example:

~~~bash
OPENCLAW_ACTIVITY_RUN_ID=activity-run-01
OPENCLAW_ACTIVITY_TEMPLATE_ID=<template-id>
OPENCLAW_ORCHESTRATOR_TOKEN=<authority-token>
~~~

If the configured template is not registered, the orchestrator fails immediately instead of silently borrowing a hidden reference activity.

## Current Limits

The current worktree is intentionally small and backend-first:

- scripts/openclaw-orchestrator.ts is still a single-process local authority, not a full platform deployment
- scripts/orchestrator/* is now the main internal seam for authority bootstrap, runtime loop, command shell, query, audit, snapshot, and transport refactors
- only The Fool is wired as a built-in activity package today
- the live surface is CLI and ASCII only; any future renderer should be a separate consumer of the same authority and query contracts
- the promoted real-run entrypoint is the autonomy runner, while operator inspection still flows through openclaw-control and ASCII queries
- local OpenClaw concurrency is intentionally scoped to prompt preparation windows inside the autonomy adapter; authority command dispatch itself remains serialized
- when checking behavior, prefer real /api/orchestrator/* queries and openclaw-control ascii over documentation assumptions
