import type { ActDefinition } from "../types";

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
