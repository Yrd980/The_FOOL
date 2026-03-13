import type { AtmosphereLayout } from "./types";
import { CivicProps } from "./CivicProps";
import { UncannyDetails } from "./UncannyDetails";
import { SupernaturalTraces } from "./SupernaturalTraces";
import { FogDrift } from "./FogDrift";
import { SpatialFoldBoundary } from "./SpatialFoldBoundary";
import "./atmosphere.css";

type AtmosphereLayerProps = {
  layout: AtmosphereLayout;
  tileSize: number;
  lowPerformance?: boolean;
};

export function AtmosphereLayer({
  layout,
  tileSize,
  lowPerformance = false,
}: AtmosphereLayerProps) {
  return (
    <div
      className="atmosphere-layer"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <FogDrift />
      <CivicProps items={layout.civic} tileSize={tileSize} />
      <UncannyDetails items={layout.uncanny} tileSize={tileSize} />
      <SupernaturalTraces items={layout.supernatural} tileSize={tileSize} />
      <SpatialFoldBoundary useFallback={lowPerformance} />
      <div className="crt-scanline-overlay" />
    </div>
  );
}
