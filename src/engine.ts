import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import { buildMockDecision } from "./mockAgent";
import {
  applyActionToCanvas,
  createBoard,
  resolveCanvasProgressively as resolveCanvasProgressivelyFromRuntime,
  seedCurrentRoundWithBoard,
  type CanvasCell
} from "./engine/canvasRuntime";
import type { EngineContext } from "./engine/engineContext";
import { DeepSeekProvider } from "./llm/deepseekProvider";
import type { LLMProvider } from "./llm/types";
import { buildArtDirection, buildArtTarget, buildRenderPalette } from "./engine/artDirector";
import { artPhaseForRound, mythColorForPoint, phaseGateAt, targetPriorityAt, zoneWeight } from "./engine/artRuntime";
import { DEFAULT_MYTH_PROMPT, SCHEMA_VERSION } from "./engine/constants";
import { buildOpponentSummary as buildOpponentSummaryFromService, requestAgentDecision as requestAgentDecisionFromService, type DecisionRequestStatus } from "./engine/decisionService";
import { buildScores } from "./engine/scoreboard";
import { buildSocialMetrics, buildSocialSnapshot, consumeMemory, updateTreaties } from "./engine/socialState";
import { applyIdentitySteering as applyIdentitySteeringFromStrategy, buildActionHints as buildActionHintsFromStrategy, mythAestheticScore, personalMythReading as personalMythReadingFromStrategy } from "./engine/strategyService";
import { createAgents } from "./engine/twinFactory";
import type {
  AgentState,
  ArtDirection,
  EngineConfig,
  MemoryEvent,
  ReplayActionStep,
  ReplayRound,
  SimulationResult,
  TurnAction,
  TurnDecision,
  Treaty
} from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return { r: 0, g: 0, b: 0 };
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function colorDistance(left: string, right: string): number {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function formatReplayActionLabel(agentId: string, action: TurnAction): string {
  if (action.action === "wait") return `${agentId} · wait`;
  if (action.action === "burst") return `${agentId} · burst @ ${action.center_x},${action.center_y}`;
  return `${agentId} · ${action.action} @ ${action.x},${action.y}`;
}

export class PixelWarEngine {
  private readonly width: number;
  private readonly height: number;
  private readonly rounds: number;
  private agentCount: number;
  private readonly maxConcurrentAgents: number;
  private readonly dryRun: boolean;
  private readonly profilePath?: string;
  private readonly mythPrompt: string;
  private readonly artDirection: ArtDirection;
  private readonly mythRenderPalette: string[];
  private readonly artTargetColors: string[][];
  private readonly ctx: EngineContext;
  private readonly provider: LLMProvider;
  private readonly validateAgent: ValidateFunction<AgentState>;
  private readonly validateDecision: ValidateFunction<TurnDecision>;

  private board: CanvasCell[][];
  private agents: AgentState[];
  private events: MemoryEvent[] = [];
  private activeTreaties: Treaty[] = [];
  private currentRoundUpdateMap = new Map<string, ReplayRound["canvas_updates"][number]>();

  constructor(config: Partial<EngineConfig> & { provider?: LLMProvider } = {}) {
    this.width = config.width ?? 64;
    this.height = config.height ?? 64;
    this.rounds = config.rounds ?? 30;
    this.agentCount = config.agentCount ?? 6;
    this.maxConcurrentAgents = Math.max(1, config.maxConcurrentAgents ?? 8);
    this.dryRun = config.dryRun ?? false;
    this.profilePath = config.profilePath;
    this.mythPrompt = (config.mythPrompt || DEFAULT_MYTH_PROMPT).trim();
    this.artDirection = buildArtDirection(this.mythPrompt);
    this.mythRenderPalette = buildRenderPalette(this.artDirection);
    this.artTargetColors = buildArtTarget({
      width: this.width,
      height: this.height,
      artDirection: this.artDirection,
      renderPalette: this.mythRenderPalette
    });
    this.provider = config.provider ?? new DeepSeekProvider({ model: config.model ?? "deepseek-chat" });

    const agentSchemaPath = path.join(__dirname, "..", "schemas", "agent-state.schema.json");
    const decisionSchemaPath = path.join(__dirname, "..", "schemas", "turn-decision.schema.json");

    const ajv = new Ajv2020({ allErrors: true });
    const agentSchema = JSON.parse(fs.readFileSync(agentSchemaPath, "utf8"));
    const decisionSchema = JSON.parse(fs.readFileSync(decisionSchemaPath, "utf8"));

    this.validateAgent = ajv.compile<AgentState>(agentSchema);
    this.validateDecision = ajv.compile<TurnDecision>(decisionSchema);

    this.board = createBoard(this.width, this.height);
    this.ctx = {
      board: this.board,
      width: this.width,
      height: this.height,
      artDirection: this.artDirection,
      artTargetColors: this.artTargetColors,
      renderPalette: this.mythRenderPalette,
      mythColorForPoint: (agent, x, y, requestedColor, round) =>
        mythColorForPoint({
          agent,
          x,
          y,
          requestedColor,
          round,
          artTargetColors: this.artTargetColors,
          artDirection: this.artDirection,
          renderPalette: this.mythRenderPalette
        }),
      zoneWeight: (zone, x, y) => zoneWeight(this.width, this.height, zone, x, y)
    };
    this.agents = createAgents({
      agentCount: this.agentCount,
      profilePath: this.profilePath,
      ctx: this.ctx,
      validateAgent: this.validateAgent,
      mythColorForPoint: this.ctx.mythColorForPoint
    });
    this.agentCount = this.agents.length;
  }

  private getAgentById(agentId: string): AgentState | undefined {
    return this.agents.find((agent) => agent.id === agentId);
  }

  private applyEmotionDelta(agent: AgentState, delta: TurnDecision["emotion_delta"]): void {
    agent.emotion.anger = clamp(agent.emotion.anger + delta.anger, 0, 100);
    agent.emotion.fear = clamp(agent.emotion.fear + delta.fear, 0, 100);
    agent.emotion.confidence = clamp(agent.emotion.confidence + delta.confidence, 0, 100);
    agent.emotion.satisfaction = clamp(agent.emotion.satisfaction + delta.satisfaction, 0, 100);
  }

  private buildFallbackDecision(
    agent: AgentState,
    round: number,
    validActionHints = buildActionHintsFromStrategy({
      agent,
      round,
      ctx: this.ctx,
      events: this.events,
      artDirection: this.artDirection
    })
  ): TurnDecision {
    return buildMockDecision({
      agent,
      round,
      width: this.width,
      height: this.height,
      opponents: buildOpponentSummaryFromService(this.agents, agent.id),
      validActionHints,
      artDirection: this.artDirection
    });
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
      const artPhase = artPhaseForRound(round, this.rounds);
      const actionSteps: ReplayActionStep[] = [];
      let stepIndex = 0;
      const pushActionStep = ({
        kind,
        actor_id,
        label,
        updates,
        action
      }: Omit<ReplayActionStep, "step_index">): void => {
        if (kind !== "action" && updates.length === 0) return;
        actionSteps.push({
          step_index: stepIndex,
          kind,
          actor_id,
          label,
          updates,
          ...(action ? { action } : {})
        });
        stepIndex += 1;
      };

      this.currentRoundUpdateMap = new Map();
      if (round === 1) {
        const seedUpdates: ReplayActionStep["updates"] = [];
        seedCurrentRoundWithBoard({
          board: this.board,
          width: this.width,
          height: this.height,
          currentRoundUpdateMap: this.currentRoundUpdateMap,
          stepUpdateLog: seedUpdates
        });
        pushActionStep({
          kind: "seed",
          actor_id: "system",
          label: "Initial Seed",
          updates: seedUpdates
        });
      }
      this.resetEnergy();

      const decisions: TurnDecision[] = [];
      const turnErrors: ReplayRound["errors"] = [];
      const personaNotes: ReplayRound["persona_notes"] = [];

      const resolvedBatch = await this.mapWithConcurrency(this.agents, this.maxConcurrentAgents, async (agent) => {
        try {
          const resolved = await requestAgentDecisionFromService({
            agent,
            round,
            agents: this.agents,
            dryRun: this.dryRun,
            ctx: this.ctx,
            activeTreaties: this.activeTreaties,
            events: this.events,
            provider: this.provider,
            validateDecision: this.validateDecision,
            buildActionHints: (inputAgent, inputRound) =>
              buildActionHintsFromStrategy({
                agent: inputAgent,
                round: inputRound,
                ctx: this.ctx,
                events: this.events,
                artDirection: this.artDirection
              }),
            buildFallbackDecision: (inputAgent, inputRound, validActionHints) =>
              this.buildFallbackDecision(inputAgent, inputRound, validActionHints),
            applyIdentitySteering: (inputAgent, decision, hints, inputRound) =>
              applyIdentitySteeringFromStrategy({
                agent: inputAgent,
                decision,
                hints,
                round: inputRound,
                ctx: this.ctx,
                agents: this.agents,
                mythColorForPoint: this.ctx.mythColorForPoint
              }),
            personalMythReading: (inputAgent) => personalMythReadingFromStrategy(inputAgent, this.artDirection)
          });
          return {
            agent_id: agent.id,
            resolved,
            generation_error: null as string | null
          };
        } catch (error) {
          const fallbackDecision = applyIdentitySteeringFromStrategy({
            agent,
            decision: this.buildFallbackDecision(agent, round),
            hints: buildActionHintsFromStrategy({
              agent,
              round,
              ctx: this.ctx,
              events: this.events,
              artDirection: this.artDirection
            }),
            round,
            ctx: this.ctx,
            agents: this.agents,
            mythColorForPoint: this.ctx.mythColorForPoint
          });

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

      this.activeTreaties = updateTreaties({
        activeTreaties: this.activeTreaties,
        round,
        decisions,
        events: this.events
      });

      for (const decision of decisions) {
        const owner = this.agents.find((agent) => agent.id === decision.agent_id);
        if (owner) {
          this.applyEmotionDelta(owner, decision.emotion_delta);
        }
      }

      const orderedDecisions = this.dryRun
        ? [...decisions].sort((left, right) => left.agent_id.localeCompare(right.agent_id))
        : shuffled(decisions);
      for (const decision of orderedDecisions) {
        const owner = this.agents.find((agent) => agent.id === decision.agent_id);
        if (!owner) continue;
        for (const action of decision.actions) {
          const stepUpdateLog: ReplayActionStep["updates"] = [];
          applyActionToCanvas({
            agent: owner,
            action,
            round,
            ctx: this.ctx,
            currentRoundUpdateMap: this.currentRoundUpdateMap,
            activeTreaties: this.activeTreaties,
            events: this.events,
            stepUpdateLog,
            mythColorForPoint: this.ctx.mythColorForPoint
          });
          pushActionStep({
            kind: "action",
            actor_id: owner.id,
            label: formatReplayActionLabel(owner.id, action),
            updates: stepUpdateLog,
            action
          });
        }
      }

      consumeMemory({
        agents: this.agents,
        events: this.events,
        round
      });
      this.decrementCooldowns();
      resolveCanvasProgressivelyFromRuntime({
        round,
        rounds: this.rounds,
        ctx: this.ctx,
        currentRoundUpdateMap: this.currentRoundUpdateMap,
        events: this.events,
        artTargetColors: this.artTargetColors,
        artPhaseForRound: (inputRound) => artPhaseForRound(inputRound, this.rounds),
        phaseGateAt: (x, y, phase) => phaseGateAt({ x, y, phase, artDirection: this.artDirection, width: this.width, height: this.height }),
        targetPriorityAt: (x, y, phase) =>
          targetPriorityAt({ x, y, phase, artDirection: this.artDirection, width: this.width, height: this.height }),
        targetMismatchAt: (x, y) => {
          const targetColor = this.artTargetColors[y]?.[x];
          if (!targetColor) return 0;
          const cell = this.board[y][x];
          const distance = colorDistance(cell.color, targetColor);
          if (!cell.owner) return distance + 110;
          return distance;
        },
        getAgentById: (agentId) => this.getAgentById(agentId),
        onStep: (step) => {
          pushActionStep({
            kind: step.kind,
            actor_id: "system",
            label: step.label,
            updates: step.updates
          });
        },
        mythColorForPoint: this.ctx.mythColorForPoint
      });

      const roundHighlights = this.events.filter((event) => event.round === round);
      const socialSnapshot = buildSocialSnapshot(this.agents);
      const socialMetrics = buildSocialMetrics(this.agents);
      replay.push({
        round,
        art_phase: artPhase,
        canvas_updates: [...this.currentRoundUpdateMap.values()],
        action_steps: actionSteps,
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
        social_metrics: socialMetrics,
        social_snapshot: socialSnapshot,
        highlights: roundHighlights,
        errors: turnErrors
      });
    }

    return {
      schema_version: SCHEMA_VERSION,
      config: {
        width: this.width,
        height: this.height,
        rounds: this.rounds,
        agent_count: this.agentCount,
        max_concurrent_agents: this.maxConcurrentAgents,
        dry_run: this.dryRun,
        model: this.provider.modelName,
        ...(this.profilePath ? { profile_path: this.profilePath } : {}),
        myth_prompt: this.mythPrompt
      },
      art_direction: this.artDirection,
      ranking: buildScores({
        agents: this.agents,
        board: this.board,
        width: this.width,
        height: this.height,
        mythAestheticScore: (agent) =>
          mythAestheticScore({
            agent,
            ctx: this.ctx
          })
      }),
      final_highlights: this.events.slice(-25),
      replay
    };
  }
}
