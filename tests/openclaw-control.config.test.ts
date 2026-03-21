import { describe, expect, test } from "bun:test";
import {
  normalizeControlGatewayUrl,
  normalizeOrchestratorBaseUrl,
} from "../src/openclaw/control";

describe("openclaw control URL normalization", () => {
  test("preserves explicitly configured gateway proxy URLs", () => {
    expect(normalizeControlGatewayUrl("ws://127.0.0.1:4173/ws")).toBe(
      "ws://127.0.0.1:4173/ws",
    );
  });

  test("normalizes root websocket gateway URLs without proxy rewriting", () => {
    expect(normalizeControlGatewayUrl("ws://127.0.0.1:18789/")).toBe(
      "ws://127.0.0.1:18789",
    );
  });

  test("normalizes websocket orchestrator URLs to http base URLs", () => {
    expect(normalizeOrchestratorBaseUrl("ws://127.0.0.1:18791/")).toBe(
      "http://127.0.0.1:18791",
    );
  });
});
