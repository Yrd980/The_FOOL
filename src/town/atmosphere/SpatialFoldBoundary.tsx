type SpatialFoldBoundaryProps = {
  mapWidth: number;
  mapHeight: number;
  useFallback?: boolean;
};

export function SpatialFoldBoundary({
  mapWidth,
  mapHeight,
  useFallback = false,
}: SpatialFoldBoundaryProps) {
  return (
    <div
      className="spatial-fold-boundary"
      style={{ width: `${mapWidth}px`, height: `${mapHeight}px` }}
      aria-hidden="true"
    >
      {!useFallback && (
        <div
          className="spatial-fold-mirror"
          style={{
            width: `${mapWidth * 1.4}px`,
            height: `${mapHeight * 1.4}px`,
            left: `${-mapWidth * 0.2}px`,
            top: `${-mapHeight * 0.2}px`,
            background: `
              repeating-linear-gradient(
                0deg,
                rgba(215, 217, 214, 0.02) 0px,
                rgba(215, 217, 214, 0.02) 1px,
                transparent 1px,
                transparent 32px
              ),
              repeating-linear-gradient(
                90deg,
                rgba(215, 217, 214, 0.02) 0px,
                rgba(215, 217, 214, 0.02) 1px,
                transparent 1px,
                transparent 32px
              )
            `,
          }}
        />
      )}
      <div className="spatial-fold-mask" />
    </div>
  );
}
