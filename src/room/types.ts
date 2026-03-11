import type { ActDefinition } from "../types";

export interface ConversationState {
  speakerId: string;
  raisedHandId: string;
  listeningIds: string[];
  queuedIds: string[];
  callout: string;
}

export interface RoomConversationContestant {
  id: string;
  name: string;
}

export interface RoomConversationTeam {
  id: string;
  name: string;
  memberIds: string[];
  submissionHeadline: string;
}

export interface DeriveConversationStateInput {
  activeStage: Pick<ActDefinition, "id" | "title">;
  contestants: RoomConversationContestant[];
  focusTeam: RoomConversationTeam;
  teams: RoomConversationTeam[];
  leadingTeam: RoomConversationTeam;
  championTeamId?: string | null;
  leadingContestantId?: string;
  selectedContestantId?: string;
  priorityContestantId?: string | null;
  fallbackContestantId: string;
  nearbyHint: string;
}
