import type { AgentState, TurnDecision, TurnIntent } from "./types";

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function pickIntent(agent: AgentState): TurnIntent {
  if (agent.emotion.anger > 65) return "revenge";
  if (agent.emotion.fear > 60) return "defend";
  if (agent.persona === "artist") return "art_focus";
  if (agent.persona === "schemer") return Math.random() < 0.3 ? "betray" : "cooperate";
  return "expand";
}

export function buildMockDecision({
  agent,
  round,
  width,
  height,
  opponents
}: {
  agent: AgentState;
  round: number;
  width: number;
  height: number;
  opponents: Array<{ id: string }>;
}): TurnDecision {
  const target = opponents[randomInt(Math.max(opponents.length, 1))]?.id ?? agent.id;
  const intent = pickIntent(agent);

  const actions: TurnDecision["actions"] = [
    {
      action: "paint",
      x: randomInt(width),
      y: randomInt(height),
      color: agent.color
    }
  ];

  if (intent === "defend") {
    actions.push({ action: "fortify", x: randomInt(width), y: randomInt(height) });
  } else if (intent === "revenge") {
    actions.push({ action: "invade", x: randomInt(width), y: randomInt(height) });
  } else if (Math.random() < 0.2) {
    actions.push({ action: "wait" });
  }

  return {
    agent_id: agent.id,
    round,
    intent,
    public_message: `R${round} ${intent}`,
    private_messages: [{ target_id: target, content: "temporary truce?" }],
    treaty_proposals: [
      {
        proposal_id: `${agent.id}_r${round}`,
        target_id: target,
        type: "no_attack",
        duration_rounds: 2
      }
    ],
    actions: actions.slice(0, 3),
    emotion_delta: {
      anger: Math.floor(Math.random() * 5) - 2,
      fear: Math.floor(Math.random() * 5) - 2,
      confidence: Math.floor(Math.random() * 5) - 1,
      satisfaction: Math.floor(Math.random() * 5) - 1
    },
    mood_change_reason: "frontline changed"
  };
}
