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

- Run bun run build and bun run lint after meaningful changes.
- Prefer a real OpenClaw ingress run plus authority-backed control/ascii observation over repo-local test suites.
- Prefer real /api/orchestrator/* behavior plus authority-backed control/ascii observation over documentation confidence.
- Do not add new repo-local test files or test harnesses unless the user explicitly asks for them.
- When the user asks to continue autonomy ingress closure, debug by running the backend directly and observing with \`openclaw-control ascii\`, not by rebuilding any frontend surface.
- Keep local verification to one orchestrator and one autonomy runner at a time; interrupted runs should be cleaned up before starting another pass.

- If local concurrency is extended, keep it on prompt preparation only unless the user explicitly changes the authority-serialization boundary.

## Current Delivery Bias

- Default to backend direct-run debugging for autonomy ingress.
- The only operator-facing presentation surface to keep evolving in this repo is terminal ASCII output.
- Do not build or reintroduce a web frontend unless the user explicitly changes direction.

## Refactor Guardrails

- Split adapter, transport, and presentation concerns before changing runtime semantics.
- Validate abstractions with minimal scope; do not introduce a heavier plugin framework without a second real activity package proving the need.
