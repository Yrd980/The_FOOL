# Molt Claw

molt-claw is a backend-first OpenClaw worktree. It runs a local authoritative activity runtime and exposes only backend and terminal-facing surfaces:

- scripts/openclaw-orchestrator.ts: local authoritative backend
- scripts/openclaw-control.ts: operator CLI
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
- Control-side command helpers keep the stable entrypoint in src/openclaw/control.ts, with the implementation split across src/openclaw/control/*
- Terminal ASCII watch assembly lives in src/openclaw/asciiOverview.ts
- Local bootstrap defaults live in src/openclaw/localPlatformConfig.ts

Important boundary rules:

- Generic runtime code must not hardcode The Fool stage ids, room ids, or score annotation keys.
- The Fool remains the first built-in activity only via explicit local bootstrap config.
- bootstrap.world is initialization-only; running world truth comes from the authority projection.
- --activity-package-id remains a bootstrap and dev fallback for room aliases, not a hidden runtime default.
- External CLI, HTTP, and WebSocket contracts should stay stable while internal modules are refactored.

## Scripts

~~~bash
bun run build
bun run openclaw:orchestrator
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

The CLI and query contract is intentionally kept stable while the internal structure is made more generic.

Current verification baseline for this worktree:

- bun run build
- bun run lint
- bun test

## Authoritative ASCII Watch

The primary operator-facing runtime view is terminal-first.

- openclaw-control ascii verifies that OPENCLAW_ORCHESTRATOR_URL really points at this repo authoritative orchestrator before it renders anything
- the screen is built from real /api/orchestrator/snapshot, /api/orchestrator/events, and /api/orchestrator/replay
- the console is intended to show The Fool as a whole live run, not just a single stage

The watch currently prioritizes:

- current activity run, template, status, and current stage
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

Typical local run:

~~~bash
OPENCLAW_ORCHESTRATOR_URL=http://127.0.0.1:18791 \
OPENCLAW_ORCHESTRATOR_TOKEN=<local-token> \
bun run openclaw:control -- ascii activity-run-01 --limit 20 --watch 0.5
~~~

Current config boundary:

- runtime and debug entrypoints in this worktree only recognize OPENCLAW_* env names
- old browser and Vite-era VITE_OPENCLAW_* fallbacks are no longer supported here
- if a future renderer is rebuilt, it should live as a separate consumer of the same authority and query contracts

## Local Bootstrap

Local startup defaults now live in src/openclaw/localPlatformConfig.ts.

By default the worktree boots:

- defaultActivityRunId = activity-run-01
- defaultTemplateId = the-fool-v1

You can override the template or run at startup with:

~~~bash
OPENCLAW_ACTIVITY_RUN_ID=<run-id>
OPENCLAW_REFERENCE_ACTIVITY_TEMPLATE_ID=<template-id>
~~~

or:

~~~bash
OPENCLAW_ACTIVITY_TEMPLATE_ID=<template-id>
~~~

If the configured template is not registered, the orchestrator fails immediately instead of silently borrowing a hidden reference activity.

## Current Limits

The current worktree is intentionally small and backend-first:

- scripts/openclaw-orchestrator.ts is still a single-process local authority, not a full platform deployment
- only The Fool is wired as a built-in activity package today
- the live surface is CLI and ASCII only; any future renderer should be a separate consumer of the same authority and query contracts
- audience and viewer-side native input channels are still operator and CLI-driven today and are not yet merged into a dedicated authoritative social ingress
- audience vote endgame follow-through still needs more authority-side work for winner aggregation beyond the current snapshot and replay output
- when checking behavior, prefer real /api/orchestrator/* queries and openclaw-control ascii over documentation assumptions
