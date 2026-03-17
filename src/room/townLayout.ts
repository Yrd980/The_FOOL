// src/room/townLayout.ts
import type { RoomListItem } from "./types";
import type { ContestantSeat, SidebarEntity } from "../types/entities";

export type TownBuildingTheme = "lobby" | "print-shop" | "clinic" | "convenience" | "quiet-zone";

export interface TownBuildingEntity {
  id: string;
  selectionId: string;
  color: string;
  label: string;
  x: number;
  y: number;
}

export interface TownBuilding {
  roomId: string;
  name: string;
  theme: TownBuildingTheme;
  position: { x: number; y: number; width: number; height: number };
  entities: TownBuildingEntity[];
  status: "active" | "idle" | "live";
  memberCount: number;
}

const BUILDING_POSITIONS: Record<string, { x: number; y: number; w: number; h: number }> = {
  "main-stage":  { x: 30, y: 25, w: 40, h: 35 },
  "team-room-1": { x: 5,  y: 10, w: 22, h: 28 },
  "team-room-2": { x: 73, y: 10, w: 22, h: 28 },
  "team-room-3": { x: 5,  y: 58, w: 22, h: 28 },
  "quiet-orbit": { x: 73, y: 58, w: 22, h: 28 },
};

const ROOM_THEMES: Record<string, { theme: TownBuildingTheme; name: string }> = {
  "main-stage":  { theme: "lobby",       name: "LOBBY PLAZA" },
  "team-room-1": { theme: "print-shop",  name: "PRINT SHOP" },
  "team-room-2": { theme: "clinic",      name: "CLINIC" },
  "team-room-3": { theme: "convenience", name: "CONVENIENCE" },
  "quiet-orbit": { theme: "quiet-zone",  name: "QUIET ZONE" },
};

const distributePositions = (count: number): Array<{ x: number; y: number }> => {
  if (count === 0) return [];
  if (count === 1) return [{ x: 50, y: 50 }];

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const positions: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: 18 + ((col + 0.5) / cols) * 64,
      y: 18 + ((row + 0.5) / rows) * 56,
    });
  }

  return positions;
};

export interface StreetSegment {
  x1: number; y1: number;
  x2: number; y2: number;
}

// Streets connect each peripheral building's door to the central lobby's nearest edge
const STREET_SEGMENTS: StreetSegment[] = [
  // team-room-1 (right door → lobby left edge)
  { x1: 27, y1: 30, x2: 30, y2: 38 },
  // team-room-2 (left door → lobby right edge)
  { x1: 73, y1: 30, x2: 70, y2: 38 },
  // team-room-3 (right door → lobby left edge)
  { x1: 27, y1: 68, x2: 30, y2: 55 },
  // quiet-orbit (left door → lobby right edge)
  { x1: 73, y1: 68, x2: 70, y2: 55 },
];

export { STREET_SEGMENTS };

export function buildTownLayout(
  rooms: RoomListItem[],
  contestantSeats: ContestantSeat[],
  listenerEntities: SidebarEntity[],
): TownBuilding[] {
  const seatMap = new Map(contestantSeats.map((s) => [s.id, s]));
  const listenerMap = new Map(listenerEntities.map((e) => [e.refId, e]));

  return rooms.map((room) => {
    const pos = BUILDING_POSITIONS[room.id] ?? { x: 50, y: 50, w: 20, h: 20 };
    const meta = ROOM_THEMES[room.id] ?? { theme: "quiet-zone" as const, name: room.name };

    const entities: TownBuildingEntity[] = [];
    const positions = distributePositions(room.memberIds.length);

    room.memberIds.forEach((memberId, index) => {
      const seat = seatMap.get(memberId);
      const listener = listenerMap.get(memberId);
      const entityPos = positions[index] ?? { x: 50, y: 50 };

      if (seat) {
        entities.push({
          id: seat.id,
          selectionId: seat.selectionId,
          color: seat.palette.primary,
          label: seat.avatarGlyph,
          x: entityPos.x,
          y: entityPos.y,
        });
      } else if (listener) {
        entities.push({
          id: listener.refId,
          selectionId: listener.selectionId,
          color: listener.accent,
          label: listener.avatar,
          x: entityPos.x,
          y: entityPos.y,
        });
      }
    });

    const hasLiveSpeaker = entities.some((e) => {
      const seat = seatMap.get(e.id);
      return seat && seat.state === "speaking";
    });

    return {
      roomId: room.id,
      name: meta.name,
      theme: meta.theme,
      position: { x: pos.x, y: pos.y, width: pos.w, height: pos.h },
      entities,
      status: hasLiveSpeaker ? "live" : room.active ? "active" : "idle",
      memberCount: entities.length,
    };
  });
}
