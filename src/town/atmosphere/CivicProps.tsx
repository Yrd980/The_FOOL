import type { CivicProp } from "./types";

const CIVIC_GLYPHS: Record<CivicProp["kind"], string> = {
  "lamp-post": "🏮",
  bench: "🪑",
  "notice-board": "📋",
  "queue-barrier": "🚧",
  "trash-can": "🗑",
  "direction-sign": "➡",
  "broadcast-speaker": "📢",
  "warning-stripe": "⚠",
  "utility-pole": "⏚",
};

type CivicPropsProps = {
  items: CivicProp[];
  tileSize: number;
};

export function CivicProps({ items, tileSize }: CivicPropsProps) {
  return (
    <>
      {items.map((item, i) => (
        <div
          key={`civic-${item.kind}-${i}`}
          className={`civic-prop civic-${item.kind}`}
          data-kind={item.kind}
          data-facing={item.facing}
          style={{
            position: "absolute",
            left: `${item.tileX * tileSize}px`,
            top: `${item.tileY * tileSize}px`,
            width: `${tileSize}px`,
            height: `${tileSize}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${tileSize * 0.6}px`,
            pointerEvents: "none",
            zIndex: 10,
          }}
          aria-hidden="true"
        >
          {CIVIC_GLYPHS[item.kind]}
        </div>
      ))}
    </>
  );
}
