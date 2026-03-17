// src/components/PixelTownMap.tsx
import { cn } from "../lib/cn";
import { STREET_SEGMENTS, type TownBuilding } from "../room/townLayout";
import { buildingThemeClass, mapCrossClass, mapVignetteClass, panelCanvasClass } from "../pixelTownTheme";

type PixelTownMapProps = {
  buildings: TownBuilding[];
  onEnterRoom: (roomId: string) => void;
  onSelectEntity: (selectionId: string) => void;
};

const buildingTiltClass: Record<TownBuilding["theme"], string> = {
  lobby: "-rotate-[1.1deg]",
  "print-shop": "-rotate-[2.8deg]",
  clinic: "rotate-[2.2deg]",
  convenience: "rotate-[1.4deg]",
  "quiet-zone": "-rotate-[1.6deg]",
};

const lampClass: Record<TownBuilding["status"], string> = {
  active: "bg-[#86ea84]",
  idle: "bg-[rgba(18,12,13,0.1)]",
  live: "bg-[#86ea84] shadow-[0_0_0_6px_rgba(134,234,132,0.16)] animate-pulse",
};

function PixelTownMap({ buildings, onEnterRoom, onSelectEntity }: PixelTownMapProps) {
  return (
    <div
      className={cn(
        "relative h-[clamp(370px,calc(100vh-30rem),620px)] min-h-[330px] w-[min(1180px,calc(100vw-4rem))] overflow-hidden rounded-[30px_30px_14px_30px] border-2 border-[rgba(18,12,13,0.9)] shadow-[0_18px_42px_rgba(54,20,17,0.16),12px_12px_0_rgba(141,14,18,0.14)] -rotate-[1deg]",
        "max-[1180px]:w-[min(1040px,calc(100vw-3rem))]",
        "max-[920px]:h-[min(560px,calc(100vh-18rem))] max-[920px]:min-h-[360px] max-[920px]:w-[calc(100vw-2rem)] max-[920px]:rotate-0",
        "max-[720px]:h-[min(460px,calc(100vh-19rem))] max-[720px]:min-h-[330px] max-[720px]:w-[calc(100vw-1.5rem)] max-[720px]:rounded-[24px_24px_12px_24px]",
        "max-[520px]:h-[min(455px,calc(100vh-13.8rem))] max-[520px]:min-h-[340px]",
        panelCanvasClass,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[min(46vw,520px)] w-[min(46vw,520px)] -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] opacity-[0.22] blur-[1.1px]",
          mapCrossClass,
        )}
      />
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 z-[1]", mapVignetteClass)}
      />

      {/* Street segments connecting buildings */}
      <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full" aria-hidden="true">
        {STREET_SEGMENTS.map((seg, i) => (
          <line
            key={i}
            x1={`${seg.x1}%`} y1={`${seg.y1}%`}
            x2={`${seg.x2}%`} y2={`${seg.y2}%`}
            className="stroke-[rgba(141,14,18,0.34)] [stroke-dasharray:8_7] [stroke-linecap:round] [stroke-width:3]"
          />
        ))}
      </svg>

      <span
        className="pointer-events-none absolute right-[3.4rem] top-[1.4rem] z-[2] text-[clamp(3.2rem,11vw,7.5rem)] leading-none tracking-[0.12em] text-[rgba(200,29,24,0.14)] rotate-[11deg] [font-family:var(--font-display)]"
        aria-hidden="true"
      >
        X
      </span>

      {buildings.map((building) => (
        <button
          key={building.roomId}
          className={cn(
            "group absolute z-[3] flex flex-col gap-[clamp(0.45rem,0.8vw,0.75rem)] overflow-hidden rounded-[22px_22px_10px_22px] border-2 border-[rgba(18,12,13,0.92)] p-[clamp(0.7rem,0.95vw,1rem)] text-left shadow-[0_14px_32px_rgba(35,12,10,0.12)] backdrop-blur-[6px] transition duration-300",
            "hover:-translate-y-2 hover:border-[#8d0e12] hover:shadow-[0_20px_48px_rgba(39,15,12,0.16)]",
            "max-[720px]:rounded-[18px_18px_10px_18px] max-[720px]:p-[0.7rem]",
            buildingTiltClass[building.theme],
            buildingThemeClass(building.theme),
          )}
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
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-[clamp(0.7rem,0.95vw,1rem)] top-[clamp(0.7rem,0.95vw,1rem)] h-[8px] w-[clamp(2.75rem,5vw,4.9rem)] rounded-full bg-[rgba(200,29,24,0.12)]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[clamp(0.65rem,0.95vw,1rem)] left-[clamp(0.7rem,0.95vw,1rem)] h-[0.38rem] w-[clamp(1.9rem,3.2vw,3rem)] rounded-full bg-[linear-gradient(90deg,#c81d18,rgba(200,29,24,0.2))]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[clamp(0.65rem,0.95vw,1rem)] right-[clamp(0.7rem,0.95vw,1rem)] text-[0.52rem] uppercase tracking-[0.18em] text-[rgba(18,12,13,0.46)] max-[720px]:hidden"
          >
            enter room
          </span>

          <div className="relative z-[1] flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[clamp(0.9rem,0.9vw+0.45rem,1.3rem)] uppercase tracking-[0.08em] [font-family:var(--font-display)]">
              {building.name}
            </span>
            <span className="grid h-7 min-w-7 place-items-center rounded-full border border-[rgba(18,12,13,0.88)] bg-[rgba(255,255,255,0.72)] px-[0.4rem] text-[0.92rem] tracking-[0.08em] [font-family:var(--font-display)]">
              {building.memberCount}
            </span>
            <span
              className={cn(
                "h-[0.72rem] w-[0.72rem] shrink-0 rounded-full border border-[rgba(18,12,13,0.82)]",
                lampClass[building.status],
              )}
            />
          </div>

          <div className="relative z-[1] min-h-[3.5rem] flex-1 rounded-[18px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.42),transparent_24%),rgba(255,255,255,0.28)]">
            {building.entities.map((entity) => (
              <span
                key={entity.id}
                className="absolute grid h-[1.65rem] w-[1.65rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[rgba(18,12,13,0.9)] text-[0.54rem] font-bold text-[rgba(18,12,13,0.88)] shadow-[0_10px_22px_rgba(40,14,11,0.15)] transition duration-150 hover:scale-[1.18] hover:shadow-[0_16px_32px_rgba(40,14,11,0.2)] focus-visible:scale-[1.18] max-[720px]:h-[1.35rem] max-[720px]:w-[1.35rem] max-[720px]:text-[0.46rem]"
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
              >
                {entity.label}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}

export default PixelTownMap;
