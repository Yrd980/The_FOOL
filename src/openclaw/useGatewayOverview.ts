import { useEffect, useMemo, useState } from "react";
import type { GatewayOverview } from "../types";
import {
  DEFAULT_GATEWAY_ROOM_IDS,
  getRoomLabel,
  resolveSessionRoomId,
} from "./control";
import { OpenClawGatewayClient } from "./gateway/OpenClawGatewayClient";
import type {
  ConnectionState,
  GatewayConfig,
  GatewaySessionEntry,
} from "./gateway/types";

const AUTH_FAIL_MESSAGE =
  "Gateway authentication failed. Check VITE_OPENCLAW_TOKEN.";

const normalizeTimestamp = (ts: number): number => (ts < 1e12 ? ts * 1000 : ts);

const deriveContestantState = (
  session: GatewaySessionEntry,
): "speaking" | "raised-hand" | "listening" | "muted" => {
  const idleMs = Date.now() - normalizeTimestamp(session.updatedAt);

  if (session.abortedLastRun) {
    return idleMs < 90_000 ? "raised-hand" : "muted";
  }

  if (idleMs < 45_000) return "speaking";
  if (idleMs < 90_000) return "raised-hand";
  if (idleMs < 300_000) return "listening";
  return "muted";
};

const stateMeta = {
  speaking: { label: "Speaking", tone: "critical" as const },
  "raised-hand": { label: "Raised Hand", tone: "active" as const },
  listening: { label: "Listening", tone: "warm" as const },
  muted: { label: "Muted", tone: "idle" as const },
};

const formatUpdatedLabel = (updatedAt: number): string => {
  const deltaMs = Date.now() - normalizeTimestamp(updatedAt);
  if (deltaMs < 60_000) {
    return `${Math.max(1, Math.round(deltaMs / 1000))}s ago`;
  }
  if (deltaMs < 3_600_000) {
    return `${Math.round(deltaMs / 60_000)}m ago`;
  }
  return `${Math.round(deltaMs / 3_600_000)}h ago`;
};

export function useGatewayOverview(): GatewayOverview {
  const gatewayUrl = import.meta.env.VITE_OPENCLAW_URL?.trim() || "";
  const gatewayToken = import.meta.env.VITE_OPENCLAW_TOKEN?.trim() || "";
  const configured = Boolean(gatewayUrl && gatewayToken);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [authFailed, setAuthFailed] = useState(false);
  const [sessions, setSessions] = useState<GatewaySessionEntry[]>([]);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const config: GatewayConfig = {
      id: "molt-claw",
      url: gatewayUrl,
      token: gatewayToken,
    };

    const client = new OpenClawGatewayClient(config);
    const unsubscribers = [
      client.on("connection-change", (state) => {
        setConnectionState(state);
        if (state === "connected") {
          setAuthFailed(false);
        }
      }),
      client.on("auth-error", () => {
        setAuthFailed(true);
      }),
      client.on("status", (entries) => {
        setSessions(entries);
      }),
    ];

    client.connect();

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      client.destroy();
    };
  }, [configured, gatewayToken, gatewayUrl]);

  return useMemo(() => {
    if (!configured) {
      return {
        configured: false,
        gatewayUrl: null,
        connectionState: "idle",
        authFailed: false,
        statusMessage: "OpenClaw not configured in this environment.",
        totalActiveSessions: 0,
        roomCounts: DEFAULT_GATEWAY_ROOM_IDS.map((roomId) => ({
          roomId,
          label: getRoomLabel(roomId),
          count: 0,
        })),
        sessions: [],
      };
    }

    const roomCounts = DEFAULT_GATEWAY_ROOM_IDS.map((roomId) => ({
      roomId,
      label: getRoomLabel(roomId),
      count: sessions.filter((session) => resolveSessionRoomId(session.key) === roomId)
        .length,
    }));

    const sessionSummaries = [...sessions]
      .sort((left, right) => normalizeTimestamp(right.updatedAt) - normalizeTimestamp(left.updatedAt))
      .slice(0, 8)
      .map((session) => {
        const roomId = resolveSessionRoomId(session.key);
        const state = deriveContestantState(session);
        return {
          agentId: session.agentId,
          sessionKey: session.key,
          roomId,
          roomLabel: getRoomLabel(roomId),
          updatedAt: normalizeTimestamp(session.updatedAt),
          updatedLabel: formatUpdatedLabel(session.updatedAt),
          state,
          stateLabel: stateMeta[state].label,
          stateTone: stateMeta[state].tone,
        };
      });

    let statusMessage = "Connected to the gateway and reading active contestant sessions.";
    if (authFailed) {
      statusMessage = AUTH_FAIL_MESSAGE;
    } else if (connectionState === "connected" && sessions.length === 0) {
      statusMessage = "Connected, but no contestant sessions are active yet.";
    } else if (connectionState === "connecting") {
      statusMessage = "Connecting to OpenClaw gateway...";
    } else if (connectionState === "authenticating") {
      statusMessage = "Authenticating with the OpenClaw gateway...";
    } else if (connectionState === "reconnecting") {
      statusMessage = "Gateway dropped. Attempting to reconnect...";
    } else if (connectionState === "disconnected") {
      statusMessage = "Gateway disconnected. Check URL, token, and local gateway availability.";
    }

    return {
      configured: true,
      gatewayUrl,
      connectionState,
      authFailed,
      statusMessage,
      totalActiveSessions: sessions.length,
      roomCounts,
      sessions: sessionSummaries,
    };
  }, [authFailed, configured, connectionState, gatewayUrl, sessions]);
}
