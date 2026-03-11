import type {
  AudienceEvent,
  ContestantOpenClawPresence,
  ContestantScorecard,
  OpenClawContestantState,
} from "../types";

type SelectionKind = "contestant" | "judge" | "ai" | "listener";

type SidebarEntity = {
  selectionId: string;
  refId: string;
  kind: SelectionKind;
  group: string;
  name: string;
  subtitle: string;
  status: string;
  badge: string;
  accent: string;
  avatar: string;
  searchable: string;
  x?: number;
  y?: number;
};

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

type AudioMode = "nearby" | "focus" | "muted";

type SpatialRoomFloorProps = {
  conversationTitle: string;
  activeStageTitle: string;
  activeStageObjective: string;
  activeStageDeliverables: string[];
  focusTeamName: string;
  focusTeamTheme: string;
  conversationSubtitle: string;
  conversationHostLabel: string;
  audibleSignals: AudienceEvent[];
  contestantMap: Record<string, ContestantScorecard>;
  listenerEntities: SidebarEntity[];
  openClawSeats: ContestantSeat[];
  selectedEntityId: string;
  onSelectEntity: (selectionId: string) => void;
  miniLegend: Record<string, string>;
  roomCallout: string;
  audioMode: AudioMode;
  simplifiedView: boolean;
  priorityContestantId: string | null;
  onSetAudioMode: (mode: AudioMode) => void;
  onToggleSimplifiedView: () => void;
  onClearPriorityContestant: () => void;
};

