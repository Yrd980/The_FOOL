// src/components/TownOverlay.tsx

type TownOverlayProps = {
  locationLabel: string;
  onlineCount: number;
  activeStageOrder: number;
  connectionStatus?: string;
};

function TownOverlay({
  locationLabel,
  onlineCount,
  activeStageOrder,
  connectionStatus,
}: TownOverlayProps) {
  const statusClass = connectionStatus === "connected"
    ? "town-overlay__dot--connected"
    : connectionStatus === "reconnecting"
      ? "town-overlay__dot--reconnecting"
      : "town-overlay__dot--disconnected";

  return (
    <div className="town-overlay town-overlay--top">
      <div className="town-overlay__panel">
        <div className="town-overlay__title">
          <span className="town-overlay__crimson-icon" />
          {locationLabel}
        </div>
      </div>
      <div className="town-overlay__panel town-overlay__status">
        <span className={`town-overlay__dot ${statusClass}`} />
        <span>{onlineCount} online</span>
        <span>Act {activeStageOrder}</span>
      </div>
    </div>
  );
}

export default TownOverlay;
