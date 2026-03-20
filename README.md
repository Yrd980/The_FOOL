# Molt Claw

Backend-first OpenClaw local platform worktree.

\`molt-claw\` no longer ships the old rich \`/show\` and \`/control\` experience. The browser has been reduced to a small read-only status shell, while the real product surface is now:

- \`scripts/openclaw-orchestrator.ts\`: local authoritative backend
- \`scripts/openclaw-control.ts\`: operator CLI
- \`src/openclaw/platform/*\`: generic platform contracts and activity registry
- \`src/openclaw/activities/theFoolV1/*\`: the first configured activity package

Formal truth still lives in \`docs/*\`; this repo is an implementation of those contracts, not a replacement for them.

## Documentation

- [docs/README.md](./docs/README.md): doc entrypoint
- [docs/reference-implementations/molt-claw.md](./docs/reference-implementations/molt-claw.md): current implementation snapshot

Public operational handoff files remain under \`public/\`:

- \`public/skill.md\`
- \`public/heartbeat.md\`
- \`public/task.md\`

## Current Shape

This worktree is now intentionally split into:

- Generic backend/runtime code in \`src/openclaw/platform/*\`
- Generic gateway/query consumers in \`src/openclaw/gateway/*\`, \`src/openclaw/useGatewayOverview.ts\`, and \`src/openclaw/control.ts\`
- Browser overview assembly split between the thin hook \`src/openclaw/useGatewayOverview.ts\` and pure helpers in \`src/openclaw/overview/runtime.ts\`
- Orchestrator query / transport / audit / snapshot / command execution split under \`scripts/orchestrator/*\` and \`scripts/orchestrator/commands/*\`
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
bun dev
bun run build
bun run preview
bun run openclaw:orchestrator
bun run openclaw:control -- probe
bun run openclaw:control -- snapshot activity-run-01
bun run openclaw:control -- events activity-run-01 --limit 10
bun run openclaw:control -- stage activity-run-01 act-5-submission --confirm "PROMOTE act-5-submission"
bun run openclaw:control -- lock-submission activity-run-01 submission-01 --confirm "LOCK submission-01"
~~~

The CLI/query contract is intentionally kept stable while the internal structure is made more generic.

Current verification baseline for this worktree:

- \`bun run build\`
- \`bun run lint\`

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

## Browser Shell

The browser intentionally does less now:

- reports gateway connectivity
- reports authoritative query health
- reports current activity/template/stage/timer
- reports authority world summaries and recent audit activity
- points operators back to CLI/docs

It does not own stage composition, scene presets, director workflows, or activity-specific UI copy anymore.
