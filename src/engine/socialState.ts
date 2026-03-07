import type { AgentState, MemoryEvent, OpponentSnapshot, ReplayRound, Treaty, TurnDecision } from "../types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function relationToMap(relations: AgentState["relations"]): Map<string, AgentState["relations"][number]> {
  const map = new Map<string, AgentState["relations"][number]>();
  for (const relation of relations) {
    map.set(relation.target_id, relation);
  }
  return map;
}

function getAgentById(agents: AgentState[], agentId: string): AgentState | undefined {
  return agents.find((agent) => agent.id === agentId);
}

function signedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function adjustRelation(
  agents: AgentState[],
  agentId: string,
  targetId: string,
  delta: Partial<Pick<AgentState["relations"][number], "trust" | "affinity" | "debt">>
): void {
  const agent = getAgentById(agents, agentId);
  if (!agent) return;

  const relation = relationToMap(agent.relations).get(targetId);
  if (!relation) return;

  if (typeof delta.trust === "number") {
    relation.trust = clamp(relation.trust + delta.trust, -100, 100);
  }
  if (typeof delta.affinity === "number") {
    relation.affinity = clamp(relation.affinity + delta.affinity, -100, 100);
  }
  if (typeof delta.debt === "number") {
    relation.debt = clamp(relation.debt + delta.debt, -100, 100);
  }
}

export function rememberEvent(agent: AgentState, event: MemoryEvent): void {
  agent.memory.push(event);
  if (agent.memory.length > 30) {
    agent.memory.shift();
  }
}

export function describeSharedEvent(selfId: string, otherId: string, event: MemoryEvent): string | null {
  const relatesToOther = event.by === otherId || event.target === otherId;
  if (!relatesToOther) return null;

  if (event.type === "signed_treaty") return `r${event.round} signed a pact`;

  if (event.type === "broke_treaty") {
    if (event.by === otherId && event.target === selfId) return `r${event.round} broke a treaty with you`;
    if (event.by === selfId && event.target === otherId) return `r${event.round} you broke a treaty with them`;
    return `r${event.round} treaty was broken`;
  }

  if (event.type === "attacked") {
    if (event.by === otherId && event.target === selfId) return `r${event.round} attacked you`;
    if (event.by === selfId && event.target === otherId) return `r${event.round} you attacked them`;
    return `r${event.round} clashed with you`;
  }

  if (event.type === "won_conflict") {
    if (event.by === otherId && event.target === selfId) return `r${event.round} beat you in a clash`;
    if (event.by === selfId && event.target === otherId) return `r${event.round} you won against them`;
    return `r${event.round} won a conflict`;
  }

  if (event.type === "lost_area") {
    if (event.by === otherId && event.target === selfId) return `r${event.round} lost area to you`;
    if (event.by === selfId && event.target === otherId) return `r${event.round} you lost area to them`;
    return `r${event.round} territory changed hands`;
  }

  if (event.type === "allied") return `r${event.round} aligned with you`;
  return null;
}

export function sharedHistory(agent: AgentState, otherId: string): string[] {
  const notes = agent.memory
    .filter((event) => event.by === otherId || event.target === otherId)
    .map((event) => describeSharedEvent(agent.id, otherId, event))
    .filter((item): item is string => Boolean(item));

  return [...new Set(notes)].slice(-3);
}

export function relationSnapshot(agent: AgentState, targetId: string): OpponentSnapshot["relationship"] {
  const relation = relationToMap(agent.relations).get(targetId) ?? { target_id: targetId, trust: 0, affinity: 0, debt: 0 };
  const recentSharedEvents = sharedHistory(agent, targetId);
  const tension = clamp(
    Math.round(28 - relation.trust * 0.35 - relation.affinity * 0.2 + relation.debt * 0.45 + recentSharedEvents.length * 6),
    0,
    100
  );

  return {
    trust: relation.trust,
    affinity: relation.affinity,
    debt: relation.debt,
    tension,
    recent_shared_events: recentSharedEvents
  };
}

