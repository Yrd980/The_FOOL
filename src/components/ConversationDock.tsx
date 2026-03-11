import type {
  ContestantOpenClawPresence,
  ContestantScorecard,
  OpenClawContestantState,
} from "../types";

type ContestantSeat = ContestantScorecard &
  ContestantOpenClawPresence & {
    selectionId: string;
    state: OpenClawContestantState;
    stateLabel: string;
    meter: number;
    teamName: string;
    stageNote: string;
    availabilityLabel: string;
    availabilityTone: "available" | "focus" | "busy";
  };

type ConversationDockProps = {
  conversationRoomLabel: string;
  focusHeadline: string;
  conversationNearbyHint: string;
  activeStageOrder: number;
  focusTeamName: string;
  audioMode: string;
  simplifiedView: boolean;
  onlineCount: number;
  speakerSeats: ContestantSeat[];
  selectedEntityId: string;
  onSelectEntity: (selectionId: string) => void;
  onMoveStage: (direction: -1 | 1) => void;
};

function ConversationDock({
  conversationRoomLabel,
  focusHeadline,
  conversationNearbyHint,
  activeStageOrder,
  focusTeamName,
  audioMode,
  simplifiedView,
  onlineCount,
  speakerSeats,
  selectedEntityId,
  onSelectEntity,
  onMoveStage,
}: ConversationDockProps) {
  return (
    <section role="region" aria-label="Conversation dock">
      <header className="speaker-dock">
        <div className="speaker-dock-head">
          <div>
            <span className="tiny-label">{conversationRoomLabel}</span>
            <h2>{focusHeadline}</h2>
            <p>{conversationNearbyHint}</p>
          </div>

          <div className="dock-actions">
            <div className="dock-pills">
              <span className="summary-pill">{`Act ${activeStageOrder}`}</span>
              <span className="summary-pill is-accent">{focusTeamName}</span>
              <span className="summary-pill">{`Audio ${audioMode}`}</span>
              <span className={`summary-pill ${simplifiedView ? "is-accent" : ""}`}>
                {simplifiedView ? "Simple view" : "Rich view"}
              </span>
              <span className="summary-pill">{`${onlineCount} online`}</span>
            </div>
            <div className="stage-switcher">
              <button onClick={() => onMoveStage(-1)} type="button">
                Prev
              </button>
              <button onClick={() => onMoveStage(1)} type="button">
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="speaker-row">
          {speakerSeats.map((seat) => (
            <button
              className={`speaker-seat is-${seat.state} ${
                selectedEntityId === seat.selectionId ? "is-selected" : ""
              }`}
              key={seat.selectionId}
              onClick={() => onSelectEntity(seat.selectionId)}
              type="button"
            >
              <div className="speaker-seat-head">
                <span className="seat-corner">{seat.seatLabel}</span>
                <span className="seat-state">{seat.stateLabel}</span>
              </div>

              <span
                className="seat-token"
                style={{
                  background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.94), ${seat.palette.primary})`,
                }}
              >
                {seat.avatarGlyph}
              </span>

              <span className="seat-copy">
                <strong>{seat.name}</strong>
                <span>{seat.title}</span>
              </span>

              <span className="seat-meter">
                <i style={{ width: `${seat.meter}%` }} />
                <b>{seat.teamName}</b>
              </span>
            </button>
          ))}
        </div>
      </header>
    </section>
  );
}

export default ConversationDock;
