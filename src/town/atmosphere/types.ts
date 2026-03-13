/** A positioned element on the town map, in tile coordinates (0-based). */
export type TilePosition = {
  tileX: number;
  tileY: number;
};

/** A civic infrastructure prop (Layer 1). */
export type CivicProp = TilePosition & {
  kind:
    | "lamp-post"
    | "bench"
    | "notice-board"
    | "queue-barrier"
    | "trash-can"
    | "direction-sign"
    | "broadcast-speaker"
    | "warning-stripe"
    | "utility-pole";
  /** Rotation in 90° increments: 0 | 1 | 2 | 3 */
  facing: 0 | 1 | 2 | 3;
};

/** An uncanny detail (Layer 2). */
export type UncannyDetail = TilePosition & {
  kind:
    | "inconsistent-shadow"
    | "crack-glow"
    | "illegible-bulletin"
    | "crt-snow-window"
    | "eternal-phone-booth"
    | "unexplained-tape"
    | "wrong-vegetation";
};

/** A supernatural trace (Layer 3). */
export type SupernaturalTrace = TilePosition & {
  kind:
    | "plaza-brand-scorch"
    | "heat-distortion"
    | "impossible-doorframe";
  /** Width/height in tiles for larger elements like the plaza brand. */
  span?: { w: number; h: number };
};

/** Complete atmosphere layout for the town map. */
export type AtmosphereLayout = {
  civic: CivicProp[];
  uncanny: UncannyDetail[];
  supernatural: SupernaturalTrace[];
  /** Map dimensions in tiles, needed for spatial fold boundary. */
  mapTiles: { cols: number; rows: number };
};
