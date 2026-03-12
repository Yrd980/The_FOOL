import { describe, expect, test } from "bun:test";
import { buildMockDecision } from "../mockAgent";
import type { ActionHints, AgentState, OpponentSnapshot } from "../types";

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: "a1",
    name: "Oracle",
    color: "#FF0000",
    identity_dna: {
      archetype: "Oracle",
      core_values: ["honor", "memory"],
      speech_style: "calm and measured",
      risk_appetite: 40,
      aggression_bias: 35,
      diplomacy_bias: 80,
      creativity_bias: 65,
      signature_moves: ["hold"],
      taboos: []
    },
    goal_weights: { territory: 0.25, art: 0.25, revenge: 0.25, reputation: 0.25 },
    emotion: { anger: 20, fear: 20, confidence: 55, satisfaction: 55 },
    reputation: 70,
    energy: 3,
    cooldowns: { burst: 0 },
    relations: [],
    memory: [],
    ...overrides
  };
}

function makeOpponent(): OpponentSnapshot {
  return {
    id: "a2",
    archetype: "Sentinel",
    core_values: ["stability"],
    speech_style: "calm",
    signature_moves: ["hold"],
    reputation: 68,
    emotion: { anger: 10, fear: 15, confidence: 40, satisfaction: 45 },
    relationship: {
      trust: 20,
      affinity: 15,
      debt: 0,
      tension: 15,
      recent_shared_events: ["r2 signed a pact"]
    }
  };
}

const hints: ActionHints = {
  paint_candidates: [{ x: 1, y: 1 }],
  fortify_candidates: [{ x: 0, y: 0 }],
  invade_candidates: [{ x: 2, y: 2 }],
  burst_centers: [{ x: 2, y: 2 }],
  contested_hotspots: [{ x: 2, y: 2 }],
  palette_candidates: ["#FF0000"],
  motif_focus: ["center: halo"]
};

describe("buildMockDecision", () => {
  test("returns the same decision for identical inputs", () => {
    const agent = makeAgent();
    const opponents = [makeOpponent()];

    const first = buildMockDecision({
      agent,
      round: 3,
      width: 8,
      height: 8,
      opponents,
      validActionHints: hints,
      artDirection: {
        mode: "myth",
        theme_prompt: "test",
        title: "Test",
        mood_words: ["steady"],
        palette: ["#FF0000"],
        forbidden_colors: [],
        motifs: ["halo"],
        composition_notes: [],
        zone_guides: []
      }
    });
    const second = buildMockDecision({
      agent,
      round: 3,
      width: 8,
      height: 8,
      opponents,
      validActionHints: hints,
      artDirection: {
        mode: "myth",
        theme_prompt: "test",
        title: "Test",
        mood_words: ["steady"],
        palette: ["#FF0000"],
        forbidden_colors: [],
        motifs: ["halo"],
        composition_notes: [],
        zone_guides: []
      }
    });

    expect(first).toEqual(second);
  });

  test("includes persona-specific flavor and shared-history context", () => {
    const decision = buildMockDecision({
      agent: makeAgent(),
      round: 3,
      width: 8,
      height: 8,
      opponents: [makeOpponent()],
      validActionHints: hints,
      artDirection: {
        mode: "myth",
        theme_prompt: "test",
        title: "Test",
        mood_words: ["steady"],
        palette: ["#FF0000"],
        forbidden_colors: [],
        motifs: ["halo"],
        composition_notes: [],
        zone_guides: []
      }
    });

    expect(
      decision.public_message.toLowerCase().includes("oracle") ||
        decision.public_message.toLowerCase().includes("honor")
    ).toBe(true);
    expect(decision.private_messages[0]?.content).toContain("r2 signed a pact");
  });
});
