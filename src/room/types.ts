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
