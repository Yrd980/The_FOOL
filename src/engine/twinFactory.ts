import fs from "node:fs";
import path from "node:path";
import type { ValidateFunction } from "ajv/dist/2020.js";
import type { EngineContext } from "./engineContext";
import type { AgentState, ArtDirection, DigitalTwinProfile, IdentityDNA } from "../types";
import { COLORS, DEFAULT_TWIN_DNA_LIBRARY, LEGACY_PERSONAS } from "./constants";

type BoardCell = {
  owner: string | null;
  color: string;
  fortify: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function goalWeightsFromDNA(dna: IdentityDNA): AgentState["goal_weights"] {
  const values = dna.core_values.map((value) => value.toLowerCase());
  const territory =
    0.18 +
    dna.risk_appetite * 0.0022 +
    dna.aggression_bias * 0.0025 +
    (values.some((value) => value.includes("growth") || value.includes("pressure") || value.includes("tempo")) ? 0.14 : 0);
  const art =
    0.08 +
    dna.creativity_bias * 0.0032 +
    (values.some((value) => value.includes("beauty") || value.includes("legacy") || value.includes("craft")) ? 0.16 : 0);
  const revenge =
    0.06 +
    dna.aggression_bias * 0.0019 +
    dna.risk_appetite * 0.0012 +
    (values.some((value) => value.includes("revenge") || value.includes("presence") || value.includes("advantage")) ? 0.14 : 0);
  const reputation =
    0.1 +
    dna.diplomacy_bias * 0.0028 +
    (values.some((value) => value.includes("honor") || value.includes("alliance") || value.includes("reputation")) ? 0.15 : 0);

  const sum = territory + art + revenge + reputation;
  return {
    territory: Number((territory / sum).toFixed(4)),
    art: Number((art / sum).toFixed(4)),
    revenge: Number((revenge / sum).toFixed(4)),
    reputation: Number((reputation / sum).toFixed(4))
  };
}

function normalizeGoalWeights(dna: IdentityDNA, overrideWeights?: Partial<AgentState["goal_weights"]>): AgentState["goal_weights"] {
  const base = goalWeightsFromDNA(dna);
  const merged = {
    territory: overrideWeights?.territory ?? base.territory,
    art: overrideWeights?.art ?? base.art,
    revenge: overrideWeights?.revenge ?? base.revenge,
    reputation: overrideWeights?.reputation ?? base.reputation
  };

  const safe = {
    territory: Math.max(0, merged.territory),
    art: Math.max(0, merged.art),
    revenge: Math.max(0, merged.revenge),
    reputation: Math.max(0, merged.reputation)
  };

  const sum = safe.territory + safe.art + safe.revenge + safe.reputation;
  if (sum <= 0) return base;
  return {
    territory: Number((safe.territory / sum).toFixed(4)),
    art: Number((safe.art / sum).toFixed(4)),
    revenge: Number((safe.revenge / sum).toFixed(4)),
    reputation: Number((safe.reputation / sum).toFixed(4))
  };
}

function normalizeIdentityDNA(input: IdentityDNA): IdentityDNA {
  const clampDNA = (value: number): number => clamp(Math.round(value), 0, 100);
  const textList = (list: string[] | undefined, fallback: string[]): string[] =>
    (Array.isArray(list) ? list.filter((item) => typeof item === "string" && item.trim().length > 0) : fallback).slice(0, 8);

  return {
    archetype: (input.archetype || "Twin").slice(0, 40),
    core_values: textList(input.core_values, ["identity", "consistency"]).slice(0, 6),
    speech_style: (input.speech_style || "clear and human-like").slice(0, 80),
    risk_appetite: clampDNA(input.risk_appetite),
    aggression_bias: clampDNA(input.aggression_bias),
    diplomacy_bias: clampDNA(input.diplomacy_bias),
    creativity_bias: clampDNA(input.creativity_bias),
    signature_moves: textList(input.signature_moves, ["steady pressure"]).slice(0, 8),
    taboos: textList(input.taboos, []).slice(0, 5)
  };
}

function buildDefaultTwinDNA(index: number): IdentityDNA {
  const base = DEFAULT_TWIN_DNA_LIBRARY[index % DEFAULT_TWIN_DNA_LIBRARY.length];
  const drift = ((index * 7) % 7) - 3;
  const tilt = index % 2 === 0 ? 2 : -2;

  return normalizeIdentityDNA({
    ...base,
    risk_appetite: clamp(base.risk_appetite + drift, 0, 100),
    aggression_bias: clamp(base.aggression_bias + tilt, 0, 100),
    diplomacy_bias: clamp(base.diplomacy_bias - tilt, 0, 100),
    creativity_bias: clamp(base.creativity_bias + (index % 3) - 1, 0, 100),
    core_values: [...base.core_values],
    signature_moves: [...base.signature_moves],
    taboos: [...base.taboos]
  });
}

function loadTwinProfiles(profilePath?: string): DigitalTwinProfile[] {
  if (!profilePath) return [];

  const resolved = path.isAbsolute(profilePath) ? profilePath : path.resolve(process.cwd(), profilePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Profile file not found: ${resolved}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown;
  const profiles = Array.isArray(raw)
    ? raw
    : isObject(raw) && Array.isArray(raw.profiles)
      ? (raw.profiles as unknown[])
      : null;

  if (!profiles) {
    throw new Error("Profile file must be an array or an object with `profiles` array.");
  }

  const output: DigitalTwinProfile[] = [];
  for (const item of profiles) {
    if (!isObject(item)) continue;
    if (typeof item.name !== "string" || !isObject(item.identity_dna)) continue;
    output.push(item as unknown as DigitalTwinProfile);
  }
  return output;
}

export function createAgents({
  agentCount,
  profilePath,
  ctx,
  width,
  height,
  artDirection,
  board,
  validateAgent,
  mythColorForPoint
}: {
  agentCount: number;
  profilePath?: string;
  ctx?: EngineContext;
  width?: number;
  height?: number;
  artDirection?: ArtDirection;
  board?: BoardCell[][];
  validateAgent: ValidateFunction<AgentState>;
  mythColorForPoint?: (agent: AgentState, x: number, y: number, requestedColor?: string, round?: number) => string;
}): AgentState[] {
  const runtimeWidth = ctx?.width ?? width;
  const runtimeHeight = ctx?.height ?? height;
  const runtimeArtDirection = ctx?.artDirection ?? artDirection;
  const runtimeBoard = ctx?.board ?? board;
  const colorForPoint = ctx?.mythColorForPoint ?? mythColorForPoint;
  if (!runtimeWidth || !runtimeHeight || !runtimeArtDirection || !runtimeBoard || !colorForPoint) {
    throw new Error("createAgents requires board, dimensions, art direction, and mythColorForPoint");
  }
  const agents: AgentState[] = [];
  const profiles = loadTwinProfiles(profilePath);
  const totalAgents = profiles.length > 0 ? profiles.length : agentCount;

  for (let i = 0; i < totalAgents; i += 1) {
    const profile = profiles[i];
    if (profile) {
      const dna = normalizeIdentityDNA(profile.identity_dna);
      const persona = profile.persona && LEGACY_PERSONAS.includes(profile.persona) ? profile.persona : undefined;

      const idCandidate = typeof profile.id === "string" ? profile.id.trim() : `a${i + 1}`;
      const id = /^[a-zA-Z0-9_-]{1,24}$/.test(idCandidate) ? idCandidate : `a${i + 1}`;
      const paletteColor = runtimeArtDirection.palette[i % runtimeArtDirection.palette.length] ?? COLORS[i % COLORS.length];
      const colorCandidate = typeof profile.color === "string" ? profile.color.trim() : paletteColor;
      const color = /^#[0-9A-Fa-f]{6}$/.test(colorCandidate) ? colorCandidate : paletteColor;
      const name = (profile.name || `Twin-${i + 1}`).slice(0, 20);

      const agent: AgentState = {
        id,
        name,
        color,
        identity_dna: dna,
        goal_weights: normalizeGoalWeights(dna, profile.goal_weights),
        emotion: { anger: 20, fear: 20, confidence: 50, satisfaction: 50 },
        reputation: 70,
        energy: 3,
        cooldowns: { burst: 0 },
        relations: [],
        memory: []
      };
      if (persona) {
        agent.persona = persona;
      }
      agents.push(agent);
      continue;
    }

    const id = `a${i + 1}`;
    const dna = buildDefaultTwinDNA(i);
    const agent: AgentState = {
      id,
      name: `Twin-${i + 1}`,
      color: runtimeArtDirection.palette[i % runtimeArtDirection.palette.length] ?? COLORS[i % COLORS.length],
      identity_dna: dna,
      goal_weights: normalizeGoalWeights(dna),
      emotion: { anger: 20, fear: 20, confidence: 50, satisfaction: 50 },
      reputation: 70,
      energy: 3,
      cooldowns: { burst: 0 },
      relations: [],
      memory: []
    };
    agents.push(agent);
  }

  const usedIds = new Set<string>();
  for (let i = 0; i < agents.length; i += 1) {
    if (!usedIds.has(agents[i].id)) {
      usedIds.add(agents[i].id);
      continue;
    }
    const fallback = `a${i + 1}`;
    agents[i].id = usedIds.has(fallback) ? `a${i + 1}_${i}` : fallback;
    usedIds.add(agents[i].id);
  }

  for (const agent of agents) {
    agent.relations = agents
      .filter((target) => target.id !== agent.id)
      .map((target) => ({ target_id: target.id, trust: 0, affinity: 0, debt: 0 }));
  }

  const used = new Set<string>();
  for (const agent of agents) {
    let x = 0;
    let y = 0;
    let attempt = 0;
    do {
      x = stableInt(`${agent.id}:x:${runtimeWidth}:${runtimeHeight}:${attempt}`, runtimeWidth);
      y = stableInt(`${agent.id}:y:${runtimeWidth}:${runtimeHeight}:${attempt}`, runtimeHeight);
      attempt += 1;
    } while (used.has(`${x},${y}`));

    used.add(`${x},${y}`);
    runtimeBoard[y][x].owner = agent.id;
    runtimeBoard[y][x].color = colorForPoint(agent, x, y, agent.color, 1);

    const agentId = agent.id;
    if (!validateAgent(agent)) {
      throw new Error(`Invalid initial agent state for ${agentId}: ${JSON.stringify(validateAgent.errors)}`);
    }
  }

  return agents;
}
