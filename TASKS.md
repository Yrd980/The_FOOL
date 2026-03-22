# Molt Claw Tasks

This file tracks the active refactor line for this worktree. Keep it short, current, and grounded in shipped behavior.

## Verification Baseline

- bun run build
- bun run lint
- bun test

## Status

### Done

- Collapse repo-level docs into root entrypoints
- Keep docs/ focused on formal activity requirements
- Clarify that molt-claw is a backend-first authoritative runtime
- Shrink [scripts/openclaw-control.ts](./scripts/openclaw-control.ts) into a thin CLI entrypoint over scripts/control/*
- Split [src/openclaw/control.ts](./src/openclaw/control.ts) into narrower internal modules behind a stable barrel entrypoint
- Split [src/openclaw/asciiOverview.ts](./src/openclaw/asciiOverview.ts) into a stable entrypoint over separate read-model, render, and helper modules while preserving the current integration test output
- Extract HTTP and WebSocket route glue from [scripts/openclaw-orchestrator.ts](./scripts/openclaw-orchestrator.ts) into [scripts/orchestrator/server.ts](./scripts/orchestrator/server.ts) while keeping external transport contracts stable

### Next

1. Shrink [scripts/openclaw-orchestrator.ts](./scripts/openclaw-orchestrator.ts)
- Continue moving runtime wiring and storage and query glue into narrower modules after the route transport split is stable.

2. Re-check runtime boundaries
- Confirm scripts/orchestrator/query.ts stays server-side query core and src/openclaw/orchestratorQueryClient.ts stays a client adapter.

3. Validate abstractions with a second minimal activity package
- Do this only after the current refactor path settles.
- Keep the second package intentionally small so it tests the runtime boundary rather than expanding the product surface.

## Done Definition For Each Refactor Step

- external CLI, HTTP, and WebSocket contracts stay stable
- bun run build, bun run lint, and bun test all pass
- no activity-specific rules leak from the-fool-v1 into generic runtime modules
- repo entry docs still match shipped behavior
