import type { AudienceInteraction, OpenClawContestantState } from "../types";
import type { BuildRoomViewModelInput, RoomSeat, RoomViewModel, ScenarioOverride } from "./types";

const uniqueIds = (ids: Array<string | null | undefined>) =>
  [...new Set(ids.filter((value): value is string => Boolean(value)))];

const buildCurrentRoomConversation = ({
  conversationState,
  currentRoom,
  teams,
  focusTeamId,
}: Pick<
  BuildRoomViewModelInput,
  "conversationState" | "currentRoom" | "teams" | "focusTeamId"
>): typeof conversationState => {
  if (!currentRoom || currentRoom.kind === "main-stage") {
    return conversationState;
  }

  if (currentRoom.kind === "quiet-orbit") {
    return {
      speakerId: null,
      raisedHandId: null,
      listeningIds: [],
      queuedIds: [],
      callout: "Quiet orbit is holding off-stage contestants and nearby listeners.",
    };
  }

  const teamMemberIds = currentRoom.memberIds;
  const roomTeam = teams?.find((team) => team.id === currentRoom.teamId);
  const roomLabel = roomTeam?.name ?? currentRoom.name;

  if (currentRoom.teamId && currentRoom.teamId === focusTeamId) {
    const filteredListeningIds = uniqueIds(
      conversationState.listeningIds.filter((id) => teamMemberIds.includes(id)),
    );
    const filteredQueuedIds = uniqueIds(
      conversationState.queuedIds.filter((id) => teamMemberIds.includes(id)),
    );

    return {
      speakerId:
        teamMemberIds.find((id) => id === conversationState.speakerId) ?? teamMemberIds[0] ?? null,
      raisedHandId:
        teamMemberIds.find((id) => id === conversationState.raisedHandId) ?? teamMemberIds[1] ?? null,
      listeningIds: filteredListeningIds,
      queuedIds: filteredQueuedIds,
      callout: `${roomLabel} keeps the current focus-team thread running inside the room.`,
    };
  }

  return {
    speakerId: teamMemberIds[0] ?? null,
    raisedHandId: teamMemberIds[1] ?? null,
    listeningIds: teamMemberIds.slice(0, 3),
    queuedIds: [],
    callout: `${roomLabel} is in team discussion mode.`,
  };
};

const assignState = (
  contestantId: string,
  speakerId: string | null,
  raisedHandId: string | null,
  focusSet: Set<string>,
  queueSet: Set<string>,
): OpenClawContestantState => {
  if (contestantId === speakerId) return "speaking";
  if (contestantId === raisedHandId) return "raised-hand";
  if (focusSet.has(contestantId)) return "listening";
  if (queueSet.has(contestantId)) return "queued";
  return "muted";
};

const filterRoomSignals = (
  interactions: AudienceInteraction[],
  signalIds: Set<string>,
  fallbackToAll = true,
): AudienceInteraction[] => {
  const scoped = [...interactions]
    .filter((event) => signalIds.has(event.contestantId))
    .slice(-4)
    .reverse();

  return scoped.length > 0 || !fallbackToAll ? scoped : [...interactions].slice(-4).reverse();
};

const filterAudible = (
  roomSignals: AudienceInteraction[],
  audioMode: string,
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
  conversationCallout: string,
  raisedHandName: string | null,
  nearbyHint: string,
  audioMode: string,
  hasSpeaker: boolean,
): string => {
  if (!hasSpeaker) return nearbyHint;

  const queueHint = raisedHandName
    ? `${raisedHandName} 也在边上举手等待切入。`
    : nearbyHint;
  const audioHint =
    audioMode === "muted"
      ? "你当前听不到房间声音。"
      : audioMode === "focus"
        ? "你当前只听主麦。"
        : "你当前会听到附近对话。";

  return `${conversationCallout} ${queueHint} ${audioHint}`;
};

const buildOverrideCallout = (
  currentRoomName: string | undefined,
  activeSpeakerId: string | null,
  raisedHandId: string | null,
  contestantNameById: Record<string, string>,
  nearbyHint: string,
): string => {
  if (!activeSpeakerId) {
    return nearbyHint;
  }

  const speakerName = contestantNameById[activeSpeakerId] ?? "Current contestant";
  const raisedHandName = raisedHandId ? contestantNameById[raisedHandId] ?? null : null;
  const roomPrefix = currentRoomName ? `${currentRoomName} now has ${speakerName} on mic.` : `${speakerName} is now on mic.`;

  return raisedHandName
    ? `${roomPrefix} ${raisedHandName} is waiting on the edge of the conversation.`
    : roomPrefix;
};

