import { describe, expect, test } from "bun:test";
import { applyActionToCanvas, createBoard } from "../engine/canvasRuntime";
import type { AgentState, MemoryEvent, Treaty } from "../types";

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
      aggression_bias: 70,
      diplomacy_bias: 50,
      creativity_bias: 50,
      signature_moves: ["push"],
      taboos: []
    },
    goal_weights: { territory: 0.25, art: 0.25, revenge: 0.25, reputation: 0.25 },
    emotion: { anger: 60, fear: 10, confidence: 80, satisfaction: 50 },
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

describe("applyActionToCanvas", () => {
  test("paint claims empty cells using mythColorForPoint", () => {
    const board = createBoard(8, 8);
    const agent = makeAgent({ id: "a1", name: "Alpha", color: "#FF0000" });
    const events: MemoryEvent[] = [];
    const currentRoundUpdateMap = new Map<string, { x: number; y: number; owner: string | null; color: string }>();

    applyActionToCanvas({
      agent,
      action: { action: "paint", x: 3, y: 3, color: "#123456" },
      round: 1,
      board,
      width: 8,
      height: 8,
      currentRoundUpdateMap,
      activeTreaties: [],
      events,
      mythColorForPoint: () => "#ABCDEF"
    });

    expect(board[3][3].owner).toBe("a1");
    expect(board[3][3].color).toBe("#ABCDEF");
    expect(events.some((event) => event.type === "expanded" && event.target === "3,3")).toBe(true);
    expect(currentRoundUpdateMap.get("3,3")).toEqual({
      x: 3,
      y: 3,
      owner: "a1",
      color: "#ABCDEF"
    });
  });

  test("invade breaks no_attack treaty and records treaty break", () => {
    const originalRandom = Math.random;
    Math.random = () => 0;

    try {
      const board = createBoard(4, 4);
      board[0][0].owner = "a1";
      board[0][0].color = "#FF0000";
      board[0][1].owner = "a2";
      board[0][1].color = "#00FF00";

      const attacker = makeAgent({
        id: "a1",
        name: "Alpha",
        color: "#FF0000",
        relations: [{ target_id: "a2", trust: 0, affinity: 0, debt: 0 }]
      });
      const events: MemoryEvent[] = [];
      const activeTreaties: Treaty[] = [{ a: "a1", b: "a2", type: "no_attack", expires_round: 3 }];

      applyActionToCanvas({
        agent: attacker,
        action: { action: "invade", x: 1, y: 0 },
        round: 1,
        board,
        width: 4,
        height: 4,
        currentRoundUpdateMap: new Map(),
        activeTreaties,
        events,
        mythColorForPoint: () => "#FEDCBA"
      });

      expect(attacker.reputation).toBe(50);
      expect(attacker.relations[0]?.trust).toBe(-25);
      expect(events.filter((event) => event.type === "broke_treaty")).toEqual([
        { round: 1, type: "broke_treaty", by: "a1", target: "a2" }
      ]);
    } finally {
      Math.random = originalRandom;
    }
  });
});
