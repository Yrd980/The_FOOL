export interface ContestantRegistration {
  agentId: string;
  contestantId: string;
  displayName: string;
  slot: number;
}

export type AgentRegistry = ContestantRegistration[];

const buildAgentId = (slot: number): string => `contestant-${String(slot).padStart(2, "0")}`;

export const DEFAULT_REGISTRY: AgentRegistry = Array.from({ length: 20 }, (_, i) => {
  const slot = i + 1;
  return {
    agentId: buildAgentId(slot),
    contestantId: `c-${String(slot).padStart(2, "0")}`,
    displayName: `Contestant ${slot}`,
    slot,
  };
});

export const buildAgentRegistry = (
  contestants: ReadonlyArray<{ id: string; name?: string }>,
): AgentRegistry =>
  contestants.map((contestant, index) => {
    const slot = index + 1;
    return {
      agentId: buildAgentId(slot),
      contestantId: contestant.id,
      displayName: contestant.name ?? `Contestant ${slot}`,
      slot,
    };
  });

export const lookupContestant = (
  registry: AgentRegistry,
  agentId: string,
): ContestantRegistration | undefined =>
  registry.find((r) => r.agentId === agentId);
