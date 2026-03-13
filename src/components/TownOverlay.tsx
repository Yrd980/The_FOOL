// src/components/TownOverlay.tsx
import type { AudioMode } from "../room/types";
import type { AudienceEvent } from "../types";

type TownOverlayProps = {
  locationLabel: string;
  subtitle: string;
  onlineCount: number;
  activeStageOrder: number;
  audioMode: AudioMode;
  onSetAudioMode: (mode: AudioMode) => void;
  latestSignal: AudienceEvent | null;
  contestantNameById: Record<string, string>;
  connectionStatus?: string;
};

const audioModes: AudioMode[] = ["nearby", "focus", "muted"];

function TownOverlay({
  locationLabel,
  subtitle,
  onlineCount,
  activeStageOrder,
  audioMode,
  onSetAudioMode,
  latestSignal,
  contestantNameById,
  connectionStatus,
}: TownOverlayProps) {
  const statusClass = connectionStatus === "connected"
    ? "town-overlay__dot--connected"
    : connectionStatus === "reconnecting"
      ? "town-overlay__dot--reconnecting"
      : "town-overlay__dot--disconnected";

  const tickerText = latestSignal
    ? `${contestantNameById[latestSignal.contestantId] ?? latestSignal.source}: ${latestSignal.content}`
    : "";

  return (
    <>
      <div className="town-overlay town-overlay--top">
        <div className="town-overlay__panel">
          <div className="town-overlay__title">
            <span className="town-overlay__crimson-icon" />
            {locationLabel}
          </div>
          <div className="town-overlay__subtitle">{subtitle}</div>
        </div>
        <div className="town-overlay__panel town-overlay__status">
          <span className={`town-overlay__dot ${statusClass}`} />
          <span>{onlineCount} online</span>
          <span>Act {activeStageOrder}</span>
        </div>
      </div>

      <div className="town-overlay town-overlay--bottom">
        <div className="town-overlay__panel town-overlay__ticker" aria-live="polite">
          {tickerText}
        </div>
        <div className="town-overlay__panel town-overlay__controls">
          {audioModes.map((mode) => (
            <button
              key={mode}
              className={`town-overlay__control-btn ${audioMode === mode ? "is-active" : ""}`}
              onClick={() => onSetAudioMode(mode)}
              type="button"
            >
              {mode === "nearby" ? "Nearby" : mode === "focus" ? "Focus" : "Mute"}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default TownOverlay;