function SpatialRoomFloor({
  conversationTitle,
  activeStageTitle,
  activeStageObjective,
  activeStageDeliverables,
  focusTeamName,
  focusTeamTheme,
  conversationSubtitle,
  conversationHostLabel,
  audibleSignals,
  contestantMap,
  listenerEntities,
  openClawSeats,
  selectedEntityId,
  onSelectEntity,
  miniLegend,
  roomCallout,
  audioMode,
  simplifiedView,
  priorityContestantId,
  onSetAudioMode,
  onToggleSimplifiedView,
  onClearPriorityContestant,
}: SpatialRoomFloorProps) {
  return (
    <section className="world-stage" role="region" aria-label="Spatial room floor">
      <div className="stage-glow" />
      <div className="room-floor" />
      <div className="conversation-ring" />

      <article className="scene-note">
        <span className="tiny-label">{conversationTitle}</span>
        <strong>{activeStageTitle}</strong>
        <p>{activeStageObjective}</p>
        <div className="chip-row compact">
          {activeStageDeliverables.slice(0, 3).map((deliverable) => (
            <span className="chip" key={deliverable}>
              {deliverable}
            </span>
          ))}
        </div>
      </article>

      <article className="signal-card">
        <span className="tiny-label">Room signals</span>
        <strong>{focusTeamName}</strong>
        <div className="signal-list">
          {audibleSignals.length > 0 ? (
            audibleSignals.map((event) => {
              const contestantName = contestantMap[event.contestantId]?.name ?? "\u672A\u77E5\u9009\u624B";

              return (
                <div className={`signal-item signal-item--${event.type}`} key={event.id}>
                  <div className="signal-item-head">
                    <strong>{contestantName}</strong>
                    <span>{event.timestampLabel}</span>
                  </div>
                  <p>{event.content}</p>
                </div>
              );
            })
          ) : (
            <div className="signal-empty">Muted mode is on. No nearby room audio.</div>
          )}
        </div>
      </article>

      <div className="room-banner">
        <div>
          <span className="tiny-label">{conversationSubtitle}</span>
          <strong>{conversationTitle}</strong>
          <p>{conversationHostLabel}</p>
        </div>
        <div className="banner-pills">
          <span>{focusTeamName}</span>
          <span>{focusTeamTheme}</span>
        </div>
      </div>

      <div className="zone-legend">
        <span className="zone-pill zone-pill--mic">Mic lane</span>
        <span className="zone-pill zone-pill--queue">Queue rail</span>
        <span className="zone-pill zone-pill--nearby">Listener orbit</span>
      </div>

      <div className="room-prop room-prop--board" />
      <div className="room-prop room-prop--console" />
      <div className="room-prop room-prop--bench-left" />
      <div className="room-prop room-prop--bench-right" />
      <div className="room-prop room-prop--plant-a" />
      <div className="room-prop room-prop--plant-b" />

      {listenerEntities
        .filter((entity) => entity.x !== undefined && entity.y !== undefined)
        .map((entity) => (
          <button
            className={`room-presence room-presence--listener room-presence--${entity.kind} ${
              selectedEntityId === entity.selectionId ? "is-selected" : ""
            }`}
            key={entity.selectionId}
            onClick={() => onSelectEntity(entity.selectionId)}
            style={{
              left: `${entity.x}%`,
              top: `${entity.y}%`,
              zIndex: Math.round(entity.y ?? 0),
            }}
            type="button"
          >
            <span className="presence-shadow" />
            <span
              className="presence-token"
              style={{
                background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.94), ${entity.accent})`,
              }}
            >
              {entity.avatar}
            </span>
            <span className="presence-label">
              <i />
              {entity.name}
              <em>{entity.badge}</em>
            </span>
          </button>
        ))}

      {openClawSeats.map((seat) => (
        <button
          className={`room-presence room-presence--contestant is-${seat.state} ${
            selectedEntityId === seat.selectionId ? "is-selected" : ""
          }`}
          key={seat.selectionId}
          onClick={() => onSelectEntity(seat.selectionId)}
          style={{
            left: `${seat.roomX}%`,
            top: `${seat.roomY}%`,
            zIndex: 200 + Math.round(seat.roomY),
          }}
          type="button"
        >
          <span className="presence-shadow" />
          <span
            className="presence-token"
            style={{
              background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.94), ${seat.palette.primary})`,
            }}
          >
            {seat.avatarGlyph}
          </span>
          <span className="presence-callout">{seat.seatLabel}</span>
          <span className="presence-label">
            <i />
            {seat.name}
            <em>{seat.stateLabel}</em>
          </span>
        </button>
      ))}

      <div className="mini-map">
        <span className="tiny-label">Mini map</span>
        <div className="mini-map-floor">
          {listenerEntities
            .filter((entity) => entity.x !== undefined && entity.y !== undefined)
            .map((entity) => (
              <span
                className={`mini-map-dot ${
                  selectedEntityId === entity.selectionId ? "mini-map-focus" : ""
                }`}
                key={`map-${entity.selectionId}`}
                style={{
                  background: miniLegend[entity.kind],
                  left: `${entity.x}%`,
                  top: `${entity.y}%`,
                }}
              />
            ))}
          {openClawSeats.map((seat) => (
            <span
              className={`mini-map-dot ${
                selectedEntityId === seat.selectionId ? "mini-map-focus" : ""
              }`}
              key={`map-${seat.selectionId}`}
              style={{
                background: miniLegend.contestant,
                left: `${seat.roomX}%`,
                top: `${seat.roomY}%`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="scene-toast">{roomCallout}</div>

      <div className="control-dock">
        <button
          className={`control-button ${audioMode === "nearby" ? "is-active" : ""}`}
          onClick={() => onSetAudioMode("nearby")}
          type="button"
        >
          Nearby
        </button>
        <button
          className={`control-button ${audioMode === "focus" ? "is-active" : ""}`}
          onClick={() => onSetAudioMode("focus")}
          type="button"
        >
          Focus
        </button>
        <button
          className={`control-button ${audioMode === "muted" ? "is-active" : ""}`}
          onClick={() => onSetAudioMode("muted")}
          type="button"
        >
          Mute
        </button>
        <button
          className={`control-button ${simplifiedView ? "is-active" : ""}`}
          onClick={onToggleSimplifiedView}
          type="button"
        >
          Simple
        </button>
        <button
          className={`control-button ${priorityContestantId ? "is-active" : ""}`}
          onClick={onClearPriorityContestant}
          type="button"
        >
          Clear Wave
        </button>
      </div>
    </section>
  );
}

export default SpatialRoomFloor;
