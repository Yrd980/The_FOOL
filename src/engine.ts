import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import { buildMockDecision } from "./mockAgent";
import { normalizeTurnDecision } from "./decisionNormalizer";
import { DeepSeekClient, buildAgentSystemPrompt, buildAgentUserPrompt } from "./deepseekClient";
import type {
  ActionHints,
  AgentState,
  DigitalTwinProfile,
  EngineConfig,
  IdentityDNA,
  MemoryEvent,
  Persona,
  Point,
  ReplayRound,
  SimulationResult,
  TurnAction,
  TurnDecision,
  Treaty
} from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PERSONALITIES: Persona[] = ["expansionist", "defender", "artist", "schemer"];
const COLORS = ["#E63946", "#2A9D8F", "#F4A261", "#457B9D", "#E9C46A", "#1D3557", "#FF6B6B", "#4CC9F0"];

const ACTION_COST: Record<TurnAction["action"], number> = {
  wait: 0,
  paint: 1,
  fortify: 1,
  invade: 2,
  burst: 3
};

interface Cell {
  owner: string | null;
  color: string;
  fortify: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function relationToMap(relations: AgentState["relations"]): Map<string, AgentState["relations"][number]> {
  const map = new Map<string, AgentState["relations"][number]>();
  for (const relation of relations) {
    map.set(relation.target_id, relation);
  }
  return map;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type DecisionRequestStatus = "ok" | "repaired" | "fallback";

interface DecisionRequestResult {
  decision: TurnDecision;
  status: DecisionRequestStatus;
  detail?: string;
  persona_note: string;
  proactive_score: number;
}

export class PixelWarEngine {
  private readonly width: number;
  private readonly height: number;
  private readonly rounds: number;
  private agentCount: number;
  private readonly maxConcurrentAgents: number;
  private readonly dryRun: boolean;
  private readonly profilePath?: string;
  private readonly deepSeek: DeepSeekClient;
  private readonly validateAgent: ValidateFunction<AgentState>;
  private readonly validateDecision: ValidateFunction<TurnDecision>;

  private board: Cell[][];
  private agents: AgentState[];
  private events: MemoryEvent[] = [];
  private activeTreaties: Treaty[] = [];

  constructor(config: Partial<EngineConfig> = {}) {
    this.width = config.width ?? 64;
    this.height = config.height ?? 64;
    this.rounds = config.rounds ?? 30;
    this.agentCount = config.agentCount ?? 6;
    this.maxConcurrentAgents = Math.max(1, config.maxConcurrentAgents ?? 8);
    this.dryRun = config.dryRun ?? false;
    this.profilePath = config.profilePath;
    this.deepSeek = new DeepSeekClient({ model: config.model ?? "deepseek-chat" });

    const agentSchemaPath = path.join(__dirname, "..", "schemas", "agent-state.schema.json");
    const decisionSchemaPath = path.join(__dirname, "..", "schemas", "turn-decision.schema.json");

    const ajv = new Ajv2020({ allErrors: true });
    const agentSchema = JSON.parse(fs.readFileSync(agentSchemaPath, "utf8"));
    const decisionSchema = JSON.parse(fs.readFileSync(decisionSchemaPath, "utf8"));

    this.validateAgent = ajv.compile<AgentState>(agentSchema);
    this.validateDecision = ajv.compile<TurnDecision>(decisionSchema);

    this.board = this.createBoard();
    this.agents = this.createAgents();
    this.agentCount = this.agents.length;
  }

  private createBoard(): Cell[][] {
    const board: Cell[][] = [];
    for (let y = 0; y < this.height; y += 1) {
      const row: Cell[] = [];
      for (let x = 0; x < this.width; x += 1) {
        row.push({ owner: null, color: "#111111", fortify: 0 });
      }
      board.push(row);
    }
    return board;
  }

  private goalWeightsForPersona(persona: Persona): AgentState["goal_weights"] {
    if (persona === "expansionist") {
      return { territory: 0.5, art: 0.2, revenge: 0.2, reputation: 0.1 };
    }
    if (persona === "defender") {
      return { territory: 0.35, art: 0.2, revenge: 0.1, reputation: 0.35 };
    }
    if (persona === "artist") {
      return { territory: 0.2, art: 0.55, revenge: 0.05, reputation: 0.2 };
    }
    return { territory: 0.3, art: 0.15, revenge: 0.35, reputation: 0.2 };
  }

  private personaFromDNA(dna: IdentityDNA): Persona {
    if (dna.creativity_bias >= 70) return "artist";
    if (dna.aggression_bias >= 70 && dna.risk_appetite >= 60) return "expansionist";
    if (dna.diplomacy_bias >= 70 && dna.aggression_bias < 60) return "defender";
    return "schemer";
  }

  private normalizeGoalWeights(
    persona: Persona,
    overrideWeights?: Partial<AgentState["goal_weights"]>
  ): AgentState["goal_weights"] {
    const base = this.goalWeightsForPersona(persona);
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

  private normalizeIdentityDNA(input: IdentityDNA): IdentityDNA {
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

  private loadTwinProfiles(): DigitalTwinProfile[] {
    if (!this.profilePath) return [];

    const resolved = path.isAbsolute(this.profilePath) ? this.profilePath : path.resolve(process.cwd(), this.profilePath);
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

  private identityDNAForPersona(persona: Persona, index: number): IdentityDNA {
    if (persona === "expansionist") {
      return {
        archetype: "Conqueror",
        core_values: ["growth", "pressure", "momentum"],
        speech_style: "short, assertive, territorial",
        risk_appetite: 78,
        aggression_bias: 80,
        diplomacy_bias: 35,
        creativity_bias: 40,
        signature_moves: ["border squeeze", "double invade", "center wedge"],
        taboos: ["idle turns", "retreat without trade"]
      };
    }

    if (persona === "defender") {
      return {
        archetype: "Warden",
        core_values: ["stability", "honor", "counterplay"],
        speech_style: "calm, direct, tactical",
        risk_appetite: 35,
        aggression_bias: 48,
        diplomacy_bias: 65,
        creativity_bias: 35,
        signature_moves: ["fortified ring", "counter invade", "line hold"],
        taboos: ["betraying active ally"]
      };
    }

    if (persona === "artist") {
      return {
        archetype: "Curator",
        core_values: ["beauty", "coherence", "legacy"],
        speech_style: "expressive, poetic, confident",
        risk_appetite: 52,
        aggression_bias: 34,
        diplomacy_bias: 58,
        creativity_bias: 88,
        signature_moves: ["palette wave", "shape lock", "motif repeat"],
        taboos: ["chaotic spam", "color inconsistency"]
      };
    }

    return {
      archetype: "Operator",
      core_values: ["advantage", "deception", "timing"],
      speech_style: "sharp, ironic, manipulative",
      risk_appetite: 70,
      aggression_bias: 62,
      diplomacy_bias: 72,
      creativity_bias: 55,
      signature_moves: ["bait treaty", "silent flank", "late betrayal"],
      taboos: ["predictable repetition", "public overcommitment"]
    };
  }

  private createAgents(): AgentState[] {
    const agents: AgentState[] = [];
    const profiles = this.loadTwinProfiles();
    const totalAgents = profiles.length > 0 ? profiles.length : this.agentCount;

    for (let i = 0; i < totalAgents; i += 1) {
      const profile = profiles[i];
      if (profile) {
        const dna = this.normalizeIdentityDNA(profile.identity_dna);
        const persona =
          profile.persona && PERSONALITIES.includes(profile.persona) ? profile.persona : this.personaFromDNA(dna);

        const idCandidate = typeof profile.id === "string" ? profile.id.trim() : `a${i + 1}`;
        const id = /^[a-zA-Z0-9_-]{1,24}$/.test(idCandidate) ? idCandidate : `a${i + 1}`;
        const colorCandidate = typeof profile.color === "string" ? profile.color.trim() : COLORS[i % COLORS.length];
        const color = /^#[0-9A-Fa-f]{6}$/.test(colorCandidate) ? colorCandidate : COLORS[i % COLORS.length];
        const name = (profile.name || `Twin-${i + 1}`).slice(0, 20);

        const agent: AgentState = {
          id,
          name,
          persona,
          color,
          identity_dna: dna,
          goal_weights: this.normalizeGoalWeights(persona, profile.goal_weights),
          emotion: { anger: 20, fear: 20, confidence: 50, satisfaction: 50 },
          reputation: 70,
          energy: 3,
          cooldowns: { burst: 0 },
          relations: [],
          memory: []
        };
        agents.push(agent);
        continue;
      }

      const id = `a${i + 1}`;
      const persona = PERSONALITIES[i % PERSONALITIES.length];
      const agent: AgentState = {
        id,
        name: `Agent-${i + 1}`,
        persona,
        color: COLORS[i % COLORS.length],
        identity_dna: this.identityDNAForPersona(persona, i),
        goal_weights: this.goalWeightsForPersona(persona),
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
      do {
        x = randomInt(this.width);
        y = randomInt(this.height);
      } while (used.has(`${x},${y}`));

      used.add(`${x},${y}`);
      this.board[y][x].owner = agent.id;
      this.board[y][x].color = agent.color;

      const agentId = agent.id;
      if (!this.validateAgent(agent)) {
        throw new Error(`Invalid initial agent state for ${agentId}: ${JSON.stringify(this.validateAgent.errors)}`);
      }
    }

    return agents;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  private countOwnedNeighbors(agentId: string, x: number, y: number): number {
    const deltas: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    let count = 0;
    for (const [dx, dy] of deltas) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.inBounds(nx, ny) && this.board[ny][nx].owner === agentId) {
        count += 1;
      }
    }
    return count;
  }

  private neighbors4(x: number, y: number): Point[] {
    const deltas: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    const output: Point[] = [];
    for (const [dx, dy] of deltas) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.inBounds(nx, ny)) {
        output.push({ x: nx, y: ny });
      }
    }
    return output;
  }

  private selectUniquePoints(points: Point[], limit: number): Point[] {
    const selected: Point[] = [];
    const seen = new Set<string>();
    for (const point of shuffled(points)) {
      const key = `${point.x},${point.y}`;
      if (seen.has(key)) continue;
      selected.push(point);
      seen.add(key);
      if (selected.length >= limit) break;
    }
    return selected;
  }

  private collectOwnedCells(agentId: string): Point[] {
    const owned: Point[] = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.board[y][x].owner === agentId) {
          owned.push({ x, y });
        }
      }
    }
    return owned;
  }