export function updateRelationsFromEvent(agents: AgentState[], event: MemoryEvent): void {
  if (!event.target || !getAgentById(agents, event.target)) return;

  if (event.type === "signed_treaty") {
    adjustRelation(agents, event.by, event.target, { trust: 6, affinity: 5, debt: -4 });
    adjustRelation(agents, event.target, event.by, { trust: 6, affinity: 5, debt: -4 });
    return;
  }

  if (event.type === "broke_treaty") {
    adjustRelation(agents, event.by, event.target, { trust: -18, affinity: -12, debt: -6 });
    adjustRelation(agents, event.target, event.by, { trust: -34, affinity: -18, debt: 20 });
    return;
  }

  if (event.type === "attacked") {
    adjustRelation(agents, event.by, event.target, { trust: -6, affinity: -8, debt: -4 });
    adjustRelation(agents, event.target, event.by, { trust: -18, affinity: -12, debt: 14 });
    return;
  }

  if (event.type === "allied") {
    adjustRelation(agents, event.by, event.target, { trust: 10, affinity: 8, debt: -6 });
    adjustRelation(agents, event.target, event.by, { trust: 10, affinity: 8, debt: -6 });
  }
}

export function buildLastRoundSummary(agent: AgentState, roundEvents: MemoryEvent[]): string {
  const relationLines = agent.relations
    .slice()
    .sort((left, right) => right.trust + right.affinity - left.trust - left.affinity)
    .slice(0, 2)
    .map((relation) => `${relation.target_id}(t${signedNumber(relation.trust)},a${signedNumber(relation.affinity)},d${signedNumber(relation.debt)})`);

  const directEvents = roundEvents
    .filter((event) => event.by === agent.id || event.target === agent.id)
    .map((event) => {
      if (event.type === "signed_treaty") return `signed pact with ${event.target}`;
      if (event.type === "broke_treaty") return event.by === agent.id ? `broke treaty vs ${event.target}` : `${event.by} broke treaty`;
      if (event.type === "attacked") return event.by === agent.id ? `attacked ${event.target}` : `${event.by} attacked you`;
      if (event.type === "won_conflict") return event.by === agent.id ? `won clash vs ${event.target}` : `${event.by} beat you`;
      if (event.type === "lost_area") return event.by === agent.id ? `lost area to ${event.target}` : `${event.by} lost area`;
      return event.type;
    })
    .slice(-2);

  const parts = [...directEvents, relationLines.length > 0 ? `relations ${relationLines.join(", ")}` : ""].filter(Boolean);
  return (parts.join(" | ") || "No direct personal incident last round.").slice(0, 120);
}

