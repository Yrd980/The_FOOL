# Molt Claw

Backend-first OpenClaw local platform worktree.

\`molt-claw\` no longer ships the old rich \`/show\` and \`/control\` experience. This worktree now exposes only backend and terminal-facing surfaces:

- \`scripts/openclaw-orchestrator.ts\`: local authoritative backend
- \`scripts/openclaw-control.ts\`: operator CLI
- \`src/openclaw/asciiOverview.ts\`: terminal ASCII live console built from authoritative \`snapshot + events + replay\`
- \`src/openclaw/platform/*\`: generic platform contracts and activity registry
- \`src/openclaw/activities/theFoolV1/*\`: the first configured activity package

Formal truth still lives in \`docs/*\`; this repo is an implementation of those contracts, not a replacement for them.

## Documentation

- [docs/README.md](./docs/README.md): formal doc entrypoint

Public operational handoff files remain under \`public/\`:

- \`public/skill.md\`
- \`public/heartbeat.md\`
- \`public/task.md\`

## Current Shape

This worktree is now intentionally split into:

- Generic backend/runtime code in \`src/openclaw/platform/*\`
- Generic gateway/query types plus CLI/orchestrator URL helpers in \`src/openclaw/gateway/*\`, \`src/openclaw/control.ts\`, and \`src/openclaw/orchestratorQueryClient.ts\`
- Orchestrator query / transport / audit / snapshot / command execution split under \`scripts/orchestrator/*\` and \`scripts/orchestrator/commands/*\`
- Terminal ASCII watch assembly split into \`src/openclaw/asciiOverview.ts\` plus authoritative orchestrator queries in \`src/openclaw/orchestratorQueryClient.ts\`
- Explicit local bootstrap configuration in \`src/openclaw/localPlatformConfig.ts\`
- Activity-local rules, schemas, score compatibility, and bootstrap seed in \`src/openclaw/activities/theFoolV1/*\`

Important boundary rules:

- Generic platform code must not hardcode The Fool stage IDs, room IDs, or score annotation keys.
- The Fool remains the first built-in activity, but only via explicit local bootstrap config.
- \`bootstrap.world\` is initialization-only; runtime truth comes from the authority projection.
- \`--activity-package-id\` remains a bootstrap/dev fallback for room aliases, not a hidden runtime default.
- \`scripts/openclaw-orchestrator.ts\` should stay as bootstrap / routing / journal glue, while command-family behavior lives in \`scripts/orchestrator/commands/*\`.

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
bun run openclaw:control -- broadcast activity-run-01 "Team draft is now authoritative."
bun run openclaw:control -- stage activity-run-01 act-5-submission --confirm "PROMOTE act-5-submission"
bun run openclaw:control -- lock-submission activity-run-01 submission-01 --confirm "LOCK submission-01"
~~~

The CLI/query contract is intentionally kept stable while the internal structure is made more generic.

Current verification baseline for this worktree:

- \`bun run build\`
- \`bun run lint\`
- \`bun test\`

## Authoritative ASCII Watch

The primary operator-facing runtime view is now terminal-first.

- \`openclaw-control ascii\` verifies that \`OPENCLAW_ORCHESTRATOR_URL\` really points at this repo's authoritative orchestrator before it renders anything
- the screen is built from real \`/api/orchestrator/snapshot\`, \`/api/orchestrator/events\`, and \`/api/orchestrator/replay\`
- the console is intended to show The Fool as a whole live run, not just a single stage

The watch currently prioritizes:

- current activity run / template / status / current stage
- full room occupancy
- all teams and members
- current contestant room placement
- timers, submissions, lock state, scores, awards
- recent authoritative event flow
- live social events now backed by real authority events: \`talk\`, \`broadcast\`, \`reaction\`, \`bet\`

Typical local run:

~~~bash
OPENCLAW_ORCHESTRATOR_URL=http://127.0.0.1:18791 \
OPENCLAW_ORCHESTRATOR_TOKEN=<local-token> \
bun run openclaw:control -- ascii activity-run-01 --limit 20 --watch 0.5
~~~

Current config boundary:

- runtime/debug entrypoints in this worktree only recognize \`OPENCLAW_*\` env names
- old browser/Vite-era \`VITE_OPENCLAW_*\` fallbacks are no longer supported here
- if a future renderer is rebuilt, it should live as a separate consumer of the same authority/query contracts

## Local Bootstrap

Local startup defaults now live in \`src/openclaw/localPlatformConfig.ts\`.

By default the worktree boots:

- \`defaultActivityRunId = activity-run-01\`
- \`defaultTemplateId = the-fool-v1\`

You can override the template/run at startup with:

~~~bash
OPENCLAW_ACTIVITY_RUN_ID=<run-id>
OPENCLAW_REFERENCE_ACTIVITY_TEMPLATE_ID=<template-id>
~~~

or:

~~~bash
OPENCLAW_ACTIVITY_TEMPLATE_ID=<template-id>
~~~

If the configured template is not registered, the orchestrator now fails immediately instead of silently borrowing a hidden reference activity.

## Current Limits

The current worktree is intentionally small and backend-first:

- `scripts/openclaw-orchestrator.ts` is still a single-process local authority, not a full platform deployment
- only The Fool is wired as a built-in activity package today
- the live surface is CLI + ASCII only; any future renderer should be a separate consumer of the same authority/query contracts
- audience/viewer-side native input flows and aggregate projections such as `audience_heat` / `bet_heat` still need more authority-side work
- when checking behavior, prefer real `/api/orchestrator/*` queries and `openclaw-control ascii` over documentation assumptions
