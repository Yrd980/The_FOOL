import { describe, expect, it } from "vitest";

import { DEFAULT_REGISTRY, lookupContestant } from "./agentRegistry";
import type { AgentRegistry } from "./agentRegistry";

describe("DEFAULT_REGISTRY", () => {
  it("has 20 entries", () => {
    expect(DEFAULT_REGISTRY).toHaveLength(20);
  });

  it("has zero-padded agentIds", () => {
    expect(DEFAULT_REGISTRY[0].agentId).toBe("contestant-01");
    expect(DEFAULT_REGISTRY[19].agentId).toBe("contestant-20");
  });

  it("has sequential slots 1-20", () => {
    expect(DEFAULT_REGISTRY.map((r) => r.slot)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });
});

describe("lookupContestant", () => {
  const registry: AgentRegistry = [
    { agentId: "contestant-01", contestantId: "c-01", displayName: "Alpha", slot: 1 },
    { agentId: "contestant-02", contestantId: "c-02", displayName: "Beta", slot: 2 },
  ];

  it("finds a registered agent", () => {
    expect(lookupContestant(registry, "contestant-01")).toEqual(registry[0]);
  });

  it("returns undefined for unknown agent", () => {
    expect(lookupContestant(registry, "contestant-99")).toBeUndefined();
  });
});
