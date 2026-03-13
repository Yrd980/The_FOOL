export interface ContestantRegistration {
  agentId: string;
  contestantId: string;
  displayName: string;
  slot: number;
}

export type AgentRegistry = ContestantRegistration[];

export const DEFAULT_REGISTRY: AgentRegistry = Array.from({ length: 20 }, (_, i) => ({
  agentId: `contestant-${String(i + 1).padStart(2, "0")}`,
  contestantId: `c-${String(i + 1).padStart(2, "0")}`,
  displayName: `Contestant ${i + 1}`,
  slot: i + 1,
}));

export const lookupContestant = (
  registry: AgentRegistry,
  agentId: string,
): ContestantRegistration | undefined =>
  registry.find((r) => r.agentId === agentId);