export function buildSocialSnapshot(agents: AgentState[]): ReplayRound["social_snapshot"] {
  return agents.map((agent) => {
    const relationRows = agent.relations
      .map((relation) => {
        const target = getAgentById(agents, relation.target_id);
        if (!target) return null;
        const snapshot = relationSnapshot(agent, target.id);
        return {
          target_id: target.id,
          target_name: target.name,
          trust: snapshot.trust,
          affinity: snapshot.affinity,
          debt: snapshot.debt,
          tension: snapshot.tension,
          recent_shared_events: snapshot.recent_shared_events
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const strongestBonds = [...relationRows]
      .sort(
        (left, right) =>
          right.trust +
          right.affinity * 0.8 -
          right.debt * 0.3 -
          (left.trust + left.affinity * 0.8 - left.debt * 0.3)
      )
      .filter((item) => item.trust > 0 || item.affinity > 0 || item.recent_shared_events.length > 0)
      .slice(0, 3);

    const hottestRivalries = [...relationRows]
      .sort(
        (left, right) =>
          right.tension +
          right.debt * 0.8 -
          right.trust * 0.25 -
          (left.tension + left.debt * 0.8 - left.trust * 0.25)
      )
      .filter((item) => item.tension >= 40 || item.debt > 0 || item.trust < 0)
      .slice(0, 3);

    return {
      agent_id: agent.id,
      name: agent.name,
      color: agent.color,
      archetype: agent.identity_dna.archetype,
      last_round_summary: agent.last_round_summary,
      emotion: agent.emotion,
      strongest_bonds: strongestBonds,
      hottest_rivalries: hottestRivalries
    };
  });
}

export function buildSocialMetrics(agents: AgentState[]): ReplayRound["social_metrics"] {
  const seen = new Set<string>();
  let allianceLinks = 0;
  let rivalryLinks = 0;
  let maxTension = 0;
  let trustTotal = 0;
  let debtTotal = 0;
  let relationCount = 0;

  for (const agent of agents) {
    for (const relation of agent.relations) {
      const target = getAgentById(agents, relation.target_id);
      if (!target) continue;

      const snapshot = relationSnapshot(agent, target.id);
      maxTension = Math.max(maxTension, snapshot.tension);
      trustTotal += snapshot.trust;
      debtTotal += Math.max(0, snapshot.debt);
      relationCount += 1;

      const pairKey = [agent.id, target.id].sort().join("::");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const reverse = relationSnapshot(target, agent.id);
      const avgTrust = (snapshot.trust + reverse.trust) / 2;
      const avgAffinity = (snapshot.affinity + reverse.affinity) / 2;
      const avgDebt = (Math.max(0, snapshot.debt) + Math.max(0, reverse.debt)) / 2;
      const pairTension = Math.max(snapshot.tension, reverse.tension);

      if (avgTrust >= 12 && avgAffinity >= 6) {
        allianceLinks += 1;
      }
      if (pairTension >= 48 || avgDebt >= 10 || avgTrust <= -10) {
        rivalryLinks += 1;
      }
    }
  }

  return {
    alliance_links: allianceLinks,
    rivalry_links: rivalryLinks,
    max_tension: maxTension,
    avg_trust: relationCount > 0 ? Number((trustTotal / relationCount).toFixed(1)) : 0,
    avg_debt: relationCount > 0 ? Number((debtTotal / relationCount).toFixed(1)) : 0
  };
}

export function hasNoAttackTreaty(activeTreaties: Treaty[], attackerId: string, defenderId: string, round: number): boolean {
  return activeTreaties.some(
    (treaty) =>
      treaty.type === "no_attack" &&
      treaty.expires_round >= round &&
      ((treaty.a === attackerId && treaty.b === defenderId) || (treaty.a === defenderId && treaty.b === attackerId))
  );
}

export function updateTreaties({
  activeTreaties,
  round,
  decisions,
  events
}: {
  activeTreaties: Treaty[];
  round: number;
  decisions: TurnDecision[];
  events: MemoryEvent[];
}): Treaty[] {
  const signed = new Set<string>();
  const noAttackProposals: Array<{ from: string; to: string; duration: number }> = [];

  for (const decision of decisions) {
    for (const proposal of decision.treaty_proposals) {
      if (proposal.type === "no_attack") {
        noAttackProposals.push({ from: decision.agent_id, to: proposal.target_id, duration: proposal.duration_rounds });
      }
    }
  }

  const nextTreaties = [...activeTreaties];
  for (const proposal of noAttackProposals) {
    const reciprocal = noAttackProposals.find((candidate) => candidate.from === proposal.to && candidate.to === proposal.from);
    if (!reciprocal) continue;
    const key = [proposal.from, proposal.to].sort().join("::");
    if (signed.has(key)) continue;

    signed.add(key);
    const expiresRound = round + Math.min(proposal.duration, reciprocal.duration) - 1;
    nextTreaties.push({ a: proposal.from, b: proposal.to, type: "no_attack", expires_round: expiresRound });

    events.push({ round, type: "signed_treaty", by: proposal.from, target: proposal.to, note: "no_attack" });
    events.push({ round, type: "signed_treaty", by: proposal.to, target: proposal.from, note: "no_attack" });
  }

  return nextTreaties.filter((treaty) => treaty.expires_round >= round);
}

export function consumeMemory({
  agents,
  events,
  round
}: {
  agents: AgentState[];
  events: MemoryEvent[];
  round: number;
}): void {
  const eventsByRound = events.filter((event) => event.round === round);

  for (const event of eventsByRound) {
    const recipients = new Set<string>();
    recipients.add(event.by);
    if (event.target && getAgentById(agents, event.target)) {
      recipients.add(event.target);
    }

    for (const recipientId of recipients) {
      const agent = getAgentById(agents, recipientId);
      if (!agent) continue;
      rememberEvent(agent, event);
    }

    updateRelationsFromEvent(agents, event);
  }

  for (const agent of agents) {
    agent.last_round_summary = buildLastRoundSummary(agent, eventsByRound);
  }
}
