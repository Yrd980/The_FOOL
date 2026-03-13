type FogDriftProps = {
  mapWidth: number;
};

export function FogDrift({ mapWidth }: FogDriftProps) {
  return (
    <div className="fog-drift-layer" aria-hidden="true">
      <div
        className="fog-drift-particle"
        style={{ width: `${mapWidth * 2}px`, top: "20%" }}
      />
      <div
        className="fog-drift-particle"
        style={{
          width: `${mapWidth * 2}px`,
          top: "60%",
          animationDuration: "45s",
          animationDelay: "-15s",
          opacity: 0.7,
        }}
      />
    </div>
  );
}
