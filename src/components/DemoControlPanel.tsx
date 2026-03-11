export interface DemoControlPanelProps {
  currentRoomId: string;
  audioMode: "nearby" | "focus" | "muted";
  feedPaused: boolean;
  roomSwitchTargets: Array<{ id: string; name: string }>;
  onSwitchRoom: (roomId: string) => void;
  onSetAudioMode: (mode: "nearby" | "focus" | "muted") => void;
  onToggleFeedPaused: () => void;
  onInjectScenario: (scenario: string) => void;
  onResetDemo: () => void;
}

export function DemoControlPanel({
  currentRoomId,
  audioMode,
  feedPaused,
  roomSwitchTargets,
  onSwitchRoom,
  onSetAudioMode,
  onToggleFeedPaused,
  onInjectScenario,
  onResetDemo,
}: DemoControlPanelProps) {
  return (
    <div className="demo-control-panel">
      {roomSwitchTargets.map((room) => (
        <button
          key={room.id}
          type="button"
          className={`control-button ${currentRoomId === room.id ? "is-active" : ""}`}
          aria-pressed={currentRoomId === room.id}
          onClick={() => onSwitchRoom(room.id)}
        >
          Go to {room.name}
        </button>
      ))}

      <button
        type="button"
        className={`control-button ${audioMode === "nearby" ? "is-active" : ""}`}
        onClick={() => onSetAudioMode("nearby")}
      >
        Hear nearby
      </button>
      <button
        type="button"
        className={`control-button ${audioMode === "focus" ? "is-active" : ""}`}
        onClick={() => onSetAudioMode("focus")}
      >
        Focus audio
      </button>
      <button
        type="button"
        className={`control-button ${audioMode === "muted" ? "is-active" : ""}`}
        onClick={() => onSetAudioMode("muted")}
      >
        Mute all
      </button>

      <button
        type="button"
        className="control-button"
        onClick={onToggleFeedPaused}
      >
        {feedPaused ? "Resume feed" : "Pause feed"}
      </button>

      <button
        type="button"
        className="control-button"
        onClick={() => onInjectScenario("wave-over")}
      >
        Inject wave over
      </button>
      <button
        type="button"
        className="control-button"
        onClick={() => onInjectScenario("quiet-room")}
      >
        Simulate quiet room
      </button>
      <button
        type="button"
        className="control-button"
        onClick={() => onInjectScenario("empty-room")}
      >
        Simulate empty room
      </button>

      <button
        type="button"
        className="control-button"
        onClick={onResetDemo}
      >
        Reset demo
      </button>
    </div>
  );
}

export default DemoControlPanel;
