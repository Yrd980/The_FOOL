// src/components/PixelRoomView.tsx
import type { RoomListItem } from "../room/types";
import type { TownBuildingTheme } from "../room/townLayout";
import type { ContestantSeat, SidebarEntity } from "../types/entities";
import type { AudienceEvent, ContestantScorecard } from "../types";
import type { AudioMode } from "../room/types";

type PixelRoomViewProps = {
  room: RoomListItem;
  theme: TownBuildingTheme;
  contestantSeats: ContestantSeat[];
  listenerEntities: SidebarEntity[];
  audibleSignals: AudienceEvent[];
  contestantMap: Record<string, ContestantScorecard>;
  roomCallout: string;
  audioMode: AudioMode;
  selectedEntityId: string;
  onSelectEntity: (selectionId: string) => void;
  onBack: () => void;
};

type RoomProp = {
  x: number; y: number;
  w: number; h: number;
  color: string;
  glyph: string;
};

const ROOM_PROPS: Record<string, RoomProp[]> = {
  lobby: [
    { x: 8, y: 12, w: 40, h: 24, color: "var(--pt-dust)", glyph: "📋" },
    { x: 78, y: 14, w: 36, h: 28, color: "var(--pt-dust)", glyph: "🗄" },
    { x: 44, y: 82, w: 48, h: 20, color: "var(--pt-gray)", glyph: "🪑" },
  ],
  "print-shop": [
    { x: 6, y: 8, w: 52, h: 20, color: "#E2DDD6", glyph: "🖨" },
    { x: 72, y: 10, w: 36, h: 24, color: "#E2DDD6", glyph: "📄" },
    { x: 10, y: 80, w: 44, h: 18, color: "var(--pt-gray)", glyph: "📑" },
  ],
  clinic: [
    { x: 8, y: 10, w: 44, h: 22, color: "#D8DDE0", glyph: "🩺" },
    { x: 74, y: 12, w: 40, h: 20, color: "#D8DDE0", glyph: "💊" },
    { x: 30, y: 84, w: 48, h: 16, color: "var(--pt-gray)", glyph: "🛏" },
  ],
  convenience: [
    { x: 6, y: 6, w: 28, h: 70, color: "#DDD8D2", glyph: "🗂" },
    { x: 76, y: 6, w: 28, h: 70, color: "#DDD8D2", glyph: "📦" },
    { x: 36, y: 82, w: 36, h: 18, color: "var(--pt-gray)", glyph: "🧾" },
  ],
  "quiet-zone": [
    { x: 10, y: 14, w: 36, h: 20, color: "var(--pt-damp)", glyph: "🪴" },
    { x: 70, y: 76, w: 40, h: 20, color: "var(--pt-damp)", glyph: "🪑" },
  ],
};

const listenerSpots = [
  { x: 16, y: 18 }, { x: 84, y: 18 },
  { x: 18, y: 72 }, { x: 82, y: 72 },
  { x: 72, y: 26 }, { x: 26, y: 28 },
  { x: 64, y: 82 }, { x: 34, y: 84 },
  { x: 90, y: 48 }, { x: 10, y: 48 },
];

function PixelRoomView({
  room,
  theme,
  contestantSeats,
  listenerEntities,
  audibleSignals,
  roomCallout,
  selectedEntityId,
  onSelectEntity,
  onBack,
}: PixelRoomViewProps) {
  // Find the latest signal per contestant for speech bubbles
  const latestSignalByContestant = new Map<string, string>();
  for (const signal of audibleSignals.slice(-10)) {
    latestSignalByContestant.set(signal.contestantId, signal.content);
  }

  return (
    <div className="pixel-room" role="region" aria-label={`Room: ${room.name}`}>
      <div className={`pixel-room__ground pixel-room__ground--${theme}`}>
        <div className="pixel-room__conversation-ring" />

        {/* Room props (pixel furniture) */}
        <div className="pixel-room__props">
          {(ROOM_PROPS[theme] ?? []).map((prop, i) => (
            <div
              key={i}
              className="pixel-room-prop"
              style={{
                left: `${prop.x}px`,
                top: `${prop.y}px`,
                width: `${prop.w}px`,
                height: `${prop.h}px`,
                background: prop.color,
              }}
            >
              {prop.glyph}
            </div>
          ))}
        </div>

        {/* Contestant sprites */}
        {contestantSeats.map((seat) => {
          const bubble = latestSignalByContestant.get(seat.id);
          return (
            <button
              key={seat.selectionId}
              className={`pixel-sprite ${selectedEntityId === seat.selectionId ? "is-selected" : ""}`}
              style={{
                left: `${seat.roomX}%`,
                top: `${seat.roomY}%`,
                zIndex: 200 + Math.round(seat.roomY),
              }}
              onClick={() => onSelectEntity(seat.selectionId)}
              aria-label={`${seat.name} — ${seat.stateLabel}`}
              type="button"
            >
              {bubble && <span className="pixel-sprite__bubble">{bubble}</span>}
              <span
                className={`pixel-sprite__token pixel-sprite__token--${seat.state}`}
                style={{ background: seat.palette.primary }}
              >
                {seat.avatarGlyph}
              </span>
              <span className="pixel-sprite__name">{seat.name}</span>
            </button>
          );
        })}

        {/* Listener sprites */}
        {listenerEntities
          .filter((entity) => entity.x !== undefined && entity.y !== undefined)
          .map((entity, index) => (
            <button
              key={entity.selectionId}
              className={`pixel-sprite ${selectedEntityId === entity.selectionId ? "is-selected" : ""}`}
              style={{
                left: `${entity.x ?? listenerSpots[index]?.x ?? 50}%`,
                top: `${entity.y ?? listenerSpots[index]?.y ?? 50}%`,
                zIndex: Math.round(entity.y ?? 0),
              }}
              onClick={() => onSelectEntity(entity.selectionId)}
              aria-label={`${entity.name} — ${entity.badge}`}
              type="button"
            >
              <span
                className="pixel-sprite__token"
                style={{ background: entity.accent }}
              >
                {entity.avatar}
              </span>
              <span className="pixel-sprite__name">{entity.name}</span>
            </button>
          ))}

        {/* Room callout */}
        {roomCallout && (
          <div className="pixel-room__callout" style={{
            position: "absolute",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
          }}>
            <span className="town-overlay__panel">{roomCallout}</span>
          </div>
        )}
      </div>

      <button
        className="pixel-room__back"
        onClick={onBack}
        type="button"
      >
        ← BACK TO TOWN
      </button>
    </div>
  );
}

export default PixelRoomView;
