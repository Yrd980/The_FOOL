import type { BuildRoomDirectoryInput, ConversationState, RoomSourceSnapshot } from "./types";

export const createRoomDirectoryInput = (
  overrides: Partial<BuildRoomDirectoryInput> = {},
): BuildRoomDirectoryInput => ({
  currentRoomId: "main-stage",
  conversationState: createConversationState(),
  teams: [
    {
      id: "team-alpha",
      name: "Team Alpha",
      members: [{ id: "glass-sea" }, { id: "butter-knife" }, { id: "speckled-playwright" }],
    },
    {
      id: "team-beta",
      name: "Team Beta",
      members: [{ id: "paperclip-captain" }, { id: "fog-lamp" }, { id: "iron-drum" }],
    },
  ],
  orderedContestantIds: [
    "glass-sea",
    "butter-knife",
    "speckled-playwright",
    "paperclip-captain",
    "fog-lamp",
    "iron-drum",
  ],
  listenerEntityIds: ["listener-a", "listener-b"],
  ...overrides,
});

const createConversationState = (): ConversationState => ({
  speakerId: "glass-sea",
  raisedHandId: "butter-knife",
  listeningIds: ["glass-sea", "butter-knife", "speckled-playwright"],
  queuedIds: ["paperclip-captain"],
  callout: "Glass Sea is speaking on the main stage.",
});

export const createSeedRoomSnapshot = (
  overrides: Partial<RoomSourceSnapshot> = {},
): RoomSourceSnapshot => ({
  activeStageId: "act-1",
  currentRoomId: "main-stage",
  selectedContestantId: null,
  audioMode: "nearby",
  feedPaused: false,
  interactions: [],
  priorityContestantId: null,
  scenarioOverride: { type: "none" },
  currentUserMode: "perimeter",
  ...overrides,
});
