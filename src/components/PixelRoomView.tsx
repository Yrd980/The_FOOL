// src/components/PixelRoomView.tsx
import type { RoomListItem } from "../room/types";
import type { TownBuildingTheme } from "../room/townLayout";
import type { ContestantSeat, SidebarEntity } from "../types/entities";
import type { AudienceEvent, ContestantScorecard } from "../types";
import type { AudioMode } from "../room/types";
import { cn } from "../lib/cn";
import { roomCanvasClass, roomCrossClass, roomTintClassMap, roomVignetteClass } from "../pixelTownTheme";

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
};


const listenerSpots = [
  { x: 16, y: 18 }, { x: 84, y: 18 },
  { x: 18, y: 72 }, { x: 82, y: 72 },
  { x: 72, y: 26 }, { x: 26, y: 28 },
  { x: 64, y: 82 }, { x: 34, y: 84 },
  { x: 90, y: 48 }, { x: 10, y: 48 },
];

const tokenStateClass: Record<ContestantSeat["state"], string> = {
  speaking: "shadow-[0_12px_26px_rgba(33,13,12,0.18),0_0_0_8px_rgba(255,255,255,0.34),0_0_0_14px_rgba(134,234,132,0.18)]",
  "raised-hand": "shadow-[0_12px_26px_rgba(33,13,12,0.18),0_0_0_8px_rgba(255,255,255,0.34),0_0_0_14px_rgba(242,179,109,0.18)]",
  listening: "shadow-[0_12px_26px_rgba(33,13,12,0.18),0_0_0_8px_rgba(255,255,255,0.34),0_0_0_14px_rgba(120,180,230,0.16)]",
  queued: "shadow-[0_12px_26px_rgba(33,13,12,0.18),0_0_0_8px_rgba(255,255,255,0.34),0_0_0_14px_rgba(230,220,100,0.16)]",
  muted: "opacity-[0.58] shadow-[0_12px_26px_rgba(33,13,12,0.18),0_0_0_8px_rgba(255,255,255,0.34)]",
};

const selectedTokenClass = "shadow-[0_12px_26px_rgba(33,13,12,0.18),0_0_0_8px_rgba(255,255,255,0.34),0_0_0_14px_rgba(200,29,24,0.18)]";
const listenerTokenClass = "shadow-[0_12px_26px_rgba(33,13,12,0.18),0_0_0_8px_rgba(255,255,255,0.34)]";

