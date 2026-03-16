import type { ActDefinition, AudienceInteraction, OpenClawContestantState } from "../types";

export interface ConversationState {
  speakerId: string | null;
  raisedHandId: string | null;
  listeningIds: string[];
  queuedIds: string[];
  callout: string;
}

export interface DeriveConversationStateInput {
  activeStageId: ActDefinition["id"];
  activeStageTitle: string;
  orderedContestantIds: string[];
  focusIds: string[];
  championIds: string[];
  leadingContestantId: string | null;
  defaultSpeakerId: string | null;
  selectedContestantId: string | null;
  focusTeamName: string;
  focusHeadline: string;
  nearbyHint: string;
  contestantNameById: Record<string, string>;
  priorityContestantId: string | null;
}

export type AudioMode = "nearby" | "focus" | "muted";

export interface RoomSeat {
  id: string;
  state: OpenClawContestantState;
}

export interface BuildRoomViewModelInput {
  conversationState: ConversationState;
  orderedContestantIds: string[];
  interactions: AudienceInteraction[];
  audioMode: AudioMode;
  nearbyHint: string;
  contestantNameById: Record<string, string>;
  teams?: ReadonlyArray<{ id: string; name: string; members: ReadonlyArray<{ id: string }> }>;
  focusTeamId?: string;
  currentRoom?: RoomListItem;
  seatStateOverrides?: Partial<Record<string, OpenClawContestantState>>;
  scenarioOverride?: ScenarioOverride;
  currentRoomId?: string;
}

export interface RoomViewModel {
  openClawSeats: RoomSeat[];
  activeSpeakerId: string | null;
  raisedHandId: string | null;
  micCount: number;
  queueCount: number;
  roomSignals: AudienceInteraction[];
  audibleSignals: AudienceInteraction[];
  roomCallout: string;
}

export interface AppendSeedInteractionInput {
  current: AudienceInteraction[];
  contestants: ReadonlyArray<{ id: string; name: string }>;
  audienceHandles: readonly string[];
  danmuTemplates: readonly string[];
}

export type RoomKind = "main-stage" | "team-room" | "quiet-orbit";

export interface RoomListItem {
  id: string;
  name: string;
  kind: RoomKind;
  teamId?: string;
  memberIds: string[];
  memberCount: number;
  audibleSummary: string;
  statusLabel: string;
  active: boolean;
}

export interface RoomDirectory {
  currentRoom: RoomListItem;
  rooms: RoomListItem[];
  switchTargets: Array<{ id: string; name: string }>;
}

export interface BuildRoomDirectoryInput {
  currentRoomId: string;
  conversationState: ConversationState;
  teams: ReadonlyArray<{ id: string; name: string; members: ReadonlyArray<{ id: string }> }>;
  orderedContestantIds: string[];
  listenerEntityIds: string[];
}

export type ScenarioOverride =
  | { type: "none" }
  | { type: "wave-over" | "quiet-room" | "empty-room"; targetRoomId: string; targetContestantId?: string };

export interface RoomSourceSnapshot {
  activeStageId: string;
  currentRoomId: string;
  selectedContestantId: string | null;
  audioMode: AudioMode;
  feedPaused: boolean;
  interactions: AudienceInteraction[];
  priorityContestantId: string | null;
  scenarioOverride: ScenarioOverride;
  currentUserMode: "perimeter" | "listening";
  connectionStatus?: import("./gateway/types").ConnectionState;
  onlineCount?: number;
  seatStateByContestantId?: Partial<Record<string, OpenClawContestantState>>;
}

export type RoomAction =
  | { type: "switch-room"; roomId: string }
  | { type: "join-conversation" }
  | { type: "leave-conversation" }
  | { type: "set-audio-mode"; mode: AudioMode }
  | { type: "toggle-feed-paused" }
  | { type: "inject-scenario"; scenario: string; targetRoomId?: string; targetContestantId?: string }
  | { type: "reset-demo" };

export interface RoomActionApi {
  switchRoom: (roomId: string) => void;
  joinConversation: () => void;
  leaveConversation: () => void;
  setAudioMode: (mode: AudioMode) => void;
  toggleFeedPaused: () => void;
  injectScenario: (scenario: string, targetRoomId?: string) => void;
  resetDemo: () => void;
  setActiveStageId: (stageId: string) => void;
  setSelectedContestantId: (id: string | null) => void;
  setPriorityContestantId: (id: string | null) => void;
}

export interface SeedRoomSourceInputs {
  contestantDeck: ReadonlyArray<{ id: string; name: string }>;
  gatewayContestants: ReadonlyArray<{ id: string; name: string }>;
  teams: ReadonlyArray<{ id: string; name: string; members: ReadonlyArray<{ id: string }> }>;
  focusTeam: {
    id: string;
    name: string;
    submission: { headline: string };
    members: ReadonlyArray<{ id: string }>;
  };
  aiResults: { summaries: ReadonlyArray<{ teamId: string }> };
  audienceSummary: { leadingContestantId: string; leadingTeamId: string };
  activeStageId: string;
  activeStageTitle: string;
  nearbyHint: string;
  contestantNameById: Record<string, string>;
  selectedContestantId: string | null;
  focusHeadline: string;
  listenerEntityIds: string[];
}

export interface SeedRoomSourceResult {
  snapshot: RoomSourceSnapshot;
  roomDirectory: RoomDirectory;
  roomViewModel: RoomViewModel;
  actions: RoomActionApi;
}
