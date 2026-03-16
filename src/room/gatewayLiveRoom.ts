import type { AudienceInteraction, OpenClawContestantState } from "../types";
import type { RoomDirectory, RoomListItem, RoomViewModel, AudioMode, ScenarioOverride } from "./types";

const DEFAULT_GATEWAY_ROOM_IDS = [
  "main-stage",
  "team-room-1",
  "team-room-2",
  "team-room-3",
  "quiet-orbit",
] as const;

const ROOM_NAME_MAP: Record<string, string> = {
  "main-stage": "Main Stage",
  "team-room-1": "Team Room 1",
  "team-room-2": "Team Room 2",
  "team-room-3": "Team Room 3",
  "quiet-orbit": "Quiet Orbit",
};

const ROOM_KIND_MAP: Record<string, RoomListItem["kind"]> = {
  "main-stage": "main-stage",
  "team-room-1": "team-room",
  "team-room-2": "team-room",
  "team-room-3": "team-room",
  "quiet-orbit": "quiet-orbit",
};

const ROOM_STATUS_MAP: Record<string, string> = {
  "main-stage": "Live",
  "quiet-orbit": "Observing",
};

const normalizeRoomId = (roomId: string): string =>
  roomId === "main" ? "main-stage" : roomId;

export const resolveSessionRoomId = (sessionKey: string | undefined): string => {
  if (!sessionKey) return "quiet-orbit";

  const match = sessionKey.match(/^agent:[^:]+:(.+)$/);
  const roomId = normalizeRoomId(match?.[1] ?? "");

  if (DEFAULT_GATEWAY_ROOM_IDS.includes(roomId as (typeof DEFAULT_GATEWAY_ROOM_IDS)[number])) {
    return roomId;
  }

  return "quiet-orbit";
};

const buildRoomLabel = (roomId: string, memberCount: number): string => {
  if (roomId === "main-stage") {
    return memberCount > 0 ? "Live" : "Idle";
  }

  if (roomId === "quiet-orbit") {
    return memberCount > 0 ? "Observing" : "Empty";
  }

  return memberCount > 0 ? "Active" : "Empty";
};

export const buildLiveRoomDirectory = ({
  currentRoomId,
  orderedContestantIds,
  listenerEntityIds,
  gatewayRoomIds = [...DEFAULT_GATEWAY_ROOM_IDS],
  contestantRoomIds,
}: {
  currentRoomId: string;
  orderedContestantIds: string[];
  listenerEntityIds: string[];
  gatewayRoomIds?: string[];
  contestantRoomIds: Map<string, string>;
}): RoomDirectory => {
  const memberIdsByRoom = new Map<string, string[]>();

  for (const roomId of gatewayRoomIds) {
    memberIdsByRoom.set(roomId, []);
  }

  for (const contestantId of orderedContestantIds) {
    const roomId = contestantRoomIds.get(contestantId) ?? "quiet-orbit";
    const members = memberIdsByRoom.get(roomId) ?? [];
    members.push(contestantId);
    memberIdsByRoom.set(roomId, members);
  }

  const quietOrbitMembers = memberIdsByRoom.get("quiet-orbit") ?? [];
  memberIdsByRoom.set("quiet-orbit", [...quietOrbitMembers, ...listenerEntityIds]);

  const rooms: RoomListItem[] = gatewayRoomIds.map((roomId) => {
    const memberIds = memberIdsByRoom.get(roomId) ?? [];
    return {
      id: roomId,
      name: ROOM_NAME_MAP[roomId] ?? roomId,
      kind: ROOM_KIND_MAP[roomId] ?? "quiet-orbit",
      memberIds,
      memberCount: memberIds.length,
      audibleSummary: ROOM_NAME_MAP[roomId] ?? roomId,
      statusLabel: ROOM_STATUS_MAP[roomId] ?? buildRoomLabel(roomId, memberIds.length),
      active: roomId === "main-stage" ? true : memberIds.length > 0,
    };
  });

  const fallbackRoom = rooms.find((room) => room.id === "main-stage") ?? rooms[0]!;
  const currentRoom = rooms.find((room) => room.id === currentRoomId) ?? fallbackRoom;
  const switchTargets = rooms
    .filter((room) => room.id !== currentRoom.id)
    .map((room) => ({ id: room.id, name: room.name }));

  return { currentRoom, rooms, switchTargets };
};

