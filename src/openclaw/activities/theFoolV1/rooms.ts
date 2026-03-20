import type { ActivityRoomConfig } from "../../platform/activityRegistry";

export const theFoolRoomConfig: ActivityRoomConfig = {
  fallbackRoomId: "quiet-orbit",
  aliases: [
    { roomId: "main-stage", aliases: ["main"] },
    { roomId: "team-room-1", aliases: ["team-1", "team1"] },
    { roomId: "team-room-2", aliases: ["team-2", "team2"] },
    { roomId: "team-room-3", aliases: ["team-3", "team3"] },
    { roomId: "quiet-orbit", aliases: ["quiet"] },
  ],
};
