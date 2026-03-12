import { describe, expect, it } from "vitest";

import { reduceConnection } from "./connectionReducer";

describe("reduceConnection", () => {
  it("idle → connecting on start", () => {
    expect(reduceConnection("idle", { type: "start" })).toBe("connecting");
  });

  it("connecting → authenticating on ws-open", () => {
    expect(reduceConnection("connecting", { type: "ws-open" })).toBe("authenticating");
  });

  it("authenticating → connected on auth-ok", () => {
    expect(reduceConnection("authenticating", { type: "auth-ok" })).toBe("connected");
  });

  it("authenticating → disconnected on auth-fail", () => {
    expect(reduceConnection("authenticating", { type: "auth-fail", reason: "bad token" })).toBe("disconnected");
  });

  it("connected → reconnecting on ws-close", () => {
    expect(reduceConnection("connected", { type: "ws-close" })).toBe("reconnecting");
  });

  it("connected → disconnected on disconnect", () => {
    expect(reduceConnection("connected", { type: "disconnect" })).toBe("disconnected");
  });

  it("reconnecting → authenticating on ws-open", () => {
    expect(reduceConnection("reconnecting", { type: "ws-open" })).toBe("authenticating");
  });

  it("reconnecting → disconnected on retry-exhausted", () => {
    expect(reduceConnection("reconnecting", { type: "retry-exhausted" })).toBe("disconnected");
  });

  it("disconnected → connecting on start", () => {
    expect(reduceConnection("disconnected", { type: "start" })).toBe("connecting");
  });

  it("ws-error from connecting → reconnecting", () => {
    expect(reduceConnection("connecting", { type: "ws-error" })).toBe("reconnecting");
  });

  it("ws-error from connected → reconnecting", () => {
    expect(reduceConnection("connected", { type: "ws-error" })).toBe("reconnecting");
  });

  it("ws-error from authenticating → reconnecting", () => {
    expect(reduceConnection("authenticating", { type: "ws-error" })).toBe("reconnecting");
  });

  it("ws-close from connecting → reconnecting", () => {
    expect(reduceConnection("connecting", { type: "ws-close" })).toBe("reconnecting");
  });

  it("ws-close from authenticating → reconnecting", () => {
    expect(reduceConnection("authenticating", { type: "ws-close" })).toBe("reconnecting");
  });

  it("ignores unknown transitions", () => {
    expect(reduceConnection("idle", { type: "ws-open" })).toBe("idle");
    expect(reduceConnection("idle", { type: "auth-ok" })).toBe("idle");
    expect(reduceConnection("disconnected", { type: "ws-close" })).toBe("disconnected");
  });
});
