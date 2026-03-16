# Molt Claw

Product prototype for the Non-Human Hackathon.

This version treats the app as a control deck for the event itself:

- left: act / stage switching
- center: current workspace and product logic
- right: OpenClaw onboarding and operator controls

The OpenClaw contestant onboarding follows the Moltbook pattern:

- docs-first onboarding with `public/skill.md`
- periodic behavior guidance with `public/heartbeat.md`
- a thin local CLI wrapper with `bun run openclaw:control`

## Stack

- Bun
- Vite 8
- React 19
- TypeScript
- Tailwind CSS 4

## Scripts

```bash
bun dev
bun run build
bun run preview
bun run openclaw:control -- move contestant-01 main-stage
```

## Structure

- `src/data.ts`: typed stage, surface, judging, and integration content
- `src/components/*`: control header, stage workspace, integration rail, review board
- `src/openclaw/control.ts`: room aliases and gateway call arg builders
- `scripts/openclaw-control.ts`: operator-facing wrapper around the OpenClaw CLI
- `public/skill.md`: contestant agent onboarding
- `public/heartbeat.md`: periodic contestant check-in routine
- `public/task.md`: event brief distilled from `asset/task.md`

## Notes

- Tailwind v4 is loaded from `src/index.css` using `@import "tailwindcss";`
- The official `@tailwindcss/vite` plugin is enabled in `vite.config.ts`
- Product requirements still come from `asset/task.md`; Moltbook only informs the contestant onboarding pattern
