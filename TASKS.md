# Molt Claw Project Memory

## Current Runtime Shape

- backend-first single-process Bun orchestrator
- command -> event -> projection remains the authoritative closure
- persisted model is event log plus persisted projection, not replay-only event sourcing
- external contracts are stable across CLI, HTTP, and WebSocket
- live operator surface is CLI plus ASCII watch
- only \`the-fool-v1\` is wired as a built-in activity package today
- \`the-fool-v1\` still supports real orchestrator/control execution and authoritative ASCII verification, but the promoted end-to-end run is now the autonomy ingress path
- current branch also adds a real OpenClaw agent ingress path for The Fool through \`scripts/autonomy/*\`
- repo-local automated test files have been removed; verification now centers on real OpenClaw ingress runs plus authority-backed control inspection
- frontend scope is intentionally limited to terminal ASCII observation while autonomy ingress is being closed
- real-run verification should stay on a single local orchestrator/autonomy pair so interrupted sessions do not leave multiple competing bun loops behind

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
- \`scripts/openclaw-autonomy-the-fool.ts\` now drives The Fool through real gateway agents and real orchestrator RPC while keeping the same authoritative command loop
- \`scripts/autonomy/theFoolAutonomy.ts\` now derives room alias resolution from authoritative snapshot truth before issuing real gateway agent calls
- \`src/openclaw/activities/theFoolV1/definition.ts\` now seeds host, judge, and viewer entities directly into the bootstrap world so authority-backed room placement stays available for the full autonomy cast from act-1 onward
- \`scripts/autonomy/theFoolAutonomy.ts\` now resumes unfinished work with a fresh autonomy run id while preserving ledger-completed steps, so rejected commands can be corrected and retried without idempotency conflicts
- real \`act-5-submission\` runs are now aligned to authority validation: \`team-project-v1\` \`elevatorPitch\` must stay at 100 characters or fewer, and retry prompts now reuse the full structured skeleton instead of collapsing back to the subset example
- free-text autonomy coercion now rejects gateway / LLM infrastructure failure strings, so transport-side errors do not get written into authoritative `talk` payloads as if they were valid participant speech
- control/autonomy startup no longer fall back to default orchestrator URL, gateway token reuse, gateway mutation dispatch, bootstrap room catalogs, or implicit activity/template ids; missing authority configuration now fails fast
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
- current promoted real-run entrypoint: \`bun run openclaw:autonomy:the-fool\` drives six real OpenClaw contestant agents plus supporting host/judge/viewer agent workspaces through the same authoritative runtime
- important wording: autonomy is still only an ingress adapter into the authoritative command surface; runtime truth remains in the orchestrator and is inspected through control/query output
- latest single-run recovery evidence on this branch: one recovered orchestrator/autonomy chain resumed at `act-10-open-mic`, completed the remaining close-out talks, and emitted authoritative `activity.finished` with `team-3` settled as winner
- latest clean isolated run evidence on this branch: `the-fool-live-20260323-201254` ran from fresh authority storage through ASCII watch to authoritative `activity.finished`, with `team-3` settled as winner at sequence 107
- latest operator-view evidence on this branch: `openclaw-control ascii` now renders full-run run outcome, per-act checkpoints, pending obligations, dense summary, and closeout capsule from authoritative snapshot/events/replay only
- latest runtime-shape evidence on this branch: local OpenClaw concurrency is now implemented as concurrent prompt generation plus serialized authoritative dispatch inside the same single-orchestrator runtime

## Open Memory

- next architecture validation target is a second minimal real activity package
- that package should validate the runtime boundary itself, not expand product surface
- near-term delivery target on this branch is to stabilize and verify \`bun run openclaw:autonomy:the-fool\` under the new authority-only configuration rules without changing external CLI/HTTP/WebSocket contracts
- next operator-facing polish is to tighten finished-stage rendering and summary density without introducing a second truth source
- next runtime verification task is to run the new prompt-parallel autonomy path against real local OpenClaw gateway credentials and confirm the same single-authority observation chain end to end
