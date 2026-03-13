export function FogDrift() {
  return (
    <div className="fog-drift-layer" aria-hidden="true">
      <div
        className="fog-drift-particle"
        style={{ top: "20%" }}
      />
      <div
        className="fog-drift-particle"
        style={{
          top: "60%",
          animationDuration: "45s",
          animationDelay: "-15s",
          opacity: 0.7,
        }}
      />
    </div>
  );
}
