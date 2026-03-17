// src/components/PixelTownShell.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomDirectory, AudioMode } from "../room/types";
import { buildTownLayout, type TownBuildingTheme } from "../room/townLayout";
import type { ContestantSeat, DetailCard, SidebarEntity } from "../types/entities";
import type { AudienceEvent, ContestantScorecard } from "../types";
import { cn } from "../lib/cn";
import { rootBackdropClass, shellCrossClass, sideRailClass } from "../pixelTownTheme";
import PixelTownMap from "./PixelTownMap";
import PixelRoomView from "./PixelRoomView";
import TownOverlay from "./TownOverlay";
import EntityDetailPanel from "./EntityDetailPanel";
import EntitySearchOverlay from "./EntitySearchOverlay";

type PixelTownShellProps = {
  roomDirectory: RoomDirectory;
  contestantSeats: ContestantSeat[];
  listenerEntities: SidebarEntity[];
  audibleSignals: AudienceEvent[];
  contestantMap: Record<string, ContestantScorecard>;
  roomCallout: string;
  audioMode: AudioMode;
  selectedEntityId: string;
  onSelectEntity: (selectionId: string) => void;
  detailCard: DetailCard;
  onDetailAction: (actionId: string) => void;
  activeStageOrder: number;
  activeStageTitle: string;
  activeStageSubtitle: string;
  onlineCount: number;
  connectionStatus?: string;
  onSwitchRoom: (roomId: string) => void;
};

const THEME_MAP: Record<string, TownBuildingTheme> = {
  "main-stage": "lobby",
  "team-room-1": "print-shop",
  "team-room-2": "clinic",
  "team-room-3": "convenience",
  "quiet-orbit": "quiet-zone",
};

