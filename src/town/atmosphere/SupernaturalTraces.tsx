import type { SupernaturalTrace } from "./types";

type SupernaturalTracesProps = {
  items: SupernaturalTrace[];
  tileSize: number;
};

export function SupernaturalTraces({ items, tileSize }: SupernaturalTracesProps) {
  return (
    <>
      {items.map((item, i) => {
        const w = (item.span?.w ?? 1) * tileSize;
        const h = (item.span?.h ?? 1) * tileSize;

        return (
          <div
            key={`supernatural-${item.kind}-${i}`}
            className={`supernatural-trace supernatural-${item.kind}`}
            data-kind={item.kind}
            style={{
              position: "absolute",
              left: `${item.tileX * tileSize}px`,
              top: `${item.tileY * tileSize}px`,
              width: `${w}px`,
              height: `${h}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 30,
            }}
            aria-hidden="true"
          >
            {item.kind === "plaza-brand-scorch" && (
              <span
                style={{
                  color: "#D62520",
                  fontSize: `${Math.min(w, h) * 0.7}px`,
                  fontWeight: 900,
                  lineHeight: 1,
                  textShadow: "0 0 8px rgba(214, 37, 32, 0.5)",
                }}
              >
                ✕
              </span>
            )}
            {item.kind === "heat-distortion" && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "rgba(240, 237, 232, 0.03)",
                }}
              />
            )}
            {item.kind === "impossible-doorframe" && (
              <div
                style={{
                  width: "60%",
                  height: "80%",
                  border: "2px solid rgba(118, 130, 125, 0.4)",
                  borderBottom: "none",
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