const filterRoomSignals = (
  interactions: AudienceInteraction[],
  memberIds: Set<string>,
): AudienceInteraction[] =>
  [...interactions]
    .filter((event) => memberIds.has(event.contestantId))
    .slice(-4)
    .reverse();

const filterAudibleSignals = (
  roomSignals: AudienceInteraction[],
  audioMode: AudioMode,
  activeSpeakerId: string | null,
): AudienceInteraction[] => {
  if (audioMode === "muted") return [];
  if (audioMode === "focus") {
    const focused = roomSignals.filter((event) => event.contestantId === activeSpeakerId);
    return focused.length > 0 ? focused : roomSignals.slice(0, 2);
  }
  return roomSignals;
};

const buildCallout = (
  activeSpeakerId: string | null,
  raisedHandId: string | null,
  contestantNameById: Record<string, string>,
  nearbyHint: string,
  currentRoomName: string,
): string => {
  const speakerName = activeSpeakerId ? contestantNameById[activeSpeakerId] ?? activeSpeakerId : null;
  const raisedHandName = raisedHandId ? contestantNameById[raisedHandId] ?? raisedHandId : null;

  if (speakerName && raisedHandName) {
    return `${currentRoomName} now has ${speakerName} on mic. ${raisedHandName} is waiting to jump in.`;
  }

  if (speakerName) {
    return `${currentRoomName} now has ${speakerName} on mic.`;
  }

  if (raisedHandName) {
    return `${raisedHandName} is waiting to jump in.`;
  }

  return nearbyHint;
};

const applyScenarioOverride = (
  viewModel: RoomViewModel,
  override: ScenarioOverride | undefined,
  currentRoomId: string | undefined,
): RoomViewModel => {
  if (!override || override.type === "none") return viewModel;
  if (currentRoomId !== undefined && override.targetRoomId !== currentRoomId) return viewModel;

  if (override.type === "quiet-room" || override.type === "empty-room") {
    return {
      ...viewModel,
      openClawSeats: viewModel.openClawSeats.map((seat) => ({ ...seat, state: "muted" as const })),
      activeSpeakerId: null,
      raisedHandId: null,
      micCount: 0,
      queueCount: 0,
      roomSignals: [],
      audibleSignals: [],
      roomCallout: override.type === "quiet-room" ? "This room is quiet right now." : "This room is empty.",
    };
  }

  return viewModel;
};

export const buildLiveRoomViewModel = ({
  orderedContestantIds,
  currentRoom,
  contestantStateMap,
  interactions,
  audioMode,
  nearbyHint,
  contestantNameById,
  scenarioOverride,
  currentRoomId,
}: {
  orderedContestantIds: string[];
  currentRoom: RoomListItem;
  contestantStateMap: Map<string, OpenClawContestantState>;
  interactions: AudienceInteraction[];
  audioMode: AudioMode;
  nearbyHint: string;
  contestantNameById: Record<string, string>;
  scenarioOverride?: ScenarioOverride;
  currentRoomId?: string;
}): RoomViewModel => {
  const memberIds = new Set(currentRoom.memberIds);
  const openClawSeats = orderedContestantIds.map((id) => ({
    id,
    state: memberIds.has(id) ? contestantStateMap.get(id) ?? "muted" : "muted",
  }));

  const activeSpeakerId =
    openClawSeats.find((seat) => seat.state === "speaking")?.id ?? null;
  const raisedHandId =
    openClawSeats.find((seat) => seat.state === "raised-hand")?.id ?? null;
  const micCount = openClawSeats.filter((seat) => seat.state === "speaking" || seat.state === "listening").length;
  const queueCount = openClawSeats.filter((seat) => seat.state === "raised-hand" || seat.state === "queued").length;
  const roomSignals = filterRoomSignals(interactions, memberIds);
  const audibleSignals = filterAudibleSignals(roomSignals, audioMode, activeSpeakerId);
  const roomCallout = buildCallout(
    activeSpeakerId,
    raisedHandId,
    contestantNameById,
    nearbyHint,
    currentRoom.name,
  );

  return applyScenarioOverride(
    {
      openClawSeats,
      activeSpeakerId,
      raisedHandId,
      micCount,
      queueCount,
      roomSignals,
      audibleSignals,
      roomCallout,
    },
    scenarioOverride,
    currentRoomId,
  );
};
