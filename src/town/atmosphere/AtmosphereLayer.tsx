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
  const mapWidth = layout.mapTiles.cols * tileSize;
  const mapHeight = layout.mapTiles.rows * tileSize;

  return (
    <div
      className="atmosphere-layer"
      style={{
        position: "absolute",
        inset: 0,
        width: `${mapWidth}px`,
        height: `${mapHeight}px`,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <FogDrift mapWidth={mapWidth} />
      <CivicProps items={layout.civic} tileSize={tileSize} />
      <UncannyDetails items={layout.uncanny} tileSize={tileSize} />
      <SupernaturalTraces items={layout.supernatural} tileSize={tileSize} />
      <SpatialFoldBoundary
        mapWidth={mapWidth}
        mapHeight={mapHeight}
        useFallback={lowPerformance}
      />
      <div className="crt-scanline-overlay" />
    </div>
  );
}
