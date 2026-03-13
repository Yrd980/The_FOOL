import { describe, expect, test } from "bun:test";
import { hasJointAttackTreaty, updateTreaties } from "../engine/socialState";
import type { MemoryEvent, TurnDecision } from "../types";

function makeDecision(agentId: string, targetId: string, duration: number): TurnDecision {
  return {
    agent_id: agentId,
    round: 1,
    intent: "cooperate",
    public_message: "hold",
    private_messages: [],
    treaty_proposals: [
      {
        proposal_id: `${agentId}-p1`,
        target_id: targetId,
        type: "no_attack",
        duration_rounds: duration
      }
    ],
    actions: [{ action: "wait" }],
    emotion_delta: { anger: 0, fear: 0, confidence: 0, satisfaction: 0 },
    mood_change_reason: "steady"
  };
}

describe("updateTreaties", () => {
  test("signs reciprocal no_attack proposals into one active treaty", () => {
    const events: MemoryEvent[] = [];
    const treaties = updateTreaties({
      activeTreaties: [],
      round: 3,
      decisions: [makeDecision("a1", "a2", 4), makeDecision("a2", "a1", 2)],
      events
    });

    expect(treaties).toHaveLength(1);
    expect(treaties[0]).toEqual({
      a: "a1",
      b: "a2",
      type: "no_attack",
      expires_round: 4
    });
    expect(events.filter((event) => event.type === "signed_treaty")).toHaveLength(2);
  });
});

describe("joint_attack treaty", () => {
  test("reciprocal joint_attack proposals create treaty", () => {
    const decisions = [
      {
        agent_id: "a",
        treaty_proposals: [{ proposal_id: "p1", target_id: "b", type: "joint_attack" as const, duration_rounds: 3, target_enemy_id: "c" }],
        action: { action: "wait" as const },
        public_message: "",
        private_messages: [],
        persona_note: "",
        emotion_delta: { anger: 0, fear: 0, confidence: 0, satisfaction: 0 }
      },
      {
        agent_id: "b",
        treaty_proposals: [{ proposal_id: "p2", target_id: "a", type: "joint_attack" as const, duration_rounds: 3, target_enemy_id: "c" }],
        action: { action: "wait" as const },
        public_message: "",
        private_messages: [],
        persona_note: "",
        emotion_delta: { anger: 0, fear: 0, confidence: 0, satisfaction: 0 }
      }
    ];
    const events: any[] = [];
    const result = updateTreaties({ activeTreaties: [], round: 1, decisions: decisions as any, events });
    expect(result.some((t: any) => t.type === "joint_attack" && t.target_enemy_id === "c")).toBe(true);
    expect(events.some((e: any) => e.type === "joint_attack_signed")).toBe(true);
  });

  test("non-reciprocal joint_attack proposals do not create treaty", () => {
    const decisions = [
      {
        agent_id: "a",
        treaty_proposals: [{ proposal_id: "p1", target_id: "b", type: "joint_attack" as const, duration_rounds: 3, target_enemy_id: "c" }],
        action: { action: "wait" as const },
        public_message: "",
        private_messages: [],
        persona_note: "",
        emotion_delta: { anger: 0, fear: 0, confidence: 0, satisfaction: 0 }
      }
    ];
    const events: any[] = [];
    const result = updateTreaties({ activeTreaties: [], round: 1, decisions: decisions as any, events });
    expect(result.some((t: any) => t.type === "joint_attack")).toBe(false);
  });

  test("hasJointAttackTreaty finds matching treaty", () => {
    const treaties = [
      { a: "a", b: "b", type: "joint_attack" as const, expires_round: 5, target_enemy_id: "c" }
    ];
    const { found, allyId } = hasJointAttackTreaty(treaties as any, "a", "c", 3);
    expect(found).toBe(true);
    expect(allyId).toBe("b");
  });

  test("hasJointAttackTreaty returns false for expired treaty", () => {
    const treaties = [
      { a: "a", b: "b", type: "joint_attack" as const, expires_round: 2, target_enemy_id: "c" }
    ];
    const { found } = hasJointAttackTreaty(treaties as any, "a", "c", 3);
    expect(found).toBe(false);
  });
});
