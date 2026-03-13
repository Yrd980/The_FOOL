import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenClawGatewayClient } from "./OpenClawGatewayClient";
import type { ConnectionState } from "./types";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  triggerOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1000 });
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }
}

describe("OpenClawGatewayClient", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts in idle state", () => {
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "test-token" });
    expect(client.getConnectionState()).toBe("idle");
    client.destroy();
  });

  it("transitions to connecting on connect()", async () => {
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "test-token" });
    const states: ConnectionState[] = [];
    client.on("connection-change", (s) => states.push(s));

    client.connect();
    expect(client.getConnectionState()).toBe("connecting");

    client.destroy();
  });

  it("responds to challenge with auth token", () => {
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "my-token" });
    client.connect();

    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();

    // Simulate challenge
    ws.simulateMessage({
      type: "event",
      event: "connect.challenge",
      payload: { nonce: "abc123", ts: Date.now() },
    });

    // Client should have sent a connect request
    expect(ws.sent.length).toBeGreaterThan(0);
    const sent = JSON.parse(ws.sent[0]);
    expect(sent.type).toBe("req");
    expect(sent.method).toBe("connect");
    expect(sent.params.auth.token).toBe("my-token");

    client.destroy();
  });

  it("transitions to connected on hello-ok", () => {
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "test-token" });
    const states: ConnectionState[] = [];
    client.on("connection-change", (s) => states.push(s));

    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();

    // Challenge → connect → hello-ok
    ws.simulateMessage({ type: "event", event: "connect.challenge", payload: { nonce: "n", ts: 1 } });
    const connectReqId = JSON.parse(ws.sent[0]).id;
    ws.simulateMessage({ type: "res", id: connectReqId, ok: true, payload: { type: "hello-ok", protocol: 3 } });

    expect(client.getConnectionState()).toBe("connected");

    client.destroy();
  });

  it("cleans up on destroy", () => {
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "test-token" });
    client.connect();
    client.destroy();
    // Should not throw
    expect(client.getConnectionState()).toBe("idle");
  });

  it("emits auth-error on auth failure", () => {
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "bad-token" });
    let authError: string | null = null;
    client.on("auth-error", (reason) => { authError = reason; });

    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();

    ws.simulateMessage({ type: "event", event: "connect.challenge", payload: { nonce: "n", ts: 1 } });
    const connectReqId = JSON.parse(ws.sent[0]).id;
    ws.simulateMessage({ type: "res", id: connectReqId, ok: false, error: "invalid token" });

    expect(client.getConnectionState()).toBe("disconnected");
    expect(authError).toBe("invalid token");

    client.destroy();
  });

  it("emits pushed message events to subscribers", () => {
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "test-token" });
    let received: Record<string, unknown> | null = null;
    client.on("message", (message) => {
      received = message as unknown as Record<string, unknown>;
    });

    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();
    ws.simulateMessage({
      type: "event",
      event: "message",
      payload: {
        id: "msg-1",
        senderId: "agent-alpha",
        senderName: "Alpha",
        content: "下注 12",
        ts: 1710000000000,
      },
    });

    expect(received).toMatchObject({
      id: "msg-1",
      senderId: "agent-alpha",
      senderName: "Alpha",
      content: "下注 12",
    });

    client.destroy();
  });

  it("rejects pending RPC calls when destroyed", async () => {
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "test-token" });

    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();

    const outcome = client
      .call("system-presence")
      .then(() => "resolved")
      .catch((error: Error) => error.message);

    client.destroy();

    await expect(outcome).resolves.toMatch(/destroyed|closed|disconnected/i);
  });

  it("sends status RPC after authentication", () => {
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "test-token" });

    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();

    // Authenticate
    ws.simulateMessage({ type: "event", event: "connect.challenge", payload: { nonce: "n", ts: 1 } });
    const reqId = JSON.parse(ws.sent[0]).id;
    ws.simulateMessage({ type: "res", id: reqId, ok: true, payload: { type: "hello-ok" } });

    // After auth, client should have sent a status RPC
    const statusReq = ws.sent.find((s) => {
      const parsed = JSON.parse(s);
      return parsed.method === "status";
    });
    expect(statusReq).toBeDefined();

    client.destroy();
  });

  it("emits status event when status response arrives", async () => {
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "test-token" });

    const statusEvents: unknown[] = [];
    client.on("status", (entries) => statusEvents.push(entries));

    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.triggerOpen();

    // Authenticate
    ws.simulateMessage({ type: "event", event: "connect.challenge", payload: { nonce: "n", ts: 1 } });
    const reqId = JSON.parse(ws.sent[0]).id;
    ws.simulateMessage({ type: "res", id: reqId, ok: true, payload: { type: "hello-ok" } });

    // Find and respond to status RPC
    const statusReq = ws.sent.find((s) => JSON.parse(s).method === "status");
    const statusReqId = JSON.parse(statusReq!).id;
    ws.simulateMessage({
      type: "res",
      id: statusReqId,
      ok: true,
      payload: {
        sessions: {
          recent: [
            { agentId: "contestant-01", key: "agent:contestant-01:main", kind: "direct", updatedAt: Date.now(), abortedLastRun: false, inputTokens: 3, outputTokens: 5, totalTokens: 12000, model: "claude-opus-4-6", modelProvider: "anthropic", contextTokens: 200000 },
          ],
        },
      },
    });

    // Flush microtasks for async poll continuation
    await new Promise((r) => setTimeout(r, 0));

    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0]).toHaveLength(1);

    client.destroy();
  });

  it("reconnects after unexpected close with backoff", () => {
    vi.useFakeTimers();
    const client = new OpenClawGatewayClient({ id: "local", url: "ws://localhost:18789", token: "test-token" });
    client.connect();
    const ws1 = MockWebSocket.instances[0];
    ws1.triggerOpen();

    // Authenticate
    ws1.simulateMessage({ type: "event", event: "connect.challenge", payload: { nonce: "n", ts: 1 } });
    const reqId = JSON.parse(ws1.sent[0]).id;
    ws1.simulateMessage({ type: "res", id: reqId, ok: true, payload: { type: "hello-ok" } });
    expect(client.getConnectionState()).toBe("connected");

    // Simulate unexpected close
    ws1.onclose?.({ code: 1006 });
    expect(client.getConnectionState()).toBe("reconnecting");

    // 1st retry after 1s backoff
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances.length).toBe(2);

    client.destroy();
    vi.useRealTimers();
  });
});
