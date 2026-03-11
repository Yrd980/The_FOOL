import type { AudienceInteraction, OpenClawContestantState } from "../types";
import type { BuildRoomViewModelInput, RoomSeat, RoomViewModel, ScenarioOverride } from "./types";

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
  focusSet: Set<string>,
  queueSet: Set<string>,
): AudienceInteraction[] => {
  const scoped = [...interactions]
    .filter((event) => focusSet.has(event.contestantId) || queueSet.has(event.contestantId))
    .slice(-4)
    .reverse();

  return scoped.length > 0 ? scoped : [...interactions].slice(-4).reverse();
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
      activeSpeakerId: null,
      audibleSignals: [],
      roomCallout: "This room is quiet right now.",
    };
  }

  if (override.type === "empty-room") {
    return {
      ...viewModel,
      openClawSeats: viewModel.openClawSeats.map((seat) => ({ ...seat, state: "muted" as const })),
      activeSpeakerId: null,
      audibleSignals: [],
      micCount: 0,
      queueCount: 0,
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
  scenarioOverride,
  currentRoomId,
}: BuildRoomViewModelInput): RoomViewModel => {
  const { speakerId, raisedHandId, listeningIds, queuedIds, callout } = conversationState;

  const focusSet = new Set(
    [speakerId, raisedHandId, ...listeningIds].filter(Boolean) as string[],
  );
  const queueSet = new Set(queuedIds.filter(Boolean) as string[]);

  const openClawSeats: RoomSeat[] = orderedContestantIds.map((id) => ({
    id,
    state: assignState(id, speakerId, raisedHandId, focusSet, queueSet),
  }));

  const micCount = openClawSeats.filter(
    (seat) => seat.state === "speaking" || seat.state === "listening",
  ).length;
  const queueCount = openClawSeats.filter(
    (seat) => seat.state === "raised-hand" || seat.state === "queued",
  ).length;

  const roomSignals = filterRoomSignals(interactions, focusSet, queueSet);
  const audibleSignals = filterAudible(roomSignals, audioMode, speakerId);

  const raisedHandName = raisedHandId ? contestantNameById[raisedHandId] ?? null : null;
  const roomCallout = buildCallout(callout, raisedHandName, nearbyHint, audioMode, speakerId !== null);

  const baseViewModel: RoomViewModel = {
    openClawSeats,
    activeSpeakerId: speakerId,
    raisedHandId,
    micCount,
    queueCount,
    roomSignals,
    audibleSignals,
    roomCallout,
  };

  return applyScenarioOverride(baseViewModel, scenarioOverride, currentRoomId);
};
