import type { BuildRoomDirectoryInput, RoomDirectory, RoomListItem } from "./types";

const buildMainStage = (input: BuildRoomDirectoryInput): RoomListItem => {
  const { conversationState } = input;
  const memberIds = [
    ...new Set(
      [
        conversationState.speakerId,
        conversationState.raisedHandId,
        ...conversationState.listeningIds,
        ...conversationState.queuedIds,
      ].filter((id): id is string => id !== null),
    ),
  ];

  return {
    id: "main-stage",
    name: "Main Stage",
    kind: "main-stage",
    memberIds,
    memberCount: memberIds.length,
    audibleSummary: conversationState.callout,
    statusLabel: conversationState.speakerId ? "Live" : "Idle",
    active: true,
  };
};

const buildTeamRooms = (
  input: BuildRoomDirectoryInput,
  mainStageIds: Set<string>,
): RoomListItem[] =>
  input.teams.map((team, index) => {
    const memberIds = team.members
      .map((m) => m.id)
      .filter((id) => !mainStageIds.has(id));
    return {
      id: `team-room-${index + 1}`,
      name: `Team Room ${index + 1}`,
      kind: "team-room" as const,
      teamId: team.id,
      memberIds,
      memberCount: memberIds.length,
      audibleSummary: `${team.name} team room`,
      statusLabel: memberIds.length > 0 ? "Active" : "Empty",
      active: memberIds.length > 0,
    };
  });

const buildQuietOrbit = (
  input: BuildRoomDirectoryInput,
  mainStageIds: Set<string>,
  teamRoomIds: Set<string>,
): RoomListItem => {
  const nonConversationContestants = input.orderedContestantIds.filter(
    (id) => !mainStageIds.has(id) && !teamRoomIds.has(id),
  );
  const memberIds = [...nonConversationContestants, ...input.listenerEntityIds];

  return {
    id: "quiet-orbit",
    name: "Quiet Orbit",
    kind: "quiet-orbit",
    memberIds,
    memberCount: memberIds.length,
    audibleSummary: "Off-stage contestants and listeners",
    statusLabel: memberIds.length > 0 ? "Observing" : "Empty",
    active: false,
  };
};

export const buildRoomDirectory = (input: BuildRoomDirectoryInput): RoomDirectory => {
  const mainStage = buildMainStage(input);
  const mainStageIds = new Set(mainStage.memberIds);
  const teamRooms = buildTeamRooms(input, mainStageIds);
  const teamRoomIds = new Set(teamRooms.flatMap((room) => room.memberIds));
  const quietOrbit = buildQuietOrbit(input, mainStageIds, teamRoomIds);

  const rooms: RoomListItem[] = [mainStage, ...teamRooms, quietOrbit];

  const currentRoom =
    rooms.find((r) => r.id === input.currentRoomId) ?? mainStage;

  const switchTargets = rooms
    .filter((r) => r.id !== currentRoom.id)
    .map((r) => ({ id: r.id, name: r.name }));

  return { currentRoom, rooms, switchTargets };
};
