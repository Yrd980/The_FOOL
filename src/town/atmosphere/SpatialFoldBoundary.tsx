type SpatialFoldBoundaryProps = {
  useFallback?: boolean;
};

export function SpatialFoldBoundary({
  useFallback = false,
}: SpatialFoldBoundaryProps) {
  return (
    <div
      className="spatial-fold-boundary"
      aria-hidden="true"
    >
      {!useFallback && (
        <div
          className="spatial-fold-mirror"
          style={{
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
