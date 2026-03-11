import type {
  ActDefinition,
  AiTeamSummary,
  AudienceOverview,
  ContestantScorecard,
  TeamSummary,
} from "../types";

export interface ConversationState {
  speakerId: string;
  raisedHandId: string;
  listeningIds: string[];
  queuedIds: string[];
  callout: string;
}

export interface DeriveConversationStateInput {
  activeStage: Pick<ActDefinition, "id" | "title">;
  contestantDeck: ContestantScorecard[];
  contestantMap: Record<string, ContestantScorecard>;
  focusTeam: TeamSummary;
  teams: TeamSummary[];
  leadingTeam: TeamSummary;
  aiSummaries: AiTeamSummary[];
  audienceSummary: Pick<AudienceOverview, "leadingContestantId">;
  selectedContestant?: Pick<ContestantScorecard, "id">;
  priorityContestantId?: string | null;
  fallbackContestantId: string;
  nearbyHint: string;
}