function PixelTownShell({
  roomDirectory,
  contestantSeats,
  listenerEntities,
  audibleSignals,
  contestantMap,
  roomCallout,
  audioMode,
  selectedEntityId,
  onSelectEntity,
  detailCard,
  onDetailAction,
  activeStageOrder,
  activeStageTitle,
  activeStageSubtitle,
  onlineCount,
  connectionStatus,
  onSwitchRoom,
}: PixelTownShellProps) {
  const [viewMode, setViewMode] = useState<"town" | "room">("town");
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const buildings = useMemo(
    () => buildTownLayout(roomDirectory.rooms, contestantSeats, listenerEntities),
    [roomDirectory.rooms, contestantSeats, listenerEntities],
  );

  const focusBuilding = buildings.find((b) => b.roomId === focusRoomId);
  const focusRoom = roomDirectory.rooms.find((r) => r.id === focusRoomId);

  // Filter contestants to only those in the focused room (C1: room-scoped rendering)
  const roomContestantSeats = useMemo(() => {
    if (!focusRoom) return [];
    const memberSet = new Set(focusRoom.memberIds);
    return contestantSeats.filter((s) => memberSet.has(s.id));
  }, [contestantSeats, focusRoom]);

  // Filter listeners similarly
  const roomListenerEntities = useMemo(() => {
    if (!focusRoom) return [];
    const memberSet = new Set(focusRoom.memberIds);
    return listenerEntities.filter((e) => memberSet.has(e.refId));
  }, [listenerEntities, focusRoom]);

  const locationLabel = viewMode === "room" && focusBuilding
    ? focusBuilding.name
    : "PIXEL TOWN";

  const handleEnterRoom = useCallback((roomId: string) => {
    const building = buildings.find((b) => b.roomId === roomId);
    if (!building) return;

    // Compute zoom target from building center
    const centerX = -(building.position.x + building.position.width / 2 - 50);
    const centerY = -(building.position.y + building.position.height / 2 - 50);

    if (mapRef.current) {
      mapRef.current.style.setProperty("--zoom-x", `${centerX}%`);
      mapRef.current.style.setProperty("--zoom-y", `${centerY}%`);
    }

    setDetailOpen(false);
    setIsZooming(true);
    setFocusRoomId(roomId);
    onSwitchRoom(roomId);

    // Swap view after transition
    setTimeout(() => {
      setViewMode("room");
      setIsZooming(false);
    }, 300);
  }, [buildings, onSwitchRoom]);

  const handleBackToTown = useCallback(() => {
    setDetailOpen(false);
    setViewMode("town");
    setFocusRoomId(null);
    onSwitchRoom("main-stage");
  }, [onSwitchRoom]);

  const handleSelectEntity = useCallback((selectionId: string) => {
    onSelectEntity(selectionId);
    setDetailOpen(true);
  }, [onSelectEntity]);

  // Keyboard: Escape to close panel or go back, Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (searchOpen) {
          setSearchOpen(false);
        } else if (detailOpen) {
          setDetailOpen(false);
        } else if (viewMode === "room") {
          handleBackToTown();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, detailOpen, viewMode, handleBackToTown]);

  return (
    <div
      className={cn(
        "relative h-screen w-screen overflow-hidden text-[#120c0d] [font-family:var(--font-mono)]",
        rootBackdropClass,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 top-[48%] z-0 h-[min(62vw,720px)] w-[min(62vw,720px)] -translate-x-1/2 -translate-y-1/2 -rotate-12 opacity-25 blur-[1px] max-[720px]:top-[42%] max-[720px]:h-[96vw] max-[720px]:w-[96vw]",
          shellCrossClass,
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-[18px] top-[18px] z-0 h-[calc(100%-36px)] w-4 rounded-full opacity-[0.18] max-[920px]:hidden",
          sideRailClass,
        )}
      />

      {viewMode === "town" && (
        <div
          ref={mapRef}
          className={cn(
            "absolute inset-0 z-[1] grid place-items-center px-[clamp(1rem,3vw,2.5rem)] pt-[clamp(20.5rem,39vh,22.5rem)] pb-[clamp(6rem,8.5vh,7rem)] transition-[transform,opacity] duration-[360ms] ease-out",
            "max-[920px]:px-4 max-[920px]:pt-[10.5rem] max-[920px]:pb-[8.5rem]",
            "max-[720px]:px-3 max-[720px]:pt-[9.3rem] max-[720px]:pb-[8rem]",
            "max-[520px]:pt-[10.6rem] max-[520px]:pb-[8.2rem]",
            isZooming && "pointer-events-none opacity-0",
          )}
          style={isZooming
            ? { transform: "scale(2.6) translate(var(--zoom-x, 0%), var(--zoom-y, 0%))" }
            : undefined}
        >
          <PixelTownMap
            buildings={buildings}
            onEnterRoom={handleEnterRoom}
            onSelectEntity={handleSelectEntity}
          />
        </div>
      )}

      {viewMode === "room" && focusRoom && (
        <PixelRoomView
          room={focusRoom}
          theme={THEME_MAP[focusRoom.id] ?? "quiet-zone"}
          contestantSeats={roomContestantSeats}
          listenerEntities={roomListenerEntities}
          audibleSignals={audibleSignals}
          contestantMap={contestantMap}
          roomCallout={roomCallout}
          audioMode={audioMode}
          selectedEntityId={selectedEntityId}
          onSelectEntity={handleSelectEntity}
        />
      )}

      <TownOverlay
        locationLabel={locationLabel}
        onlineCount={onlineCount}
        activeStageOrder={activeStageOrder}
        stageTitle={activeStageTitle}
        stageSubtitle={activeStageSubtitle}
        connectionStatus={connectionStatus}
        isRoomView={viewMode === "room"}
        isDetailOpen={detailOpen}
        onBack={viewMode === "room" ? handleBackToTown : undefined}
      />

      <EntityDetailPanel
        card={detailCard}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAction={onDetailAction}
      />

      <EntitySearchOverlay
        isOpen={searchOpen}
        contestantSeats={contestantSeats}
        listenerEntities={listenerEntities}
        onSelect={handleSelectEntity}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
}

export default PixelTownShell;
