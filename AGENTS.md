# Agent Notes

This repository is now a product spec for The Fool Live Room.

Do not preserve or resurrect the old backend-first runtime unless explicitly
asked. The old implementation was intentionally removed.

Current product direction:

- Browser live room first: `/room/:roomRunId`
- Phaser show renderer as the public experience
- The Fool as the first complete show, not a generic platform demo
- Director surface separate from show surface
- Room truth, public snapshots, and show cues as the main product contracts
- Shareable result artifacts as part of the product loop

When adding implementation later, start from the product shape in `SPEC.md`.

Do not treat terminal ASCII, old CLI commands, or old orchestrator route names
as product requirements.

Do not over-abstract into a template marketplace before The Fool is fun as a
single concrete live room.

When editing docs, preserve the distinction between:

- product truth: room commands, events, state, and snapshots
- show performance: Phaser scenes, cues, camera, overlays, and timing
- live direction: controls that protect rhythm, clarity, and taste