  private parseCoordTarget(target: string | undefined): Point | null {
    if (!target) return null;
    const match = target.match(/^(-?\d+),(-?\d+)$/);
    if (!match) return null;
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (!this.inBounds(x, y)) return null;
    return { x, y };
  }

  private collectContestedHotspots(round: number): Point[] {
    const counts = new Map<string, number>();
    for (const event of this.events) {
      if (event.round !== round - 1) continue;
      const coord = this.parseCoordTarget(event.target);
      if (!coord) continue;
      const key = `${coord.x},${coord.y}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const hotspots: Point[] = [];
    for (const [key, count] of counts.entries()) {
      if (count < 2) continue;
      const [xText, yText] = key.split(",");
      hotspots.push({ x: Number(xText), y: Number(yText) });
    }
    return hotspots;
  }

  private randomPoints(limit: number): Point[] {
    const points: Point[] = [];
    for (let i = 0; i < limit * 3; i += 1) {
      points.push({ x: randomInt(this.width), y: randomInt(this.height) });
    }
    return this.selectUniquePoints(points, limit);
  }

  private buildActionHints(agent: AgentState, round: number): ActionHints {
    const ownedCells = this.collectOwnedCells(agent.id);
    const paintRaw: Point[] = [];
    const fortifyRaw: Point[] = [];
    const invadeRaw: Point[] = [];
    const burstRaw: Point[] = [];

    for (const own of ownedCells) {
      let hasEnemyNeighbor = false;
      for (const neighbor of this.neighbors4(own.x, own.y)) {
        const owner = this.board[neighbor.y][neighbor.x].owner;
        if (owner === agent.id) continue;
        if (owner === null) {
          paintRaw.push(neighbor);
          continue;
        }
        invadeRaw.push(neighbor);
        burstRaw.push(neighbor);
        hasEnemyNeighbor = true;
      }

      if (hasEnemyNeighbor || this.board[own.y][own.x].fortify < 2) {
        fortifyRaw.push(own);
      }
      if (hasEnemyNeighbor) {
        burstRaw.push(own);
      }
    }

    const hotspots = this.collectContestedHotspots(round);
    for (const point of hotspots) {
      const owner = this.board[point.y][point.x].owner;
      if (owner !== agent.id) {
        invadeRaw.push(point);
        burstRaw.push(point);
      }
      if (owner === null) {
        paintRaw.push(point);
      }
    }

    if (paintRaw.length === 0) {
      const fallback = ownedCells.length > 0 ? ownedCells : this.randomPoints(8);
      for (const origin of fallback) {
        for (const neighbor of this.neighbors4(origin.x, origin.y)) {
          if (this.board[neighbor.y][neighbor.x].owner !== agent.id) {
            paintRaw.push(neighbor);
          }
        }
      }
    }

    if (fortifyRaw.length === 0 && ownedCells.length > 0) {
      fortifyRaw.push(...ownedCells);
    }

    if (invadeRaw.length === 0 && hotspots.length > 0) {
      invadeRaw.push(...hotspots);
    }

    if (burstRaw.length === 0) {
      burstRaw.push(...invadeRaw, ...paintRaw);
    }

    return {
      paint_candidates: this.selectUniquePoints(paintRaw.length > 0 ? paintRaw : this.randomPoints(10), 10),
      fortify_candidates: this.selectUniquePoints(fortifyRaw.length > 0 ? fortifyRaw : this.randomPoints(8), 8),
      invade_candidates: this.selectUniquePoints(invadeRaw.length > 0 ? invadeRaw : this.randomPoints(10), 10),
      burst_centers: this.selectUniquePoints(burstRaw.length > 0 ? burstRaw : this.randomPoints(8), 8),
      contested_hotspots: this.selectUniquePoints(hotspots, 6)
    };
  }

  private actionEnergyCost(action: TurnAction): number {
    return ACTION_COST[action.action];
  }

  private actionKey(action: TurnAction): string {
    if (action.action === "wait") return "wait";
    if (action.action === "burst") return `${action.action}:${action.center_x},${action.center_y}`;
    return `${action.action}:${action.x},${action.y}`;
  }

  private stylePublicMessage(agent: AgentState, message: string): string {
    const trimmed = message.trim();
    if (trimmed.length > 10) {
      return trimmed.slice(0, 60);
    }

    const style = agent.identity_dna.speech_style.toLowerCase();
    if (style.includes("poetic") || style.includes("expressive")) {
      return "Let this move leave a signature.".slice(0, 60);
    }
    if (style.includes("calm") || style.includes("tactical")) {
      return "Steady hands, measured pressure.".slice(0, 60);
    }
    if (style.includes("ironic") || style.includes("manipulative")) {
      return "One move now, two outcomes later.".slice(0, 60);
    }
    if (style.includes("assertive") || style.includes("territorial")) {
      return "Forward line first. Claim and hold.".slice(0, 60);
    }
    return `${agent.identity_dna.archetype}: staying in character.`.slice(0, 60);
  }

  private applyIdentitySteering(
    agent: AgentState,
    decision: TurnDecision,
    hints: ActionHints,
    round: number
  ): { decision: TurnDecision; note: string; proactive_score: number } {
    const next: TurnDecision = {
      ...decision,
      public_message: this.stylePublicMessage(agent, decision.public_message),
      private_messages: [...decision.private_messages],
      treaty_proposals: [...decision.treaty_proposals],
      actions: [...decision.actions],
      emotion_delta: { ...decision.emotion_delta }
    };

    if (next.actions.length === 0) {
      next.actions = [{ action: "wait" }];
    }

    if (next.actions.some((action) => action.action !== "wait")) {
      next.actions = next.actions.filter((action) => action.action !== "wait");
    }

    const notes: string[] = [];
    const used = new Set(next.actions.map((action) => this.actionKey(action)));

    const remainingEnergy = (): number =>
      Math.max(0, 3 - next.actions.reduce((sum, action) => sum + this.actionEnergyCost(action), 0));

    const addAction = (action: TurnAction): boolean => {
      if (next.actions.length >= 3) return false;
      if (this.actionEnergyCost(action) > remainingEnergy()) return false;
      const key = this.actionKey(action);
      if (used.has(key)) return false;
      next.actions.push(action);
      used.add(key);
      return true;
    };

    const replaceAction = (predicate: (action: TurnAction) => boolean, action: TurnAction): boolean => {
      const index = next.actions.findIndex(predicate);
      if (index < 0) return false;
      const withoutCost = next.actions.reduce((sum, item, i) => (i === index ? sum : sum + this.actionEnergyCost(item)), 0);
      if (withoutCost + this.actionEnergyCost(action) > 3) return false;
      next.actions[index] = action;
      used.clear();
      for (const item of next.actions) {
        used.add(this.actionKey(item));
      }
      return true;
    };

    const pickPaint = (): TurnAction | null => {
      const point = hints.paint_candidates[0];
      if (!point) return null;
      return { action: "paint", x: point.x, y: point.y, color: agent.color };
    };

    const pickFortify = (): TurnAction | null => {
      const point = hints.fortify_candidates[0];
      if (!point) return null;
      return { action: "fortify", x: point.x, y: point.y };
    };

    const pickInvade = (): TurnAction | null => {
      const point = hints.invade_candidates[0];
      if (!point) return null;
      return { action: "invade", x: point.x, y: point.y };
    };

    const hasAction = (kind: TurnAction["action"]): boolean => next.actions.some((action) => action.action === kind);

    const dna = agent.identity_dna;
    const values = dna.core_values.map((value) => value.toLowerCase());
    const wantsPaint =
      dna.creativity_bias >= 65 || values.some((value) => value.includes("beauty") || value.includes("legacy"));
    const wantsFortify =
      dna.risk_appetite <= 45 || values.some((value) => value.includes("stability") || value.includes("honor"));
    const wantsInvade =
      dna.aggression_bias >= 65 || values.some((value) => value.includes("pressure") || value.includes("advantage"));
    const wantsDiplomacy =
      dna.diplomacy_bias >= 65 || values.some((value) => value.includes("honor") || value.includes("alliance"));

    if (wantsPaint && !hasAction("paint")) {
      const action = pickPaint();
      if (action && (addAction(action) || replaceAction((item) => item.action === "invade", action))) {
        notes.push("按创作倾向补充绘制动作");
        next.intent = "art_focus";
      }
    }

    if (wantsFortify && !hasAction("fortify")) {
      const action = pickFortify();
      if (action && (addAction(action) || replaceAction((item) => item.action === "invade", action))) {
        notes.push("按稳健倾向加强边界防御");
        if (!hasAction("invade")) {
          next.intent = "defend";
        }
      }
    }

    if (wantsInvade && !hasAction("invade")) {
      const action = pickInvade();
      if (action && addAction(action)) {
        notes.push("按进攻倾向维持威慑压力");
        if (!hasAction("fortify")) {
          next.intent = "revenge";
        }
      }
    }

    if (wantsDiplomacy && next.treaty_proposals.length === 0) {
      const target = [...agent.relations]
        .sort((a, b) => b.trust + b.affinity - (a.trust + a.affinity))
        .map((item) => item.target_id)[0];
      if (target) {
        next.treaty_proposals.push({
          proposal_id: `${agent.id}_r${round}_dna`,
          target_id: target,
          type: "no_attack",
          duration_rounds: 2
        });
        if (next.private_messages.length < 2) {
          next.private_messages.push({ target_id: target, content: "保持边界稳定，两回合互不攻击。" });
        }
        notes.push("按关系倾向补充外交动作");
      }
    }

    if (!hasAction("invade") && !hasAction("paint") && !hasAction("fortify")) {
      const action = pickPaint() ?? pickFortify() ?? pickInvade();
      if (action && addAction(action)) {
        notes.push("避免空转，执行最符合当前身份的动作");
        next.intent = "expand";
      }
    }

    if (next.actions.length === 0) {
      next.actions = [{ action: "wait" }];
    }

    next.actions = next.actions.slice(0, 3);

    const activityWeight = next.actions.reduce((sum, action) => {
      if (action.action === "wait") return sum;
      if (action.action === "invade" || action.action === "burst") return sum + 2;
      return sum + 1;
    }, 0);
    const proactiveScore = clamp(Math.round((activityWeight / 6) * 100), 0, 100);

    const notePrefix = `${agent.identity_dna.archetype}(${agent.identity_dna.core_values.slice(0, 2).join("/")})`;
    const note = notes.length > 0 ? `${notePrefix}: ${notes.join("；")}` : `${notePrefix}: 行为保持人格一致`;

    return {
      decision: this.boundDecision(next),
      note,
      proactive_score: proactiveScore
    };
  }

  private hasNoAttackTreaty(attackerId: string, defenderId: string, round: number): boolean {
    return this.activeTreaties.some(
      (treaty) =>
        treaty.type === "no_attack" &&
        treaty.expires_round >= round &&
        ((treaty.a === attackerId && treaty.b === defenderId) || (treaty.a === defenderId && treaty.b === attackerId))
    );
  }

  private updateTreaties(round: number, decisions: TurnDecision[]): void {
    const signed = new Set<string>();
    const noAttackProposals: Array<{ from: string; to: string; duration: number }> = [];

    for (const decision of decisions) {
      for (const proposal of decision.treaty_proposals) {
        if (proposal.type === "no_attack") {
          noAttackProposals.push({ from: decision.agent_id, to: proposal.target_id, duration: proposal.duration_rounds });
        }
      }
    }

    for (const proposal of noAttackProposals) {
      const reciprocal = noAttackProposals.find((candidate) => candidate.from === proposal.to && candidate.to === proposal.from);
      if (!reciprocal) continue;
      const key = [proposal.from, proposal.to].sort().join("::");
      if (signed.has(key)) continue;

      signed.add(key);
      const expiresRound = round + Math.min(proposal.duration, reciprocal.duration) - 1;
      this.activeTreaties.push({ a: proposal.from, b: proposal.to, type: "no_attack", expires_round: expiresRound });

      this.events.push({ round, type: "signed_treaty", by: proposal.from, target: proposal.to, note: "no_attack" });
      this.events.push({ round, type: "signed_treaty", by: proposal.to, target: proposal.from, note: "no_attack" });
    }

    this.activeTreaties = this.activeTreaties.filter((treaty) => treaty.expires_round >= round);
  }

  private applyEmotionDelta(agent: AgentState, delta: TurnDecision["emotion_delta"]): void {
    agent.emotion.anger = clamp(agent.emotion.anger + delta.anger, 0, 100);
    agent.emotion.fear = clamp(agent.emotion.fear + delta.fear, 0, 100);
    agent.emotion.confidence = clamp(agent.emotion.confidence + delta.confidence, 0, 100);
    agent.emotion.satisfaction = clamp(agent.emotion.satisfaction + delta.satisfaction, 0, 100);
  }

  private applyAction(agent: AgentState, action: TurnAction, round: number): void {
    const cost = ACTION_COST[action.action];
    if (cost > agent.energy) return;

    if (action.action === "wait") {
      agent.energy -= cost;
      return;
    }

    if (action.action === "paint") {
      if (!this.inBounds(action.x, action.y)) return;
      agent.energy -= cost;
      this.board[action.y][action.x].owner = agent.id;
      this.board[action.y][action.x].color = agent.color;
      this.board[action.y][action.x].fortify = 0;
      this.events.push({ round, type: "expanded", by: agent.id, target: `${action.x},${action.y}` });
      return;
    }

    if (action.action === "fortify") {
      if (!this.inBounds(action.x, action.y)) return;
      if (this.board[action.y][action.x].owner !== agent.id) return;
      agent.energy -= cost;
      this.board[action.y][action.x].fortify = clamp(this.board[action.y][action.x].fortify + 1, 0, 3);
      return;
    }

    if (action.action === "invade") {
      if (!this.inBounds(action.x, action.y)) return;
      const targetCell = this.board[action.y][action.x];
      const defenderId = targetCell.owner;
      if (!defenderId || defenderId === agent.id) return;

      const neighbors = this.countOwnedNeighbors(agent.id, action.x, action.y);
      if (neighbors === 0) return;

      if (this.hasNoAttackTreaty(agent.id, defenderId, round)) {
        agent.reputation = clamp(agent.reputation - 20, 0, 100);
        const relation = relationToMap(agent.relations).get(defenderId);
        if (relation) {
          relation.trust = clamp(relation.trust - 25, -100, 100);
        }
        this.events.push({ round, type: "broke_treaty", by: agent.id, target: defenderId });
      }

      agent.energy -= cost;
      const attackPower =
        1 + neighbors * 0.4 + agent.emotion.anger * 0.01 + agent.emotion.confidence * 0.008 + Math.random() * 0.25;
      const defendPower = 1 + targetCell.fortify * 0.6 + Math.random() * 0.25;

      if (attackPower >= defendPower) {
        targetCell.owner = agent.id;
        targetCell.color = agent.color;
        targetCell.fortify = 0;
        this.events.push({ round, type: "attacked", by: agent.id, target: defenderId });
      }
      return;
    }

    if (action.action === "burst") {
      if (!this.inBounds(action.center_x, action.center_y)) return;
      if (agent.cooldowns.burst > 0) return;

      agent.energy -= cost;
      agent.cooldowns.burst = 3;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = action.center_x + dx;
          const y = action.center_y + dy;
          if (!this.inBounds(x, y)) continue;

          const targetCell = this.board[y][x];
          const enemy = targetCell.owner && targetCell.owner !== agent.id;
          if (!enemy) continue;

          const nearby = this.countOwnedNeighbors(agent.id, x, y);
          const chance = 0.15 + nearby * 0.2;
          if (Math.random() < chance) {
            targetCell.owner = agent.id;
            targetCell.color = agent.color;
            targetCell.fortify = 0;
          }
        }
      }
    }
  }

  private buildOpponentSummary(agentId: string): Array<{ id: string; persona: Persona; reputation: number; emotion: AgentState["emotion"] }> {
    return this.agents
      .filter((agent) => agent.id !== agentId)
      .map((agent) => ({
        id: agent.id,
        persona: agent.persona,
        reputation: agent.reputation,
        emotion: agent.emotion
      }));
  }

  private async generateDecision(agent: AgentState, round: number, validActionHints: ActionHints): Promise<unknown> {
    const opponents = this.buildOpponentSummary(agent.id);
    if (this.dryRun) {
      return buildMockDecision({ agent, round, width: this.width, height: this.height, opponents });
    }

    const systemPrompt = buildAgentSystemPrompt(agent);
    const userPrompt = buildAgentUserPrompt({
      round,
      width: this.width,
      height: this.height,
      selfState: {
        id: agent.id,
        persona: agent.persona,
        identity_dna: agent.identity_dna,
        energy: agent.energy,
        cooldowns: agent.cooldowns,
        emotion: agent.emotion,
        reputation: agent.reputation,
        relations: agent.relations.slice(0, 5)
      },
      opponents,
      treaties: this.activeTreaties,
      lastEvents: this.events.filter((event) => event.round === round - 1).slice(-8),
      validActionHints
    });

    return this.deepSeek.generateDecision({ systemPrompt, userPrompt });
  }

  private buildRepairPrompt({
    agent,
    round,
    firstError,
    rawDecision,
    validActionHints
  }: {
    agent: AgentState;
    round: number;
    firstError: string;
    rawDecision: unknown;
    validActionHints: ActionHints;
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
      `坐标必须在 x=0..${this.width - 1}, y=0..${this.height - 1}`,
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

  private validationErrorsToString(): string {
    return JSON.stringify(this.validateDecision.errors ?? []);
  }

  private async requestAgentDecision(
    agent: AgentState,
    round: number
  ): Promise<DecisionRequestResult> {
    const validActionHints = this.buildActionHints(agent, round);

    const finalize = (payload: {
      decision: TurnDecision;
      status: DecisionRequestStatus;
      detail?: string;
    }): DecisionRequestResult => {
      const steered = this.applyIdentitySteering(agent, payload.decision, validActionHints, round);
      return {
        decision: steered.decision,
        status: payload.status,
        detail: payload.detail,
        persona_note: steered.note,
        proactive_score: steered.proactive_score
      };
    };

    if (this.dryRun) {
      return finalize({
        decision: buildMockDecision({
          agent,
          round,
          width: this.width,
          height: this.height,
          opponents: this.buildOpponentSummary(agent.id)
        }),
        status: "ok"
      });
    }

    const firstRaw = await this.generateDecision(agent, round, validActionHints);
    const firstPass = this.sanitizeDecision(agent, firstRaw, round);
    if (!firstPass.error) {
      return finalize({ decision: firstPass.decision, status: "ok" });
    }

    try {
      const repairRaw = await this.deepSeek.generateDecision({
        systemPrompt: buildAgentSystemPrompt(agent),
        userPrompt: this.buildRepairPrompt({
          agent,
          round,
          firstError: firstPass.error,
          rawDecision: firstRaw,
          validActionHints
        }),
        temperature: 0.2
      });

      const repairedPass = this.sanitizeDecision(agent, repairRaw, round);
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
        decision: buildMockDecision({
          agent,
          round,
          width: this.width,
          height: this.height,
          opponents: this.buildOpponentSummary(agent.id)
        }),
        status: "fallback",
        detail: `first=${firstPass.error}; repair_request=${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private sanitizeDecision(agent: AgentState, rawDecision: unknown, round: number): { decision: TurnDecision; error: string | null } {
    const fallback = buildMockDecision({
      agent,
      round,
      width: this.width,
      height: this.height,
      opponents: this.buildOpponentSummary(agent.id)
    });

    if (isObject(rawDecision) && this.validateDecision(rawDecision)) {
      const decision = rawDecision as TurnDecision;
      if (decision.agent_id !== agent.id) {
        decision.agent_id = agent.id;
      }
      if (decision.round !== round) {
        decision.round = round;
      }
      return { decision: this.boundDecision(decision), error: null };
    }

    const rawErrors = this.validationErrorsToString();
    const normalized = normalizeTurnDecision({
      raw: rawDecision,
      agentId: agent.id,
      round,
      color: agent.color
    });

    if (this.validateDecision(normalized)) {
      return { decision: this.boundDecision(normalized), error: null };
    }

    const normalizedErrors = this.validationErrorsToString();
    return {
      decision: fallback,
      error: JSON.stringify({
        raw_errors: rawErrors,
        normalized_errors: normalizedErrors
      })
    };
  }

  private boundDecision(decision: TurnDecision): TurnDecision {
    const boundedActions: TurnDecision["actions"] = decision.actions.map((action) => {
      if (action.action === "paint" || action.action === "fortify" || action.action === "invade") {
        return {
          ...action,
          x: clamp(action.x, 0, this.width - 1),
          y: clamp(action.y, 0, this.height - 1)
        };
      }
      if (action.action === "burst") {
        return {
          ...action,
          center_x: clamp(action.center_x, 0, this.width - 1),
          center_y: clamp(action.center_y, 0, this.height - 1),
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

  private consumeMemory(round: number): void {
    const eventsByRound = this.events.filter((event) => event.round === round);
    for (const event of eventsByRound) {
      const agent = this.agents.find((item) => item.id === event.by);
      if (!agent) continue;
      agent.memory.push(event);
      if (agent.memory.length > 30) {
        agent.memory.shift();
      }
    }
  }

  private decrementCooldowns(): void {
    for (const agent of this.agents) {
      agent.cooldowns.burst = Math.max(0, agent.cooldowns.burst - 1);
    }
  }

  private resetEnergy(): void {
    for (const agent of this.agents) {
      agent.energy = 3;
    }
  }

  private territoryMap(): Map<string, number> {
    const map = new Map<string, number>(this.agents.map((agent) => [agent.id, 0]));
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const owner = this.board[y][x].owner;
        if (!owner) continue;
        map.set(owner, (map.get(owner) ?? 0) + 1);
      }
    }
    return map;
  }

  private buildScores(): SimulationResult["ranking"] {
    const total = this.width * this.height;
    const territory = this.territoryMap();

    const scores = this.agents.map((agent) => {
      const territoryCells = territory.get(agent.id) ?? 0;
      const territoryScore = (territoryCells / total) * 100;

      const artScore =
        50 +
        agent.emotion.confidence * 0.2 +
        agent.emotion.satisfaction * 0.2 +
        agent.reputation * 0.15 -
        agent.emotion.anger * 0.1;

      const finalScore = 0.55 * territoryScore + 0.45 * clamp(artScore, 0, 100);
      return {
        agent_id: agent.id,
        name: agent.name,
        territory_cells: territoryCells,
        territory_score: Number(territoryScore.toFixed(2)),
        art_score: Number(clamp(artScore, 0, 100).toFixed(2)),
        reputation: agent.reputation,
        final_score: Number(finalScore.toFixed(2))
      };
    });

    return scores.sort((a, b) => b.final_score - a.final_score);
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    if (items.length === 0) return [];

    const limit = Math.max(1, Math.min(concurrency, items.length));
    const results = new Array<R>(items.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const current = cursor;
        cursor += 1;
        if (current >= items.length) return;
        results[current] = await mapper(items[current], current);
      }
    };

    const workers = Array.from({ length: limit }, () => worker());
    await Promise.all(workers);
    return results;
  }

  async run(): Promise<SimulationResult> {
    const replay: ReplayRound[] = [];

    for (let round = 1; round <= this.rounds; round += 1) {
      this.resetEnergy();

      const decisions: TurnDecision[] = [];
      const turnErrors: ReplayRound["errors"] = [];
      const personaNotes: ReplayRound["persona_notes"] = [];

      const resolvedBatch = await this.mapWithConcurrency(this.agents, this.maxConcurrentAgents, async (agent) => {
        try {
          const resolved = await this.requestAgentDecision(agent, round);
          return {
            agent_id: agent.id,
            resolved,
            generation_error: null as string | null
          };
        } catch (error) {
          const fallbackDecision = this.applyIdentitySteering(
            agent,
            buildMockDecision({
              agent,
              round,
              width: this.width,
              height: this.height,
              opponents: this.buildOpponentSummary(agent.id)
            }),
            this.buildActionHints(agent, round),
            round
          );

          return {
            agent_id: agent.id,
            resolved: {
              decision: fallbackDecision.decision,
              status: "fallback" as DecisionRequestStatus,
              detail: "unhandled request error",
              persona_note: `fallback: ${fallbackDecision.note}`,
              proactive_score: fallbackDecision.proactive_score
            },
            generation_error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      for (const entry of resolvedBatch) {
        const resolved = entry.resolved;
        decisions.push(resolved.decision);
        personaNotes.push({
          agent_id: entry.agent_id,
          note: resolved.persona_note,
          proactive_score: resolved.proactive_score
        });

        if (entry.generation_error) {
          turnErrors.push({
            round,
            agent_id: entry.agent_id,
            type: "decision_generation",
            detail: entry.generation_error
          });
          continue;
        }

        if (resolved.status === "repaired" && resolved.detail) {
          turnErrors.push({ round, agent_id: entry.agent_id, type: "schema_repaired", detail: resolved.detail });
        }
        if (resolved.status === "fallback" && resolved.detail) {
          turnErrors.push({ round, agent_id: entry.agent_id, type: "schema_validation", detail: resolved.detail });
        }
      }

      this.updateTreaties(round, decisions);

      for (const decision of decisions) {
        const owner = this.agents.find((agent) => agent.id === decision.agent_id);
        if (owner) {
          this.applyEmotionDelta(owner, decision.emotion_delta);
        }
      }

      for (const decision of shuffled(decisions)) {
        const owner = this.agents.find((agent) => agent.id === decision.agent_id);
        if (!owner) continue;
        for (const action of decision.actions) {
          this.applyAction(owner, action, round);
        }
      }

      this.consumeMemory(round);
      this.decrementCooldowns();

      const roundHighlights = this.events.filter((event) => event.round === round);
      replay.push({
        round,
        public_messages: decisions.map((decision) => ({ agent_id: decision.agent_id, message: decision.public_message })),
        private_messages: decisions.flatMap((decision) =>
          decision.private_messages.map((message) => ({ from: decision.agent_id, to: message.target_id, content: message.content }))
        ),
        persona_notes: personaNotes,
        round_metrics: {
          expanded: roundHighlights.filter((event) => event.type === "expanded").length,
          attacked: roundHighlights.filter((event) => event.type === "attacked").length,
          treaties_signed: roundHighlights.filter((event) => event.type === "signed_treaty").length,
          public_messages: decisions.length,
          private_messages: decisions.reduce((count, decision) => count + decision.private_messages.length, 0)
        },
        highlights: roundHighlights,
        errors: turnErrors
      });
    }

    return {
      config: {
        width: this.width,
        height: this.height,
        rounds: this.rounds,
        agent_count: this.agentCount,
        max_concurrent_agents: this.maxConcurrentAgents,
        dry_run: this.dryRun,
        model: this.deepSeek.modelName,
        ...(this.profilePath ? { profile_path: this.profilePath } : {})
      },
      ranking: this.buildScores(),
      final_highlights: this.events.slice(-25),
      replay
    };
  }
}
