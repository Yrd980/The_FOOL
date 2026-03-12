import type { ActionHints, AgentState, ArtDirection, OpponentSnapshot, Point, TurnAction, TurnDecision, TurnIntent } from "./types";

const ACTION_COST: Record<TurnAction["action"], number> = {
  wait: 0,
  paint: 1,
  fortify: 1,
  invade: 2,
  burst: 3
};

function stableHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
  }
  return hash;
}

function stableInt(key: string, max: number): number {
  if (max <= 0) return 0;
  return stableHash(key) % max;
}

function stableBetween(key: string, min: number, max: number): number {
  return min + stableInt(key, max - min + 1);
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function shiftColor(hex: string, delta: number): string {
  const match = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return hex;
  const value = match[1];
  const red = clampByte(parseInt(value.slice(0, 2), 16) + delta);
  const green = clampByte(parseInt(value.slice(2, 4), 16) + delta);
  const blue = clampByte(parseInt(value.slice(4, 6), 16) + delta);
  return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
}

function stablePairBias(agentId: string, targetId: string, round: number): number {
  const key = `${agentId}:${targetId}:${round}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 9973;
  }
  return (hash % 100) / 100;
}

function pickPoint(candidates: Point[], width: number, height: number, key: string): Point {
  if (candidates.length > 0) {
    return candidates[stableInt(key, Math.min(candidates.length, 3))];
  }
  return { x: stableInt(`${key}:x`, width), y: stableInt(`${key}:y`, height) };
}

function pickPaintColor(agent: AgentState, intent: TurnIntent, round: number, validActionHints: ActionHints, artDirection: ArtDirection): string {
  const directedPalette = validActionHints.palette_candidates?.length ? validActionHints.palette_candidates : artDirection.palette;
  const palette = [...directedPalette, agent.color, shiftColor(agent.color, 18), shiftColor(agent.color, -22), shiftColor(agent.color, 32)];
  if (intent === "art_focus") {
    return palette[round % palette.length];
  }
  if (agent.identity_dna.creativity_bias >= 75) {
    return palette[(round + 1) % palette.length];
  }
  return palette[0];
}

function pushAction(actions: TurnAction[], action: TurnAction, energyLeft: { value: number }): boolean {
  const cost = ACTION_COST[action.action];
  if (cost > energyLeft.value || actions.length >= 3) {
    return false;
  }

  const key =
    action.action === "burst"
      ? `${action.action}:${action.center_x},${action.center_y}`
      : action.action === "wait"
        ? "wait"
        : `${action.action}:${action.x},${action.y}`;

  const seen = new Set(
    actions.map((item) =>
      item.action === "burst"
        ? `${item.action}:${item.center_x},${item.center_y}`
        : item.action === "wait"
          ? "wait"
          : `${item.action}:${item.x},${item.y}`
    )
  );

  if (seen.has(key)) {
    return false;
  }

  actions.push(action);
  energyLeft.value -= cost;
  return true;
}

const BETRAY_THRESHOLD = 0.2;
const DIPLOMACY_BETRAY_THRESHOLD = 0.16;

function pickIntent(agent: AgentState, opponents: OpponentSnapshot[], round: number): TurnIntent {
  const dna = agent.identity_dna;
  const values = dna.core_values.map((value) => value.toLowerCase());
  const mostTense = [...opponents].sort((left, right) => right.relationship.tension - left.relationship.tension)[0];
  const mostTrusted = [...opponents].sort(
    (left, right) => right.relationship.trust + right.relationship.affinity - (left.relationship.trust + left.relationship.affinity)
  )[0];

  if ((agent.emotion.anger > 65 || (mostTense && mostTense.relationship.debt >= 16)) && dna.aggression_bias >= 55) return "revenge";
  if (agent.emotion.fear > 60 || dna.risk_appetite <= 35) return "defend";
  if (dna.creativity_bias >= 75 || values.some((value) => value.includes("beauty") || value.includes("legacy") || value.includes("craft"))) {
    return "art_focus";
  }
  if (mostTrusted && mostTrusted.relationship.trust >= 18 && dna.diplomacy_bias >= 60) {
    return "cooperate";
  }
  if (
    mostTense &&
    mostTense.relationship.tension >= 70 &&
    dna.diplomacy_bias >= 58 &&
    stablePairBias(agent.id, mostTense.id, round) < BETRAY_THRESHOLD
  ) {
    return "betray";
  }
  if (dna.diplomacy_bias >= 72 && dna.aggression_bias < 60) {
    return mostTrusted && stablePairBias(agent.id, mostTrusted.id, round) < DIPLOMACY_BETRAY_THRESHOLD ? "betray" : "cooperate";
  }
  if (dna.aggression_bias >= 68 || values.some((value) => value.includes("pressure") || value.includes("growth") || value.includes("tempo"))) {
    return "expand";
  }
  return "cooperate";
}

function chooseTarget(agent: AgentState, opponents: OpponentSnapshot[], intent: TurnIntent, round: number): string {
  if (opponents.length === 0) return agent.id;

  const ranked = [...opponents].sort((left, right) => {
    if (intent === "revenge" || intent === "expand") {
      return (
        right.relationship.tension +
        right.relationship.debt -
        (left.relationship.tension + left.relationship.debt) ||
        stablePairBias(agent.id, right.id, round) * 6 - stablePairBias(agent.id, left.id, round) * 6 ||
        left.reputation - right.reputation ||
        right.emotion.confidence - left.emotion.confidence
      );
    }
    if (intent === "betray") {
      return (
        right.relationship.trust +
        right.relationship.affinity -
        (left.relationship.trust + left.relationship.affinity) ||
        stablePairBias(agent.id, right.id, round) * 4 - stablePairBias(agent.id, left.id, round) * 4 ||
        right.reputation - left.reputation
      );
    }
    return (
      right.relationship.trust +
      right.relationship.affinity -
      (left.relationship.trust + left.relationship.affinity) ||
      stablePairBias(agent.id, right.id, round) * 5 - stablePairBias(agent.id, left.id, round) * 5 ||
      right.reputation - left.reputation ||
      right.emotion.confidence - left.emotion.confidence
    );
  });

  return ranked[0]?.id ?? agent.id;
}

function buildActions(
  agent: AgentState,
  intent: TurnIntent,
  width: number,
  height: number,
  validActionHints: ActionHints,
  round: number,
  artDirection: ArtDirection
): TurnAction[] {
  const dna = agent.identity_dna;
  const values = dna.core_values.map((value) => value.toLowerCase());
  const actions: TurnAction[] = [];
  const energyLeft = { value: agent.energy };

  const priorities: Array<{ action: "paint" | "fortify" | "invade"; score: number }> = [
    {
      action: "paint" as const,
      score:
        dna.creativity_bias +
        (intent === "art_focus" ? 22 : 0) +
        (values.some((value) => value.includes("beauty") || value.includes("legacy")) ? 12 : 0)
    },
    {
      action: "fortify" as const,
      score:
        100 - dna.risk_appetite +
        dna.diplomacy_bias * 0.45 +
        (intent === "defend" ? 18 : 0) +
        (values.some((value) => value.includes("stability") || value.includes("honor") || value.includes("survival")) ? 10 : 0)
    },
    {
      action: "invade" as const,
      score:
        dna.aggression_bias +
        dna.risk_appetite * 0.35 +
        agent.emotion.anger * 0.4 +
        (intent === "revenge" || intent === "expand" ? 16 : 0)
    }
  ].sort((left, right) => right.score - left.score);

  if (
    agent.cooldowns.burst === 0 &&
    validActionHints.burst_centers.length > 0 &&
    (intent === "revenge" || dna.aggression_bias + agent.emotion.confidence >= 150)
  ) {
    const center = pickPoint(validActionHints.burst_centers, width, height, `${agent.id}:${round}:${intent}:burst`);
    pushAction(actions, { action: "burst", center_x: center.x, center_y: center.y, radius: 1 }, energyLeft);
  }

  for (const priority of priorities) {
    if (actions.length >= 3) break;

    if (priority.action === "paint") {
      const point = pickPoint(validActionHints.paint_candidates, width, height, `${agent.id}:${round}:${intent}:paint:${actions.length}`);
      pushAction(actions, { action: "paint", x: point.x, y: point.y, color: pickPaintColor(agent, intent, round, validActionHints, artDirection) }, energyLeft);
      continue;
    }

    if (priority.action === "fortify") {
      const point = pickPoint(validActionHints.fortify_candidates, width, height, `${agent.id}:${round}:${intent}:fortify:${actions.length}`);
      pushAction(actions, { action: "fortify", x: point.x, y: point.y }, energyLeft);
      continue;
    }

    const point = pickPoint(validActionHints.invade_candidates, width, height, `${agent.id}:${round}:${intent}:invade:${actions.length}`);
    pushAction(actions, { action: "invade", x: point.x, y: point.y }, energyLeft);
  }

  if (actions.length === 0) {
    const point = pickPoint(validActionHints.paint_candidates, width, height, `${agent.id}:${round}:${intent}:fallback`);
    pushAction(actions, {
      action: "paint",
      x: point.x,
      y: point.y,
      color: pickPaintColor(agent, intent, round, validActionHints, artDirection)
    }, energyLeft);
  }

  return actions.length > 0 ? actions : [{ action: "wait" }];
}

function buildPublicMessage(agent: AgentState, intent: TurnIntent): string {
  const style = agent.identity_dna.speech_style.toLowerCase();
  const identityToken = (agent.identity_dna.core_values[0] || agent.identity_dna.archetype).toLowerCase();
  const archetypeToken = agent.identity_dna.archetype.toLowerCase();

  if (style.includes("expressive") || style.includes("poetic")) {
    if (intent === "art_focus") return `${archetypeToken} shapes ${identityToken} into the border.`;
    if (intent === "revenge") return `${archetypeToken} remembers the cut and answers it.`;
    return `${archetypeToken} puts ${identityToken} before noise.`;
  }

  if (style.includes("calm") || style.includes("measured") || style.includes("analytical")) {
    if (intent === "defend") return `${archetypeToken} holds the line for ${identityToken}.`;
    if (intent === "cooperate") return `${archetypeToken} keeps this edge steady in ${identityToken}.`;
    return `${archetypeToken} keeps ${identityToken} under control.`;
  }

  if (style.includes("playful") || style.includes("ironic") || style.includes("sly")) {
    if (intent === "betray") return `${archetypeToken} smiles once and flips ${identityToken} twice.`;
    return `${archetypeToken} hides ${identityToken} until it is too late.`;
  }

  if (intent === "revenge") return `${archetypeToken} takes that space back for ${identityToken}.`;
  if (intent === "art_focus") return `${archetypeToken} wants a cleaner ${identityToken} pattern.`;
  if (intent === "cooperate") return `${archetypeToken} keeps the border quiet for ${identityToken}.`;
  return `${archetypeToken} leans forward with ${identityToken}.`;
}

function buildPrivateMessage(agent: AgentState, target: OpponentSnapshot | undefined, intent: TurnIntent): TurnDecision["private_messages"] {
  if (!target || target.id === agent.id) return [];
  const recent = target.relationship.recent_shared_events[0];
  const historyTag = recent ? ` We remember ${recent}.` : "";

  if (intent === "cooperate" || intent === "defend") {
    const content = `${agent.identity_dna.archetype} asks for calm.${historyTag || " Keep this lane calm for two rounds."}`;
    return [{ target_id: target.id, content: content.slice(0, 50) }];
  }

  if (intent === "betray") {
    return [{ target_id: target.id, content: `Stay relaxed.${historyTag}`.slice(0, 50) }];
  }

  if (intent === "revenge" || intent === "expand") {
    const content = target.relationship.debt > 0 ? `You still owe this border an answer.${historyTag}` : `Do not mistake pressure for hesitation.${historyTag}`;
    return [{ target_id: target.id, content }];
  }

  return [];
}

function buildTreaty(agent: AgentState, round: number, target: OpponentSnapshot | undefined, intent: TurnIntent): TurnDecision["treaty_proposals"] {
  if (!target || target.id === agent.id) return [];
  if (intent !== "cooperate" && intent !== "defend") return [];
  if (agent.identity_dna.diplomacy_bias < 58) return [];
  if (target.relationship.trust < 8 && target.relationship.affinity < 0) return [];

  return [
    {
      proposal_id: `${agent.id.slice(0, 18)}_${round}`.slice(0, 24),
      target_id: target.id,
      type: "no_attack",
      duration_rounds: 2
    }
  ];
}

function buildEmotionDelta(agentId: string, round: number, intent: TurnIntent): TurnDecision["emotion_delta"] {
  const delta = (label: string, min: number, max: number) => stableBetween(`${agentId}:${round}:${intent}:${label}`, min, max);
  if (intent === "revenge") {
    return { anger: delta("anger", 1, 4), fear: delta("fear", -2, 1), confidence: delta("confidence", 0, 3), satisfaction: delta("satisfaction", -1, 2) };
  }
  if (intent === "defend") {
    return { anger: delta("anger", -1, 2), fear: delta("fear", 0, 3), confidence: delta("confidence", -1, 2), satisfaction: delta("satisfaction", -1, 2) };
  }
  if (intent === "art_focus") {
    return { anger: delta("anger", -2, 1), fear: delta("fear", -2, 1), confidence: delta("confidence", 1, 4), satisfaction: delta("satisfaction", 1, 4) };
  }
  return { anger: delta("anger", -2, 2), fear: delta("fear", -2, 2), confidence: delta("confidence", 0, 3), satisfaction: delta("satisfaction", 0, 3) };
}

export function buildMockDecision({
  agent,
  round,
  width,
  height,
  opponents,
  validActionHints,
  artDirection
}: {
  agent: AgentState;
  round: number;
  width: number;
  height: number;
  opponents: OpponentSnapshot[];
  validActionHints: ActionHints;
  artDirection: ArtDirection;
}): TurnDecision {
  const intent = pickIntent(agent, opponents, round);
  const target = chooseTarget(agent, opponents, intent, round);
  const targetSnapshot = opponents.find((item) => item.id === target);

  return {
    agent_id: agent.id,
    round,
    intent,
    public_message: buildPublicMessage(agent, intent),
    private_messages: buildPrivateMessage(agent, targetSnapshot, intent),
    treaty_proposals: buildTreaty(agent, round, targetSnapshot, intent),
    actions: buildActions(agent, intent, width, height, validActionHints, round, artDirection),
    emotion_delta: buildEmotionDelta(agent.id, round, intent),
    mood_change_reason: `${agent.identity_dna.archetype} reacted to frontline pressure`
  };
}
