import type { ConnectionEvent, ConnectionState } from "./types";

const transitions: Record<ConnectionState, Partial<Record<ConnectionEvent["type"], ConnectionState>>> = {
  idle: { start: "connecting" },
  connecting: { "ws-open": "authenticating", "ws-close": "reconnecting", "ws-error": "reconnecting" },
  authenticating: { "auth-ok": "connected", "auth-fail": "disconnected", "ws-close": "reconnecting", "ws-error": "reconnecting" },
  connected: { "ws-close": "reconnecting", "ws-error": "reconnecting", disconnect: "disconnected" },
  reconnecting: { "ws-open": "authenticating", "retry-exhausted": "disconnected" },
  disconnected: { start: "connecting" },
};

export const reduceConnection = (
  state: ConnectionState,
  event: ConnectionEvent,
): ConnectionState => transitions[state][event.type] ?? state;
