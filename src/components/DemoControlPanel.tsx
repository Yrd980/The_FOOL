import type { ConnectionState } from "../room/gateway/types";

export interface DemoControlPanelProps {
  currentRoomId: string;
  currentRoomName: string;
  currentRoomStatus: string;
  currentUserMode: "perimeter" | "listening";
  audioMode: "nearby" | "focus" | "muted";
  feedPaused: boolean;
  connectionStatus?: ConnectionState;
  roomSwitchTargets: Array<{ id: string; name: string }>;
  onSwitchRoom: (roomId: string) => void;
  onJoinConversation: () => void;
  onLeaveConversation: () => void;
  onSetAudioMode: (mode: "nearby" | "focus" | "muted") => void;
  onToggleFeedPaused: () => void;
  onInjectScenario: (scenario: string) => void;
  onResetDemo: () => void;
}

export function DemoControlPanel({
  currentRoomId,
  currentRoomName,
  currentRoomStatus,
  currentUserMode,
  audioMode,
  feedPaused,
  connectionStatus,
  roomSwitchTargets,
  onSwitchRoom,
  onJoinConversation,
  onLeaveConversation,
  onSetAudioMode,
  onToggleFeedPaused,
  onInjectScenario,
  onResetDemo,
}: DemoControlPanelProps) {
  return (
    <div className="demo-control-panel">
      <div className="control-context">
        <span className="control-context__pill">Current room: {currentRoomName}</span>
        <span className="control-context__pill">Status: {currentRoomStatus}</span>
        <span className="control-context__pill">Hallway guide: {currentUserMode}</span>
      </div>
      {connectionStatus && (
        <span className={`connection-status connection-status--${connectionStatus}`}>
          {connectionStatus === "connected" ? "● Gateway" : connectionStatus === "connecting" || connectionStatus === "reconnecting" ? "◌ Connecting" : "○ Offline"}
        </span>
      )}
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
        aria-pressed={audioMode === "nearby"}
        onClick={() => onSetAudioMode("nearby")}
      >
        Hear nearby
      </button>
      <button
        type="button"
        className={`control-button ${audioMode === "focus" ? "is-active" : ""}`}
        aria-pressed={audioMode === "focus"}
        onClick={() => onSetAudioMode("focus")}
      >
        Focus audio
      </button>
      <button
        type="button"
        className={`control-button ${audioMode === "muted" ? "is-active" : ""}`}
        aria-pressed={audioMode === "muted"}
        onClick={() => onSetAudioMode("muted")}
      >
        Mute all
      </button>

      <button
        type="button"
        className={`control-button ${currentUserMode === "listening" ? "is-active" : ""}`}
        onClick={onJoinConversation}
      >
        Join conversation
      </button>
      <button
        type="button"
        className={`control-button ${currentUserMode === "perimeter" ? "is-active" : ""}`}
        onClick={onLeaveConversation}
      >
        Leave conversation
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
