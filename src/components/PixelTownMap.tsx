// src/components/PixelTownMap.tsx
import type { TownBuilding } from "../room/townLayout";

type PixelTownMapProps = {
  buildings: TownBuilding[];
  onEnterRoom: (roomId: string) => void;
  onSelectEntity: (selectionId: string) => void;
};

function PixelTownMap({ buildings, onEnterRoom, onSelectEntity }: PixelTownMapProps) {
  return (
    <div className="town-map">
      <span className="town-map-x" aria-hidden="true">X</span>

      {buildings.map((building) => (
        <button
          key={building.roomId}
          className={`town-building town-building--${building.theme}`}
          style={{
            left: `${building.position.x}%`,
            top: `${building.position.y}%`,
            width: `${building.position.width}%`,
            height: `${building.position.height}%`,
          }}
          onClick={() => onEnterRoom(building.roomId)}
          aria-label={`${building.name} — ${building.memberCount} occupants`}
          type="button"
        >
          <div className="town-building__header">
            <span className="town-building__name">{building.name}</span>
            <span className="town-building__count">{building.memberCount}</span>
            <span className={`town-building__lamp town-building__lamp--${building.status}`} />
          </div>

          <div className="town-building__entities">
            {building.entities.map((entity) => (
              <span
                key={entity.id}
                className="town-entity-dot"
                style={{
                  left: `${entity.x}%`,
                  top: `${entity.y}%`,
                  background: entity.color,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity(entity.selectionId);
                }}
                role="button"
                tabIndex={0}
                aria-label={entity.label}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onSelectEntity(entity.selectionId);
                  }
                }}
              />
            ))}
          </div>

          <span className="town-building__door" />
        </button>
      ))}
    </div>
  );
}

export default PixelTownMap;
