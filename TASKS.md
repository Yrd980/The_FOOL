# Molt Claw Project Memory

## Current Runtime Shape

- backend-first single-process Bun orchestrator
- command -> event -> projection remains the authoritative closure
- persisted model is event log plus persisted projection, not replay-only event sourcing
- external contracts are stable across CLI, HTTP, and WebSocket
- live operator surface is CLI plus ASCII watch
- only \`the-fool-v1\` is wired as a built-in activity package today

## Documentation Roles

- \`ARCHITECTURE.md\` = pure architecture description
- \`AGENTS.md\` = guiding principles and constraints for changes
- \`TASKS.md\` = project memory and current state snapshot
- \`docs/\` = formal activity requirements, not repo architecture notes
- \`public/\` = operator and participant handoff material

## Refactor Memory

- repo-level docs were collapsed into root entrypoints
- \`scripts/openclaw-control.ts\` was reduced to a thin CLI entrypoint over \`scripts/control/*\`
- \`src/openclaw/control.ts\` was split into narrower internal modules behind a stable barrel
- \`src/openclaw/asciiOverview.ts\` was split into entrypoint, read-model, render, and support modules
- \`scripts/orchestrator/server.ts\` now owns HTTP and WebSocket route glue
- \`scripts/openclaw-orchestrator.ts\` is now a thin composition entrypoint over:
  - \`scripts/orchestrator/bootstrap.ts\`
  - \`scripts/orchestrator/projection.ts\`
  - \`scripts/orchestrator/runtimeLoop.ts\`
  - \`scripts/orchestrator/commandShell.ts\`

## Verified Boundaries

- \`scripts/orchestrator/query.ts\` is server-side query core
- \`src/openclaw/orchestratorQueryClient.ts\` is client-side query adapter
- authority truth stays in orchestrator storage and projection, not in docs or presentation layers
- generic runtime modules should not absorb The Fool specific ids, room names, or score keys

## Open Memory

- next architecture validation target is a second minimal real activity package
- that package should validate the runtime boundary itself, not expand product surface
