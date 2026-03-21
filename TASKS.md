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
- Split [src/openclaw/control.ts](./src/openclaw/control.ts) into narrower internal modules behind a stable barrel entrypoint

### Next

1. Split [src/openclaw/asciiOverview.ts](./src/openclaw/asciiOverview.ts)
- Separate read-model building from ASCII rendering while preserving current integration test output.

2. Shrink [scripts/openclaw-control.ts](./scripts/openclaw-control.ts)
- Reduce the CLI entry to argument parsing, config loading, and dispatch orchestration.

3. Shrink [scripts/openclaw-orchestrator.ts](./scripts/openclaw-orchestrator.ts)
- Move routing, runtime wiring, and storage and query glue into narrower modules after the adapter and presentation split is stable.

4. Re-check runtime boundaries
- Confirm scripts/orchestrator/query.ts stays server-side query core and src/openclaw/orchestratorQueryClient.ts stays a client adapter.

5. Validate abstractions with a second minimal activity package
- Do this only after the current refactor path settles.
- Keep the second package intentionally small so it tests the runtime boundary rather than expanding the product surface.

## Done Definition For Each Refactor Step

- external CLI, HTTP, and WebSocket contracts stay stable
- bun run build, bun run lint, and bun test all pass
- no activity-specific rules leak from the-fool-v1 into generic runtime modules
- repo entry docs still match shipped behavior
