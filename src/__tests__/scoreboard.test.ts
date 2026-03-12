import { describe, expect, test } from "bun:test";
import { buildScores } from "../engine/scoreboard";
import type { AgentState } from "../types";

function makeAgent(
  overrides: Partial<AgentState> & { id: string; name: string; color: string }
): AgentState {
  const { id, name, color, ...rest } = overrides;
  return {
    identity_dna: {
      archetype: "Test",
      core_values: ["honor"],
      speech_style: "calm",
      risk_appetite: 50,
      aggression_bias: 50,
      diplomacy_bias: 50,
      creativity_bias: 50,
      signature_moves: ["hold"],
      taboos: []
    },
    goal_weights: { territory: 0.25, art: 0.25, revenge: 0.25, reputation: 0.25 },
    emotion: { anger: 10, fear: 10, confidence: 60, satisfaction: 60 },
    reputation: 70,
    energy: 3,
    cooldowns: { burst: 0 },
    relations: [],
    memory: [],
    ...rest,
    id,
    name,
    color
  };
}

function makeBoard(width: number, height: number) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ owner: null as string | null, color: "#111111" }))
  );
}

describe("buildScores", () => {
  test("sorts ranking by final score and preserves territory counts", () => {
    const agents = [
      makeAgent({ id: "a1", name: "Alpha", color: "#FF0000" }),
      makeAgent({
        id: "a2",
        name: "Beta",
        color: "#00FF00",
        emotion: { anger: 25, fear: 20, confidence: 45, satisfaction: 40 }
      })
    ];
    const board = makeBoard(4, 4);
    board[0][0] = { owner: "a1", color: "#FF0000" };
    board[0][1] = { owner: "a1", color: "#FF0000" };
    board[1][0] = { owner: "a2", color: "#00FF00" };

    const scores = buildScores({
      agents,
      board,
      width: 4,
      height: 4,
      mythAestheticScore: (agent) => (agent.id === "a1" ? 75 : 40)
    });

    expect(scores.map((item) => item.agent_id)).toEqual(["a1", "a2"]);
    expect(scores[0].territory_cells).toBe(2);
    expect(scores[1].territory_cells).toBe(1);
    expect(scores[0].final_score).toBeGreaterThanOrEqual(scores[1].final_score);
  });
});
