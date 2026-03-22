# Molt Claw Agent Notes

## Repo Identity

- This repo is a backend-first authoritative runtime, not a frontend-led app.
- Keep the single-process Bun orchestrator model unless the user explicitly asks to change it.
- Preserve the command -> event -> projection loop as the core execution path.
- Do not move runtime truth into CLI output, ASCII views, docs, or activity templates.

## Contract Boundaries

- Keep external CLI, HTTP, and WebSocket behavior stable during internal refactors.
- Treat public/*.md as operator and participant handoff docs, not formal truth.
- Repo-level implementation and architecture docs belong at the repo root.
- Formal activity docs belong under docs/activities/.
- If autonomy ingress work exists on the branch, keep it as an adapter into the same authoritative command surface rather than a second runtime.
- Do not describe branch-local autonomy smoke as completed default six-agent ingress unless it has been re-verified and promoted into the baseline.

## Verification

- Run bun run build, bun run lint, and bun test after meaningful changes.
- Prefer real /api/orchestrator/* behavior and integration tests over documentation confidence.

## Refactor Guardrails

- Split adapter, transport, and presentation concerns before changing runtime semantics.
- Validate abstractions with minimal scope; do not introduce a heavier plugin framework without a second real activity package proving the need.
