# Task Plan

## Goal
Build a runnable JavaScript MVP for AI pixel war using DeepSeek API, managed with Bun, including JSON-schema validation, round loop, and Git-friendly project setup.

## Scope
- Create minimal engine skeleton (state, turn loop, narration/judge placeholders)
- Integrate DeepSeek chat-completions client via `DEEPSEEK_API_KEY`
- Add JSON Schemas and runtime validation with Ajv
- Use TypeScript for stronger compile-time checks
- Add docs for fish shell env setup and run steps
- Add Git project basics (`.gitignore`, clean structure)

## Phases
| Phase | Status | Notes |
|---|---|---|
| 1. Inspect workspace and recover context | completed | Session catchup run, workspace is empty |
| 2. Scaffold Bun project and dependencies | completed | Bun direction set, dependencies initialized |
| 3. Implement TypeScript core + DeepSeek client | completed | TS source, schema validation, DeepSeek client wired |
| 4. Add docs and git management files | completed | Added README, `.gitignore`, and initialized git repo |
| 5. Validate run and summarize | completed | `bun run typecheck` and `bun run check` pass |
| 6. Harden live JSON conformance | completed | Added structured-output forcing, normalization, retry repair, and coordinate bounding |
| 7. Add frontline action hints | completed | Added dynamic candidate generation and prompt wiring; live run verified |
| 8. Add digital-twin personality system | completed | Introduced identity DNA, DNA-driven steering, and replay persona notes |
| 9. Scale to 10-30 crowd mode | completed | Added profile loading, decision concurrency, and round heat metrics |
| 10. Add web visualization | completed | Added browser viewer + local server + replay API; added follow-latest/loop watch controls and re-validated endpoint playback |
| 11. Reduce persona-centered behavior | completed | Made persona optional, shifted defaults/mock behavior to DNA-driven logic, and expanded opponent identity summaries |
| 12. Add person-specific interaction memory | completed | Shared events now propagate to both sides, relations evolve from incidents, and prompts/fallbacks can reason about shared history |
| 13. Visualize social memory in viewer | completed | Added replay social snapshots/metrics and a viewer Twin Lens panel for bonds, rivalries, and last-round summaries |
| 14. Migrate viewer to React + Tailwind | completed | Rebuilt viewer with Vite React/Tailwind, preserved Bun replay API flow, and validated build plus `bun run viewer` serving |
| 15. Add viewer dev workflow | completed | Added Vite hot-reload mode with Bun API-only server and proxy-backed `bun run viewer:dev` |
| 16. Ensure final canvas becomes full pixel art | completed | Added brush-style paint, exact canvas replay updates, and final-round canvas resolve so the last frame reaches full coverage |
| 17. Add Myth Mode art director | completed | Added shared myth art direction, theme-driven palette/zone guidance, art-aware prompts, and aesthetic scoring |
| 18. Reduce Myth Mode artifact noise | completed | Replaced noisy per-pixel myth coloring with a shared target canvas, quantized palette, and target-guided painting hints |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| `rg --files` exited 1 in empty dir | 1 | Treated as expected for empty workspace |
| Tooling direction changed npm → Bun mid-task | 1 | Adjusted plan and will migrate scripts/deps to Bun |
| Combined shell command rejected by policy (`rm` + `bun install`) | 1 | Split into smaller safe commands and retry with non-destructive flow |
| Ajv runtime error: draft-2020 schema not recognized | 1 | Switch engine validator from default Ajv to Ajv2020 |
| Fish syntax failed under `/bin/sh` wrapper when sourcing secrets | 1 | Read env via `fish -c` and inject into bash command |
| Coordinate normalization defaulted missing values to (0,0) | 1 | Made coordinate parsing strict and bounded coordinates to canvas |
| Typecheck error for `Bun` global in viewer server | 1 | Add Bun types and include `bun` type in tsconfig |
| TS widened mock action literals to `string` | 1 | Added `as const` on mock priority action literals |
| Shell smoke test command hit quote mismatch while parsing asset path | 1 | Replaced fragile `rg` quote pattern with `grep`-based extraction |
