import type { ValidateFunction } from "ajv/dist/2020.js";
import { normalizeTurnDecision } from "../decisionNormalizer";
import { buildAgentSystemPrompt, buildAgentUserPrompt } from "../deepseekClient";
import type { ActionHints, AgentState, ArtDirection, MemoryEvent, OpponentSnapshot, Treaty, TurnDecision } from "../types";
import { relationSnapshot } from "./socialState";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export type DecisionRequestStatus = "ok" | "repaired" | "fallback";

export interface DecisionRequestResult {
  decision: TurnDecision;
  status: DecisionRequestStatus;
  detail?: string;
  persona_note: string;
  proactive_score: number;
}

export function buildOpponentSummary(agents: AgentState[], agentId: string): OpponentSnapshot[] {
  const self = agents.find((agent) => agent.id === agentId);
  const neutralRelationship = {
    trust: 0,
    affinity: 0,
    debt: 0,
    tension: 28,
    recent_shared_events: [] as string[]
  };

  return agents
    .filter((agent) => agent.id !== agentId)
    .map((agent) => ({
      id: agent.id,
      archetype: agent.identity_dna.archetype,
      core_values: agent.identity_dna.core_values.slice(0, 3),
      speech_style: agent.identity_dna.speech_style,
      signature_moves: agent.identity_dna.signature_moves.slice(0, 2),
      reputation: agent.reputation,
      emotion: agent.emotion,
      relationship: self ? relationSnapshot(self, agent.id) : neutralRelationship,
      ...(agent.persona ? { legacy_persona: agent.persona } : {})
    }));
}

export function buildRepairPrompt({
  agent,
  round,
  firstError,
  rawDecision,
  validActionHints,
  width,
  height
}: {
  agent: AgentState;
  round: number;
  firstError: string;
  rawDecision: unknown;
  validActionHints: ActionHints;
  width: number;
  height: number;
}): string {
  const compactRaw = (() => {
    try {
      const text = JSON.stringify(rawDecision);
      return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
    } catch {
      return String(rawDecision);
    }
  })();

  return [
    `round: ${round}`,
    `agent_id: ${agent.id}`,
    "你的上一条输出未通过校验，请修复。",
    "只允许输出一个JSON对象，禁止markdown。",
    "必填字段:",
    "agent_id, round, intent, public_message, private_messages, treaty_proposals, actions, emotion_delta, mood_change_reason",
    `坐标必须在 x=0..${width - 1}, y=0..${height - 1}`,
    `valid_action_hints: ${JSON.stringify(validActionHints)}`,
    "actions规则:",
    "- paint: {action:\"paint\",x:int,y:int,color:\"#RRGGBB\"}",
    "- fortify: {action:\"fortify\",x:int,y:int}",
    "- invade: {action:\"invade\",x:int,y:int}",
    "- burst: {action:\"burst\",center_x:int,center_y:int,radius:1}",
    "- wait: {action:\"wait\"}",
    `上一条输出: ${compactRaw}`,
    `校验错误: ${firstError}`,
    "现在返回修复后的合法TurnDecision JSON。"
  ].join("\n");
}

export function boundDecision(decision: TurnDecision, width: number, height: number): TurnDecision {
  const boundedActions: TurnDecision["actions"] = decision.actions.map((action) => {
    if (action.action === "paint" || action.action === "fortify" || action.action === "invade") {
      return {
        ...action,
        x: clamp(action.x, 0, width - 1),
        y: clamp(action.y, 0, height - 1)
      };
    }
    if (action.action === "burst") {
      return {
        ...action,
        center_x: clamp(action.center_x, 0, width - 1),
        center_y: clamp(action.center_y, 0, height - 1),
        radius: 1
      };
    }
    return action;
  });

  return {
    ...decision,
    actions: boundedActions.length > 0 ? boundedActions.slice(0, 3) : [{ action: "wait" }]
  };
}

export function sanitizeDecision({
  agent,
  rawDecision,
  round,
  width,
  height,
  validateDecision,
  buildFallbackDecision
}: {
  agent: AgentState;
  rawDecision: unknown;
  round: number;
  width: number;
  height: number;
  validateDecision: ValidateFunction<TurnDecision>;
  buildFallbackDecision: (agent: AgentState, round: number) => TurnDecision;
}): { decision: TurnDecision; error: string | null } {
  const fallback = buildFallbackDecision(agent, round);

  if (isObject(rawDecision) && validateDecision(rawDecision)) {
    const decision = rawDecision as TurnDecision;
    if (decision.agent_id !== agent.id) {
      decision.agent_id = agent.id;
    }
    if (decision.round !== round) {
      decision.round = round;
    }
    return { decision: boundDecision(decision, width, height), error: null };
  }

  const rawErrors = JSON.stringify(validateDecision.errors ?? []);
  const normalized = normalizeTurnDecision({
    raw: rawDecision,
    agentId: agent.id,
    round,
    color: agent.color
  });

  if (validateDecision(normalized)) {
    return { decision: boundDecision(normalized, width, height), error: null };
  }

  const normalizedErrors = JSON.stringify(validateDecision.errors ?? []);
  return {
    decision: fallback,
    error: JSON.stringify({
      raw_errors: rawErrors,
      normalized_errors: normalizedErrors
    })
  };
}