function PixelRoomView({
  room,
  theme,
  contestantSeats,
  listenerEntities,
  audibleSignals,
  roomCallout,
  selectedEntityId,
  onSelectEntity,
}: PixelRoomViewProps) {
  // Find the latest signal per contestant for speech bubbles
  const latestSignalByContestant = new Map<string, string>();
  for (const signal of audibleSignals.slice(-10)) {
    latestSignalByContestant.set(signal.contestantId, signal.content);
  }

  return (
    <div
      className="absolute inset-0 z-[1] grid place-items-center px-[clamp(1rem,3vw,2.5rem)] pt-[clamp(20rem,38vh,22rem)] pb-[clamp(6rem,8.5vh,7rem)] max-[920px]:px-4 max-[920px]:pt-[9.5rem] max-[920px]:pb-[7.5rem] max-[720px]:px-3 max-[720px]:pt-[8.5rem] max-[720px]:pb-[6.4rem] max-[520px]:pt-[10.2rem] max-[520px]:pb-[5.8rem]"
      role="region"
      aria-label={`Room: ${room.name}`}
    >
      <div
        className={cn(
          "relative h-[clamp(380px,calc(100vh-29rem),620px)] min-h-[330px] w-[min(1180px,calc(100vw-4rem))] overflow-hidden rounded-[30px_30px_14px_30px] border-2 border-[rgba(18,12,13,0.92)] shadow-[0_18px_42px_rgba(54,20,17,0.16),12px_12px_0_rgba(141,14,18,0.14)] max-[1180px]:w-[min(1040px,calc(100vw-3rem))] max-[920px]:h-[min(560px,calc(100vh-18rem))] max-[920px]:min-h-[360px] max-[920px]:w-[calc(100vw-2rem)] max-[720px]:h-[min(460px,calc(100vh-19rem))] max-[720px]:min-h-[330px] max-[720px]:w-[calc(100vw-1.5rem)] max-[720px]:rounded-[24px_24px_12px_24px] max-[520px]:h-[min(400px,calc(100vh-18rem))] max-[520px]:min-h-[300px]",
          "max-[520px]:h-[min(450px,calc(100vh-13.5rem))] max-[520px]:min-h-[340px]",
          roomCanvasClass,
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-[1] opacity-60",
            roomTintClassMap[theme],
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-1/2 top-[48%] z-[1] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] opacity-[0.18]",
            roomCrossClass,
          )}
        />
        <div
          aria-hidden="true"
          className={cn("pointer-events-none absolute inset-0 z-[1]", roomVignetteClass)}
        />
        <div className="absolute left-1/2 top-[47%] z-[1] h-[min(34vw,360px)] w-[min(58vw,620px)] -translate-x-1/2 -translate-y-1/2 -rotate-[6deg] rounded-[47%_53%_49%_51%/53%_44%_56%_47%] border-2 border-dashed border-[rgba(141,14,18,0.3)] bg-[radial-gradient(circle,rgba(255,255,255,0.44),transparent_62%),rgba(255,255,255,0.18)] shadow-[inset_0_0_0_18px_rgba(255,255,255,0.1),0_22px_44px_rgba(35,12,10,0.08)] max-[720px]:h-[min(48vw,260px)] max-[720px]:w-[min(74vw,420px)]" />

        {/* Room props removed */}

        {/* Contestant sprites */}
        {contestantSeats.map((seat) => {
          const bubble = latestSignalByContestant.get(seat.id);
          return (
            <button
              key={seat.selectionId}
              className="absolute z-[5] flex flex-col items-center gap-[0.4rem] transition-all duration-300 hover:-translate-y-1 focus-visible:-translate-y-1"
              style={{
                left: `${seat.roomX}%`,
                top: `${seat.roomY}%`,
                zIndex: 200 + Math.round(seat.roomY),
              }}
              onClick={() => onSelectEntity(seat.selectionId)}
              aria-label={`${seat.name} — ${seat.stateLabel}`}
              type="button"
            >
              {bubble && (
                <span className="absolute bottom-[calc(100%+12px)] left-1/2 min-w-[120px] max-w-[220px] -translate-x-1/2 rotate-[-1.5deg] rounded-[16px_16px_8px_16px] border border-[rgba(18,12,13,0.92)] bg-[rgba(255,247,241,0.95)] px-[0.85rem] py-[0.7rem] text-center text-[0.76rem] leading-[1.4] text-[#120c0d] shadow-[0_14px_28px_rgba(33,13,12,0.16)] [font-family:var(--font-serif)] max-[720px]:max-w-[150px] max-[720px]:text-[0.66rem]">
                  {bubble}
                </span>
              )}
              <span
                className={cn(
                  "grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-[rgba(18,12,13,0.9)] text-[0.9rem] font-extrabold text-[rgba(18,12,13,0.92)] max-[720px]:h-[46px] max-[720px]:w-[46px] max-[720px]:text-[0.76rem]",
                  selectedEntityId === seat.selectionId ? selectedTokenClass : tokenStateClass[seat.state],
                )}
                style={{ background: seat.palette.primary }}
              >
                {seat.avatarGlyph}
              </span>
              <span className="max-w-[132px] overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-[rgba(18,12,13,0.92)] bg-[rgba(255,249,244,0.92)] px-[0.7rem] py-[0.3rem] text-[0.8rem] shadow-[0_10px_22px_rgba(35,12,10,0.12)] [font-family:var(--font-serif)] max-[720px]:max-w-[96px] max-[720px]:text-[0.68rem]">
                {seat.name}
              </span>
            </button>
          );
        })}

        {/* Listener sprites */}
        {listenerEntities
          .filter((entity) => entity.x !== undefined && entity.y !== undefined)
          .map((entity, index) => (
            <button
              key={entity.selectionId}
              className="absolute z-[5] flex flex-col items-center gap-[0.4rem] transition-all duration-300 hover:-translate-y-1 focus-visible:-translate-y-1"
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
                className={cn(
                  "grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-[rgba(18,12,13,0.9)] text-[0.9rem] font-extrabold text-[rgba(18,12,13,0.92)] max-[720px]:h-[46px] max-[720px]:w-[46px] max-[720px]:text-[0.76rem]",
                  selectedEntityId === entity.selectionId ? selectedTokenClass : listenerTokenClass,
                )}
                style={{ background: entity.accent }}
              >
                {entity.avatar}
              </span>
              <span className="max-w-[132px] overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-[rgba(18,12,13,0.92)] bg-[rgba(255,249,244,0.92)] px-[0.7rem] py-[0.3rem] text-[0.8rem] shadow-[0_10px_22px_rgba(35,12,10,0.12)] [font-family:var(--font-serif)] max-[720px]:max-w-[96px] max-[720px]:text-[0.68rem]">
                {entity.name}
              </span>
            </button>
          ))}

        {/* Room callout */}
        {roomCallout && (
          <div className="absolute bottom-[1.35rem] left-1/2 z-20 w-auto -translate-x-1/2 max-[720px]:w-[calc(100%-2rem)]">
            <span className="inline-flex min-h-11 items-center rounded-full border border-[rgba(18,12,13,0.92)] bg-[rgba(255,248,243,0.92)] px-4 py-[0.72rem] text-[0.72rem] tracking-[0.04em] text-[#120c0d] shadow-[0_12px_28px_rgba(36,14,10,0.14)] max-[720px]:flex max-[720px]:w-full max-[720px]:justify-center max-[720px]:text-center">
              {roomCallout}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default PixelRoomView;
