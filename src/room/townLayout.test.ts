// src/room/townLayout.test.ts
import { describe, expect, it } from "vitest";
import { buildTownLayout } from "./townLayout";
import type { RoomListItem } from "./types";
import type { ContestantSeat, SidebarEntity } from "../types/entities";

const makeRoom = (id: string, kind: "main-stage" | "team-room" | "quiet-orbit", memberIds: string[]): RoomListItem => ({
  id,
  name: id,
  kind,
  memberIds,
  memberCount: memberIds.length,
  audibleSummary: "",
  statusLabel: memberIds.length > 0 ? "Active" : "Empty",
  active: memberIds.length > 0,
});

const makeSeat = (id: string, color: string): ContestantSeat =>
  ({
    id,
    selectionId: `contestant:${id}`,
    palette: { primary: color },
    avatarGlyph: id.slice(0, 2),
    name: id,
  }) as unknown as ContestantSeat;

const makeListener = (id: string, kind: "judge" | "ai" | "listener"): SidebarEntity => ({
  selectionId: `${kind}:${id}`,
  refId: id,
  kind,
  group: "Observers",
  name: id,
  subtitle: "",
  status: "",
  badge: "",
  accent: "#f3b46c",
  avatar: "JG",
  searchable: id,
});

describe("buildTownLayout", () => {
  const rooms: RoomListItem[] = [
    makeRoom("main-stage", "main-stage", ["c1", "c2"]),
    makeRoom("team-room-1", "team-room", ["c3"]),
    makeRoom("team-room-2", "team-room", []),
    makeRoom("team-room-3", "team-room", []),
    makeRoom("quiet-orbit", "quiet-orbit", ["j1"]),
  ];

  const seats = [makeSeat("c1", "#ff0000"), makeSeat("c2", "#00ff00"), makeSeat("c3", "#0000ff")];
  const listeners = [makeListener("j1", "judge")];

  it("returns one TownBuilding per room", () => {
    const result = buildTownLayout(rooms, seats, listeners);
    expect(result).toHaveLength(5);
    expect(result.map((b) => b.roomId)).toEqual([
      "main-stage", "team-room-1", "team-room-2", "team-room-3", "quiet-orbit",
    ]);
  });

  it("assigns correct themes", () => {
    const result = buildTownLayout(rooms, seats, listeners);
    expect(result[0].theme).toBe("lobby");
    expect(result[1].theme).toBe("print-shop");
    expect(result[2].theme).toBe("clinic");
    expect(result[3].theme).toBe("convenience");
    expect(result[4].theme).toBe("quiet-zone");
  });

  it("places entities in correct buildings by memberIds", () => {
    const result = buildTownLayout(rooms, seats, listeners);
    const mainStage = result.find((b) => b.roomId === "main-stage")!;
    expect(mainStage.entities).toHaveLength(2);
    expect(mainStage.entities.map((e) => e.id)).toEqual(["c1", "c2"]);

    const team1 = result.find((b) => b.roomId === "team-room-1")!;
    expect(team1.entities).toHaveLength(1);
    expect(team1.entities[0].id).toBe("c3");

    const quietOrbit = result.find((b) => b.roomId === "quiet-orbit")!;
    expect(quietOrbit.entities).toHaveLength(1);
    expect(quietOrbit.entities[0].id).toBe("j1");
  });

  it("sets status based on room activity", () => {
    const result = buildTownLayout(rooms, seats, listeners);
    expect(result[0].status).toBe("active"); // main-stage has members
    expect(result[2].status).toBe("idle");   // team-room-2 is empty
  });

  it("distributes entity positions evenly within building bounds", () => {
    const result = buildTownLayout(rooms, seats, listeners);
    const mainStage = result.find((b) => b.roomId === "main-stage")!;
    // Two entities should have distinct positions, both within 0-100% range
    for (const entity of mainStage.entities) {
      expect(entity.x).toBeGreaterThanOrEqual(0);
      expect(entity.x).toBeLessThanOrEqual(100);
      expect(entity.y).toBeGreaterThanOrEqual(0);
      expect(entity.y).toBeLessThanOrEqual(100);
    }
    // Positions should differ
    if (mainStage.entities.length > 1) {
      const positions = mainStage.entities.map((e) => `${e.x},${e.y}`);
      expect(new Set(positions).size).toBe(positions.length);
    }
  });
});