export async function requestAgentDecision({
  agent,
  round,
  agents,
  dryRun,
  width,
  height,
  artDirection,
  activeTreaties,
  events,
  deepSeek,
  validateDecision,
  buildActionHints,
  buildFallbackDecision,
  applyIdentitySteering,
  personalMythReading
}: {
  agent: AgentState;
  round: number;
  agents: AgentState[];
  dryRun: boolean;
  width: number;
  height: number;
  artDirection: ArtDirection;
  activeTreaties: Treaty[];
  events: MemoryEvent[];
  deepSeek: {
    generateDecision(args: { systemPrompt: string; userPrompt: string; temperature?: number }): Promise<unknown>;
  };
  validateDecision: ValidateFunction<TurnDecision>;
  buildActionHints: (agent: AgentState, round: number) => ActionHints;
  buildFallbackDecision: (agent: AgentState, round: number, validActionHints?: ActionHints) => TurnDecision;
  applyIdentitySteering: (
    agent: AgentState,
    decision: TurnDecision,
    hints: ActionHints,
    round: number
  ) => { decision: TurnDecision; note: string; proactive_score: number };
  personalMythReading: (agent: AgentState) => string;
}): Promise<DecisionRequestResult> {
  const validActionHints = buildActionHints(agent, round);

  const finalize = (payload: { decision: TurnDecision; status: DecisionRequestStatus; detail?: string }): DecisionRequestResult => {
    const steered = applyIdentitySteering(agent, payload.decision, validActionHints, round);
    return {
      decision: steered.decision,
      status: payload.status,
      detail: payload.detail,
      persona_note: steered.note,
      proactive_score: steered.proactive_score
    };
  };

  if (dryRun) {
    return finalize({
      decision: buildFallbackDecision(agent, round, validActionHints),
      status: "ok"
    });
  }

  const opponents = buildOpponentSummary(agents, agent.id);
  const systemPrompt = buildAgentSystemPrompt(agent, artDirection, personalMythReading(agent));
  const userPrompt = buildAgentUserPrompt({
    round,
    width,
    height,
    artDirection,
    selfState: {
      id: agent.id,
      identity_dna: agent.identity_dna,
      energy: agent.energy,
      cooldowns: agent.cooldowns,
      emotion: agent.emotion,
      reputation: agent.reputation,
      relations: agent.relations.slice(0, 5),
      last_round_summary: agent.last_round_summary
    },
    opponents,
    treaties: activeTreaties,
    lastEvents: events.filter((event) => event.round === round - 1).slice(-8),
    validActionHints
  });

  const firstRaw = await deepSeek.generateDecision({ systemPrompt, userPrompt });
  const firstPass = sanitizeDecision({
    agent,
    rawDecision: firstRaw,
    round,
    width,
    height,
    validateDecision,
    buildFallbackDecision: (inputAgent, inputRound) => buildFallbackDecision(inputAgent, inputRound, validActionHints)
  });
  if (!firstPass.error) {
    return finalize({ decision: firstPass.decision, status: "ok" });
  }

  try {
    const repairRaw = await deepSeek.generateDecision({
      systemPrompt: buildAgentSystemPrompt(agent, artDirection, personalMythReading(agent)),
      userPrompt: buildRepairPrompt({
        agent,
        round,
        firstError: firstPass.error,
        rawDecision: firstRaw,
        validActionHints,
        width,
        height
      }),
      temperature: 0.2
    });

    const repairedPass = sanitizeDecision({
      agent,
      rawDecision: repairRaw,
      round,
      width,
      height,
      validateDecision,
      buildFallbackDecision: (inputAgent, inputRound) => buildFallbackDecision(inputAgent, inputRound, validActionHints)
    });
    if (!repairedPass.error) {
      return finalize({
        decision: repairedPass.decision,
        status: "repaired",
        detail: firstPass.error
      });
    }

    return finalize({
      decision: repairedPass.decision,
      status: "fallback",
      detail: `first=${firstPass.error}; repair=${repairedPass.error}`
    });
  } catch (error) {
    return finalize({
      decision: buildFallbackDecision(agent, round, validActionHints),
      status: "fallback",
      detail: `first=${firstPass.error}; repair_request=${error instanceof Error ? error.message : String(error)}`
    });
  }
}
