import { describe, expect, test } from "bun:test";
import { updateTreaties } from "../engine/socialState";
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
