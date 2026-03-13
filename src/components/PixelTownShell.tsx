// src/components/PixelTownShell.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomDirectory, AudioMode } from "../room/types";
import { buildTownLayout, type TownBuildingTheme } from "../room/townLayout";
import type { ContestantSeat, DetailCard, SidebarEntity } from "../types/entities";
import type { AudienceEvent, ContestantScorecard } from "../types";
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
    <div className="pixel-town-app">
      {viewMode === "town" && (
        <div
          ref={mapRef}
          className={`town-map-container ${isZooming ? "is-zooming" : ""}`}
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
          onBack={handleBackToTown}
        />
      )}

      <TownOverlay
        locationLabel={locationLabel}
        onlineCount={onlineCount}
        activeStageOrder={activeStageOrder}
        connectionStatus={connectionStatus}
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
