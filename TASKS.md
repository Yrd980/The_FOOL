# Molt Claw Project Memory

## Current Runtime Shape

- backend-first single-process Bun orchestrator
- command -> event -> projection remains the authoritative closure
- persisted model is event log plus persisted projection, not replay-only event sourcing
- external contracts are stable across CLI, HTTP, and WebSocket
- live operator surface is CLI plus ASCII watch
- only \`the-fool-v1\` is wired as a built-in activity package today
- \`the-fool-v1\` now has a real ten-act smoke path through local orchestrator + openclaw-control + ascii verification
- current branch also adds a real OpenClaw agent ingress path for The Fool through \`scripts/autonomy/*\`
- \`bun test\` is intentionally narrowed to real integration tests; helper/read-model/runtime unit tests were removed

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
- \`scripts/openclaw-smoke-the-fool.ts\` now runs a real act-1..act-10 authoritative smoke and is exposed as \`bun run openclaw:smoke:the-fool\`
- \`scripts/openclaw-autonomy-the-fool.ts\` now drives The Fool through real gateway agents and real orchestrator RPC while keeping the same authoritative command loop
- \`scripts/openclaw-autonomy-smoke-the-fool.ts\` now boots a local orchestrator, runs the real-agent autonomy flow, and validates the result with control ascii/snapshot/events
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
- \`move_entity\` is stage-gated; real room relocation is currently validated in \`act-4-discussion\` and \`act-9-co-creation\`, not as a cross-stage override
- autonomy ingress is allowed only as an adapter that emits normal authoritative commands; it must not bypass the orchestrator or create a second source of truth

## Current Phase Boundary

- completed baseline: real orchestrator + real control commands + ASCII observation can drive The Fool from act-1 through act-10 and finish
- current next stage: six real OpenClaw contestant agents plus supporting host/judge/viewer agent workspaces participate through the new autonomy ingress path
- important wording: this branch has autonomy runner code and smoke harness, but that should not be described as fully landed default agent ingress until the autonomy smoke is re-verified as part of the baseline

## Open Memory

- next architecture validation target is a second minimal real activity package
- that package should validate the runtime boundary itself, not expand product surface
- near-term delivery target on this branch is to stabilize and verify \`bun run openclaw:autonomy:smoke:the-fool\` without changing external CLI/HTTP/WebSocket contracts
