import { describe, expect, test } from "bun:test";
import { normalizeTurnDecision } from "../decisionNormalizer";

describe("normalizeTurnDecision", () => {
  test("maps allied_attack to joint_attack", () => {
    const normalized = normalizeTurnDecision({
      raw: {
        treaty_proposals: [
          {
            proposal_id: "p1",
            target_id: "a2",
            type: "allied_attack",
            duration_rounds: 2,
            target_enemy_id: "a3"
          }
        ]
      },
      agentId: "a1",
      round: 1,
      color: "#123456"
    });

    expect(normalized.treaty_proposals[0]).toEqual({
      proposal_id: "p1",
      target_id: "a2",
      type: "joint_attack",
      duration_rounds: 2,
      target_enemy_id: "a3"
    });
  });

  test("repairs aliases and preserves requesting identity fields", () => {
    const normalized = normalizeTurnDecision({
      raw: {
        agent_id: "a1",
        round: 7,
        action: {
          move: "attack",
          target: "-3,9"
        }
      },
      agentId: "a1",
      round: 7,
      color: "#123456"
    });

    expect(normalized.agent_id).toBe("a1");
    expect(normalized.round).toBe(7);
    expect(normalized.actions).toEqual([{ action: "invade", x: 0, y: 9 }]);
  });
});
