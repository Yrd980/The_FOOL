import type { AudienceInteraction, AudienceEventType } from "../types";
import type { AppendSeedInteractionInput, RoomAction, RoomSourceSnapshot } from "./types";
import { seedAudienceInteractions } from "../data";

const CYCLE_TYPES: AudienceEventType[] = ["bet", "like", "danmaku", "like", "boo", "danmaku"];

export const appendSeedInteraction = ({
  current,
  contestants,
  audienceHandles,
  danmuTemplates,
}: AppendSeedInteractionInput): AudienceInteraction[] => {
  const contestant = contestants[current.length % contestants.length];
  const template = danmuTemplates[current.length % danmuTemplates.length];
  const type = CYCLE_TYPES[current.length % CYCLE_TYPES.length];
  const amount = type === "bet" ? 8 + ((current.length * 3) % 19) : 1;

  return [
    ...current,
    {
      id: `evt-live-${current.length + 1}`,
      contestantId: contestant.id,
      type,
      source: audienceHandles[current.length % audienceHandles.length],
      content:
        type === "bet"
          ? `${contestant.name} 又被房间追加了 ${amount} 点押注。`
          : template.replace("{name}", contestant.name),
      amount,
      timestampLabel: `20:${String(13 + ((current.length + 1) % 45)).padStart(2, "0")}`,
    },
  ];
};

const VALID_ROOM_IDS = new Set([
  "main-stage",
  "team-room-1",
  "team-room-2",
  "team-room-3",
  "quiet-orbit",
]);

const INITIAL_SNAPSHOT: RoomSourceSnapshot = {
  activeStageId: "act-1",
  currentRoomId: "main-stage",
  selectedContestantId: null,
  audioMode: "nearby",
  feedPaused: false,
  interactions: seedAudienceInteractions,
  priorityContestantId: null,
  scenarioOverride: { type: "none" },
  currentUserMode: "perimeter",
};

export const createInitialSnapshot = (
  overrides: Partial<RoomSourceSnapshot> = {},
): RoomSourceSnapshot => ({
  ...INITIAL_SNAPSHOT,
  ...overrides,
});

export const reduceRoomAction = (
  state: RoomSourceSnapshot,
  action: RoomAction,
): RoomSourceSnapshot => {
  switch (action.type) {
    case "switch-room": {
      if (VALID_ROOM_IDS.has(action.roomId)) {
        return { ...state, currentRoomId: action.roomId };
      }
      if (!VALID_ROOM_IDS.has(state.currentRoomId)) {
        return { ...state, currentRoomId: "main-stage" };
      }
      return { ...state, currentRoomId: "main-stage" };
    }
    case "join-conversation":
      return state.currentUserMode === "listening"
        ? state
        : { ...state, currentUserMode: "listening" };
    case "leave-conversation":
      return state.currentUserMode === "perimeter"
        ? state
        : { ...state, currentUserMode: "perimeter" };
    case "set-audio-mode":
      return { ...state, audioMode: action.mode };
    case "toggle-feed-paused":
      return { ...state, feedPaused: !state.feedPaused };
    case "inject-scenario": {
      if (action.scenario === "none") {
        return { ...state, scenarioOverride: { type: "none" } };
      }
      if (action.scenario === "wave-over") {
        if (action.targetRoomId !== "main-stage" || !state.selectedContestantId) {
          return state;
        }
        return {
          ...state,
          scenarioOverride: {
            type: "wave-over",
            targetRoomId: action.targetRoomId,
            targetContestantId: state.selectedContestantId,
          },
        };
      }
      if (action.scenario === "quiet-room" || action.scenario === "empty-room") {
        const targetRoomId = action.targetRoomId ?? state.currentRoomId;
        return {
          ...state,
          scenarioOverride: {
            type: action.scenario,
            targetRoomId,
          },
        };
      }
      return state;
    }
    case "reset-demo":
      return createInitialSnapshot();
    default:
      return state;
  }
};
