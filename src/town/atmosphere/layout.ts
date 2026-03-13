import type { AtmosphereLayout } from "./types";

/**
 * Static atmosphere layout for the cross-intersection town.
 * Tile (0,0) is top-left. Map is ~18×18 tiles.
 *
 * Distribution target: 70% civic / 25% uncanny / 5% supernatural.
 */
export const ATMOSPHERE_LAYOUT: AtmosphereLayout = {
  mapTiles: { cols: 18, rows: 18 },

  civic: [
    { kind: "lamp-post", tileX: 8, tileY: 2, facing: 0 },
    { kind: "lamp-post", tileX: 10, tileY: 2, facing: 0 },
    { kind: "lamp-post", tileX: 8, tileY: 15, facing: 2 },
    { kind: "lamp-post", tileX: 10, tileY: 15, facing: 2 },
    { kind: "lamp-post", tileX: 2, tileY: 8, facing: 3 },
    { kind: "lamp-post", tileX: 15, tileY: 8, facing: 1 },
    { kind: "lamp-post", tileX: 2, tileY: 10, facing: 3 },
    { kind: "lamp-post", tileX: 15, tileY: 10, facing: 1 },
    { kind: "bench", tileX: 7, tileY: 7, facing: 1 },
    { kind: "bench", tileX: 11, tileY: 7, facing: 3 },
    { kind: "bench", tileX: 7, tileY: 11, facing: 1 },
    { kind: "bench", tileX: 11, tileY: 11, facing: 3 },
    { kind: "notice-board", tileX: 10, tileY: 7, facing: 0 },
    { kind: "notice-board", tileX: 7, tileY: 9, facing: 1 },
    { kind: "queue-barrier", tileX: 8, tileY: 8, facing: 0 },
    { kind: "queue-barrier", tileX: 10, tileY: 8, facing: 0 },
    { kind: "queue-barrier", tileX: 8, tileY: 10, facing: 2 },
    { kind: "queue-barrier", tileX: 10, tileY: 10, facing: 2 },
    { kind: "trash-can", tileX: 6, tileY: 8, facing: 0 },
    { kind: "trash-can", tileX: 12, tileY: 10, facing: 0 },
    { kind: "direction-sign", tileX: 7, tileY: 8, facing: 0 },
    { kind: "direction-sign", tileX: 11, tileY: 8, facing: 0 },
    { kind: "direction-sign", tileX: 7, tileY: 10, facing: 0 },
    { kind: "direction-sign", tileX: 11, tileY: 10, facing: 0 },
    { kind: "broadcast-speaker", tileX: 5, tileY: 5, facing: 0 },
    { kind: "broadcast-speaker", tileX: 13, tileY: 5, facing: 0 },
    { kind: "broadcast-speaker", tileX: 5, tileY: 13, facing: 0 },
    { kind: "broadcast-speaker", tileX: 13, tileY: 13, facing: 0 },
    { kind: "warning-stripe", tileX: 4, tileY: 6, facing: 0 },
    { kind: "warning-stripe", tileX: 13, tileY: 6, facing: 0 },
    { kind: "warning-stripe", tileX: 4, tileY: 12, facing: 0 },
    { kind: "warning-stripe", tileX: 13, tileY: 12, facing: 0 },
    { kind: "utility-pole", tileX: 1, tileY: 4, facing: 0 },
    { kind: "utility-pole", tileX: 16, tileY: 4, facing: 0 },
    { kind: "utility-pole", tileX: 1, tileY: 14, facing: 0 },
    { kind: "utility-pole", tileX: 16, tileY: 14, facing: 0 },
  ],

  uncanny: [
    { kind: "inconsistent-shadow", tileX: 8, tileY: 2 },
    { kind: "inconsistent-shadow", tileX: 15, tileY: 10 },
    { kind: "crack-glow", tileX: 9, tileY: 9 },
    { kind: "crack-glow", tileX: 14, tileY: 14 },
    { kind: "crack-glow", tileX: 3, tileY: 11 },
    { kind: "illegible-bulletin", tileX: 10, tileY: 7 },
    { kind: "crt-snow-window", tileX: 3, tileY: 3 },
    { kind: "crt-snow-window", tileX: 9, tileY: 1 },
    { kind: "eternal-phone-booth", tileX: 6, tileY: 9 },
    { kind: "unexplained-tape", tileX: 12, tileY: 7 },
    { kind: "wrong-vegetation", tileX: 5, tileY: 12 },
    { kind: "wrong-vegetation", tileX: 14, tileY: 3 },
  ],

  supernatural: [
    { kind: "plaza-brand-scorch", tileX: 8, tileY: 8, span: { w: 3, h: 3 } },
    { kind: "heat-distortion", tileX: 12, tileY: 12 },
    { kind: "impossible-doorframe", tileX: 15, tileY: 14 },
  ],
};
