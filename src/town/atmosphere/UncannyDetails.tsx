import type { UncannyDetail } from "./types";

const UNCANNY_GLYPHS: Record<UncannyDetail["kind"], string> = {
  "inconsistent-shadow": "",
  "crack-glow": "⚡",
  "illegible-bulletin": "📄",
  "crt-snow-window": "📺",
  "eternal-phone-booth": "☎",
  "unexplained-tape": "🔴",
  "wrong-vegetation": "🌿",
};

type UncannyDetailsProps = {
  items: UncannyDetail[];
  tileSize: number;
};

export function UncannyDetails({ items, tileSize }: UncannyDetailsProps) {
  return (
    <>
      {items.map((item, i) => (
        <div
          key={`uncanny-${item.kind}-${i}`}
          className={`uncanny-detail uncanny-${item.kind}`}
          data-kind={item.kind}
          style={{
            position: "absolute",
            left: `${item.tileX * tileSize}px`,
            top: `${item.tileY * tileSize}px`,
            width: `${tileSize}px`,
            height: `${tileSize}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${tileSize * 0.5}px`,
            pointerEvents: "none",
            zIndex: 20,
            animationDelay: staggerDelay(item.tileX, item.tileY),
          }}
          aria-hidden="true"
        >
          {UNCANNY_GLYPHS[item.kind]}
        </div>
      ))}
    </>
  );
}

function staggerDelay(tileX: number, tileY: number): string {
  return `${((tileX * 7 + tileY * 13) % 20) * 0.3}s`;
}
