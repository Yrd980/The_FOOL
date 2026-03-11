import { describe, expect, it } from "vitest";

import { buildRoomDirectory } from "./rooms";
import { createRoomDirectoryInput } from "./testFixtures";

describe("buildRoomDirectory", () => {
  it("builds room metadata, members, audible summaries, and current-room context", () => {
    const directory = buildRoomDirectory(createRoomDirectoryInput());

    expect(directory.rooms.map((room) => room.id)).toEqual(
      expect.arrayContaining(["main-stage", "team-room-1", "quiet-orbit"]),
    );
    expect(directory.currentRoom.id).toBe("main-stage");
    expect(directory.rooms[0].name).toBeTruthy();
    expect(directory.rooms[0].memberCount).toBeGreaterThanOrEqual(0);
    expect(typeof directory.rooms[0].audibleSummary).toBe("string");
    expect(directory.rooms.find((room) => room.id === "team-room-1")?.memberIds).toContain(
      "glass-sea",
    );
    expect(directory.rooms.find((room) => room.id === "quiet-orbit")?.memberIds.length).toBeGreaterThan(0);
    expect(directory.switchTargets.length).toBeGreaterThan(0);
  });

  it("falls back to main-stage when currentRoomId is invalid", () => {
    const directory = buildRoomDirectory({
      ...createRoomDirectoryInput(),
      currentRoomId: "missing-room",
    });

    expect(directory.currentRoom.id).toBe("main-stage");
  });

  it("generates team rooms matching the teams array order", () => {
    const directory = buildRoomDirectory(createRoomDirectoryInput());
    const teamRooms = directory.rooms.filter((r) => r.kind === "team-room");

    expect(teamRooms).toHaveLength(2);
    expect(teamRooms[0].id).toBe("team-room-1");
    expect(teamRooms[0].teamId).toBe("team-alpha");
    expect(teamRooms[1].id).toBe("team-room-2");
    expect(teamRooms[1].teamId).toBe("team-beta");
  });

  it("puts non-conversation contestants and listener entities in quiet-orbit", () => {
    const directory = buildRoomDirectory(createRoomDirectoryInput());
    const quietOrbit = directory.rooms.find((r) => r.id === "quiet-orbit");

    expect(quietOrbit).toBeTruthy();
    expect(quietOrbit!.kind).toBe("quiet-orbit");
    expect(quietOrbit!.memberIds).toEqual(
      expect.arrayContaining(["fog-lamp", "iron-drum", "listener-a", "listener-b"]),
    );
    expect(quietOrbit!.memberIds).not.toContain("glass-sea");
    expect(quietOrbit!.memberIds).not.toContain("paperclip-captain");
  });
});
