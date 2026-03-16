import { useEffect, useMemo, useState } from "react";
import type {
  GatewayActivity,
  GatewayContestantSummary,
  GatewayOverview,
  GatewayStateCount,
  GatewaySessionSummary,
} from "../types";
import {
  DEFAULT_GATEWAY_ROOM_IDS,
  getRoomLabel,
  resolveSessionRoomId,
} from "./control";
import { OpenClawGatewayClient } from "./gateway/OpenClawGatewayClient";
import type {
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
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

const formatActivityLabel = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
};

export function useGatewayOverview(): GatewayOverview {
  const gatewayUrl = import.meta.env.VITE_OPENCLAW_URL?.trim() || "";
  const gatewayToken = import.meta.env.VITE_OPENCLAW_TOKEN?.trim() || "";
  const configured = Boolean(gatewayUrl && gatewayToken);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [authFailed, setAuthFailed] = useState(false);
  const [sessions, setSessions] = useState<GatewaySessionEntry[]>([]);
  const [messages, setMessages] = useState<GatewayMessage[]>([]);

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
      client.on("message", (message) => {
        setMessages((previous) => [message, ...previous].slice(0, 24));
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
        stateCounts: [
          { state: "speaking", label: "Speaking", count: 0, tone: "critical" },
          { state: "raised-hand", label: "Raised Hand", count: 0, tone: "active" },
          { state: "listening", label: "Listening", count: 0, tone: "warm" },
          { state: "muted", label: "Muted", count: 0, tone: "idle" },
        ],
        roomCounts: DEFAULT_GATEWAY_ROOM_IDS.map((roomId) => ({
          roomId,
          label: getRoomLabel(roomId),
          count: 0,
        })),
        roomRosters: DEFAULT_GATEWAY_ROOM_IDS.map((roomId) => ({
          roomId,
          label: getRoomLabel(roomId),
          sessions: [],
        })),
        sessions: [],
        contestants: [],
        activities: [],
      };
    }

    const roomCounts = DEFAULT_GATEWAY_ROOM_IDS.map((roomId) => ({
      roomId,
      label: getRoomLabel(roomId),
      count: sessions.filter((session) => resolveSessionRoomId(session.key) === roomId)
        .length,
    }));

    const allSessionSummaries: GatewaySessionSummary[] = [...sessions]
      .sort((left, right) => normalizeTimestamp(right.updatedAt) - normalizeTimestamp(left.updatedAt))
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

    const visibleSessions = allSessionSummaries.slice(0, 8);
    const roomByAgent = new Map(
      allSessionSummaries.map((session) => [
        session.agentId,
        {
          roomId: session.roomId,
          roomLabel: session.roomLabel,
        },
      ]),
    );

    const stateCounts: GatewayStateCount[] = [
      {
        state: "speaking",
        label: "Speaking",
        count: allSessionSummaries.filter((session) => session.state === "speaking").length,
        tone: "critical",
      },
      {
        state: "raised-hand",
        label: "Raised Hand",
        count: allSessionSummaries.filter((session) => session.state === "raised-hand").length,
        tone: "active",
      },
      {
        state: "listening",
        label: "Listening",
        count: allSessionSummaries.filter((session) => session.state === "listening").length,
        tone: "warm",
      },
      {
        state: "muted",
        label: "Muted",
        count: allSessionSummaries.filter((session) => session.state === "muted").length,
        tone: "idle",
      },
    ];

    const roomRosters = DEFAULT_GATEWAY_ROOM_IDS.map((roomId) => ({
      roomId,
      label: getRoomLabel(roomId),
      sessions: allSessionSummaries.filter((session) => session.roomId === roomId),
    }));

    const allActivities: GatewayActivity[] = messages
      .map((message) => {
        const relatedRoom = roomByAgent.get(message.senderId);
        const roomId = relatedRoom?.roomId ?? "quiet-orbit";

        return {
          id: message.id,
          agentId: message.senderId,
          roomId,
          roomLabel: relatedRoom?.roomLabel ?? getRoomLabel(roomId),
          content: message.content,
          timestamp: normalizeTimestamp(message.ts),
          timestampLabel: formatActivityLabel(normalizeTimestamp(message.ts)),
        };
      });

    const contestants: GatewayContestantSummary[] = allSessionSummaries
      .map((session) => {
        const recentActivities = allActivities
          .filter((activity) => activity.agentId === session.agentId)
          .slice(0, 3);

        return {
          ...session,
          activityCount: allActivities.filter((activity) => activity.agentId === session.agentId)
            .length,
          recentActivity: recentActivities[0] ?? null,
          recentActivities,
        };
      })
      .sort((left, right) => {
        const rightSignal = Math.max(
          right.updatedAt,
          right.recentActivity?.timestamp ?? 0,
        );
        const leftSignal = Math.max(left.updatedAt, left.recentActivity?.timestamp ?? 0);
        return rightSignal - leftSignal;
      });

    const activities = allActivities.slice(0, 12);

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
      stateCounts,
      roomCounts,
      roomRosters,
      sessions: visibleSessions,
      contestants,
      activities,
    };
  }, [authFailed, configured, connectionState, gatewayUrl, messages, sessions]);
}