const applyScenarioOverride = (
  viewModel: RoomViewModel,
  override: ScenarioOverride | undefined,
  currentRoomId: string | undefined,
): RoomViewModel => {
  if (!override || override.type === "none") return viewModel;
  if (currentRoomId !== undefined && override.targetRoomId !== currentRoomId) return viewModel;

  if (override.type === "quiet-room") {
    return {
      ...viewModel,
      openClawSeats: viewModel.openClawSeats.map((seat) => ({ ...seat, state: "muted" as const })),
      activeSpeakerId: null,
      raisedHandId: null,
      micCount: 0,
      queueCount: 0,
      roomSignals: [],
      audibleSignals: [],
      roomCallout: "This room is quiet right now.",
    };
  }

  if (override.type === "empty-room") {
    return {
      ...viewModel,
      openClawSeats: viewModel.openClawSeats.map((seat) => ({ ...seat, state: "muted" as const })),
      activeSpeakerId: null,
      raisedHandId: null,
      audibleSignals: [],
      micCount: 0,
      queueCount: 0,
      roomSignals: [],
      roomCallout: "This room is empty.",
    };
  }

  if (override.type === "wave-over" && override.targetContestantId) {
    const alreadyQueued = viewModel.openClawSeats.some(
      (seat) =>
        seat.id === override.targetContestantId &&
        (seat.state === "queued" || seat.state === "raised-hand" || seat.state === "speaking"),
    );
    if (alreadyQueued) return viewModel;

    return {
      ...viewModel,
      openClawSeats: viewModel.openClawSeats.map((seat) =>
        seat.id === override.targetContestantId ? { ...seat, state: "queued" as const } : seat,
      ),
      queueCount: viewModel.queueCount + 1,
    };
  }

  return viewModel;
};

export const buildRoomViewModel = ({
  conversationState,
  orderedContestantIds,
  interactions,
  audioMode,
  nearbyHint,
  contestantNameById,
  teams,
  focusTeamId,
  currentRoom,
  seatStateOverrides,
  scenarioOverride,
  currentRoomId,
}: BuildRoomViewModelInput): RoomViewModel => {
  const scopedConversation = buildCurrentRoomConversation({
    conversationState,
    currentRoom,
    teams,
    focusTeamId,
  });
  const { speakerId, raisedHandId, listeningIds, queuedIds, callout } = scopedConversation;

  const focusSet = new Set(
    [speakerId, raisedHandId, ...listeningIds].filter(Boolean) as string[],
  );
  const queueSet = new Set(queuedIds.filter(Boolean) as string[]);

  const baseSeats: RoomSeat[] = orderedContestantIds.map((id) => ({
    id,
    state: assignState(id, speakerId, raisedHandId, focusSet, queueSet),
  }));
  const overrideEligibleIds =
    currentRoom?.kind === "quiet-orbit"
      ? new Set<string>()
      : new Set(currentRoom?.memberIds ?? orderedContestantIds);
  const openClawSeats: RoomSeat[] = baseSeats.map((seat) => ({
    ...seat,
    state:
      overrideEligibleIds.has(seat.id) && seatStateOverrides?.[seat.id]
        ? seatStateOverrides[seat.id]!
        : seat.state,
  }));

  const activeSpeakerId =
    openClawSeats.find((seat) => seat.state === "speaking")?.id ?? null;
  const effectiveRaisedHandId =
    openClawSeats.find((seat) => seat.state === "raised-hand")?.id ?? null;
  const micCount = openClawSeats.filter(
    (seat) => seat.state === "speaking" || seat.state === "listening",
  ).length;
  const queueCount = openClawSeats.filter(
    (seat) => seat.state === "raised-hand" || seat.state === "queued",
  ).length;

  const effectiveSignalIds = new Set(
    openClawSeats
      .filter((seat) => seat.state !== "muted")
      .map((seat) => seat.id),
  );
  const roomSignals =
    currentRoom?.kind === "quiet-orbit"
      ? []
      : effectiveSignalIds.size === 0
        ? []
        : filterRoomSignals(
            interactions,
            effectiveSignalIds,
            currentRoom?.kind !== "team-room",
          );
  const audibleSignals = filterAudible(roomSignals, audioMode, activeSpeakerId);

  const raisedHandName = effectiveRaisedHandId
    ? contestantNameById[effectiveRaisedHandId] ?? null
    : null;
  const roomCallout =
    currentRoom?.kind === "quiet-orbit"
      ? callout
      : seatStateOverrides
        ? buildOverrideCallout(
            currentRoom?.name,
            activeSpeakerId,
            effectiveRaisedHandId,
            contestantNameById,
            nearbyHint,
          )
        : buildCallout(callout, raisedHandName, nearbyHint, audioMode, speakerId !== null);

  const baseViewModel: RoomViewModel = {
    openClawSeats,
    activeSpeakerId,
    raisedHandId: effectiveRaisedHandId,
    micCount,
    queueCount,
    roomSignals,
    audibleSignals,
    roomCallout,
  };

  return applyScenarioOverride(baseViewModel, scenarioOverride, currentRoomId);
};
