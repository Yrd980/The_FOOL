import { useEffect, useMemo, useRef, useState } from "react";
import {
  OpenClawGatewayClient,
  buildAgentRegistry,
  buildPresenceContestantMap,
  lookupContestant,
  mapSessionsToContestantStates,
  mapGatewayMessage,
  resolveGatewayContestantId,
} from "./gateway";
import { buildLiveRoomDirectory, buildLiveRoomViewModel, resolveSessionRoomId } from "./gatewayLiveRoom";
import type {
  AudioMode,
  RoomActionApi,
  RoomSourceSnapshot,
  SeedRoomSourceInputs,
  SeedRoomSourceResult,
  ScenarioOverride,
} from "./types";
import type { ConnectionState, GatewayConfig, GatewayPresenceEntry, GatewaySessionEntry } from "./gateway/types";
import type { AudienceInteraction } from "../types";

const ZERO_PRESENCE_CALLOUT = "Waiting for gateway connections...";
const AUTH_FAIL_CALLOUT = "Gateway authentication failed. Check VITE_OPENCLAW_TOKEN.";

export const useGatewayRoomSource = (
  inputs: SeedRoomSourceInputs,
  config: GatewayConfig,
): SeedRoomSourceResult => {
  const clientRef = useRef<OpenClawGatewayClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>("idle");
  const [presences, setPresences] = useState<GatewayPresenceEntry[]>([]);
  const [sessions, setSessions] = useState<GatewaySessionEntry[]>([]);
  const [interactions, setInteractions] = useState<AudienceInteraction[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState("main-stage");
  const [audioMode, setAudioMode] = useState<AudioMode>("nearby");
  const [feedPaused, setFeedPaused] = useState(false);
  const [scenarioOverride, setScenarioOverride] = useState<ScenarioOverride>({ type: "none" });
  const [currentUserMode, setCurrentUserMode] = useState<"perimeter" | "listening">("perimeter");
  const [authFailed, setAuthFailed] = useState(false);
  const feedPausedRef = useRef(feedPaused);
  feedPausedRef.current = feedPaused;
  const presenceContestantMapRef = useRef(new Map<string, string>());
  const gatewayRegistry = useMemo(
    () => buildAgentRegistry(inputs.gatewayContestants),
    [inputs.gatewayContestants],
  );
  const gatewayRegistryRef = useRef(gatewayRegistry);
  gatewayRegistryRef.current = gatewayRegistry;
  const gatewayContestantIds = useMemo(
    () => inputs.gatewayContestants.map((contestant) => contestant.id),
    [inputs.gatewayContestants],
  );

  // Connect on mount
  useEffect(() => {
    setAuthFailed(false); // reset on config change

    const client = new OpenClawGatewayClient(config);
    clientRef.current = client;

    client.on("connection-change", (state) => {
      setConnectionStatus(state);
      if (state === "connected") {
        setAuthFailed(false);
      }
    });

    client.on("auth-error", () => {
      setAuthFailed(true);
    });

    client.on("presence", (entries) => {
      setPresences(entries);
    });

    client.on("status", (entries) => {
      setSessions(entries);
    });

    client.on("message", (msg) => {
      if (feedPausedRef.current) return;
      const contestantIds = gatewayRegistryRef.current.map((registration) => registration.contestantId);
      const contestantId = resolveGatewayContestantId(
        msg,
        presenceContestantMapRef.current,
        contestantIds,
        gatewayRegistryRef.current,
      );
      if (!contestantId) {
        return;
      }
      const interaction = mapGatewayMessage(msg, contestantId);
      setInteractions((prev) => [...prev, interaction]);
    });

    client.connect();

    return () => {
      client.destroy();
      clientRef.current = null;
    };
  }, [config.id, config.url, config.token]);

  // Build presence → contestant identity map (for message routing)
  const presenceContestantMap = useMemo(() => {
    const contestantIds = inputs.gatewayContestants.map((contestant) => contestant.id);
    return buildPresenceContestantMap(presences, contestantIds, {});
  }, [presences, inputs.gatewayContestants]);
  presenceContestantMapRef.current = presenceContestantMap;

  // Derive contestant states from session data
  const contestantStateMap = useMemo(() => {
    const contestantIds = inputs.contestantDeck.map((c) => c.id);
    return mapSessionsToContestantStates(sessions, gatewayRegistry, contestantIds);
  }, [gatewayRegistry, sessions, inputs.contestantDeck]);

  const contestantRoomIds = useMemo(() => {
    const roomIds = new Map<string, string>();
    for (const session of sessions) {
      const registration = lookupContestant(gatewayRegistry, session.agentId);
      if (!registration || !gatewayContestantIds.includes(registration.contestantId)) {
        continue;
      }
      roomIds.set(registration.contestantId, resolveSessionRoomId(session.key));
    }
    return roomIds;
  }, [gatewayContestantIds, gatewayRegistry, sessions]);

  const connectedClientCount = useMemo(
    () => presences.filter((p) => p.mode === "ui").length,
    [presences],
  );

  // Build room directory
  const roomDirectory = useMemo(
    () => buildLiveRoomDirectory({
      currentRoomId,
      orderedContestantIds: gatewayContestantIds,
      listenerEntityIds: inputs.listenerEntityIds,
      contestantRoomIds,
    }),
    [currentRoomId, gatewayContestantIds, inputs.listenerEntityIds, contestantRoomIds],
  );

  // Build room view model from openclaw-only live state
  const roomViewModel = useMemo(() => {
    const model = buildLiveRoomViewModel({
      orderedContestantIds: gatewayContestantIds,
      currentRoom: roomDirectory.currentRoom,
      contestantStateMap,
      interactions,
      audioMode,
      nearbyHint: inputs.nearbyHint,
      contestantNameById: inputs.contestantNameById,
      scenarioOverride,
      currentRoomId,
    });

    // Override callout for connection issues
    let callout = model.roomCallout;
    if (authFailed) {
      callout = AUTH_FAIL_CALLOUT;
    } else if (connectionStatus === "connected" && sessions.length === 0 && connectedClientCount === 0) {
      callout = ZERO_PRESENCE_CALLOUT;
    } else if (connectionStatus === "connecting" || connectionStatus === "reconnecting") {
      callout = `Connecting to gateway (${connectionStatus})...`;
    }

    return { ...model, roomCallout: callout };
  }, [
    gatewayContestantIds,
    roomDirectory.currentRoom,
    contestantStateMap,
    interactions,
    audioMode,
    inputs.nearbyHint,
    inputs.contestantNameById,
    scenarioOverride,
    currentRoomId,
    connectionStatus,
    sessions,
    connectedClientCount,
    authFailed,
  ]);

  // Build snapshot
  const snapshot: RoomSourceSnapshot = useMemo(
    () => ({
      activeStageId: inputs.activeStageId,
      currentRoomId,
      selectedContestantId: inputs.selectedContestantId,
      audioMode,
      feedPaused,
      interactions,
      priorityContestantId: null,
      scenarioOverride,
      currentUserMode,
      connectionStatus,
      onlineCount: connectedClientCount,
      seatStateByContestantId: Object.fromEntries(contestantStateMap),
    }),
    [
      inputs.activeStageId,
      currentRoomId,
      inputs.selectedContestantId,
      audioMode,
      feedPaused,
      interactions,
      scenarioOverride,
      currentUserMode,
      connectionStatus,
      connectedClientCount,
      contestantStateMap,
    ],
  );

  // Actions
  const actions: RoomActionApi = useMemo(
    () => ({
      switchRoom: (roomId: string) => setCurrentRoomId(roomId),
      joinConversation: () => setCurrentUserMode("listening"),
      leaveConversation: () => setCurrentUserMode("perimeter"),
      setAudioMode: (mode: AudioMode) => setAudioMode(mode),
      toggleFeedPaused: () => setFeedPaused((p) => !p),
      injectScenario: (scenario: string, targetRoomId?: string) => {
        if (scenario === "none") {
          setScenarioOverride({ type: "none" });
        } else if (scenario === "quiet-room" || scenario === "empty-room") {
          setScenarioOverride({ type: scenario, targetRoomId: targetRoomId ?? currentRoomId });
        }
      },
      resetDemo: () => {
        setCurrentRoomId("main-stage");
        setAudioMode("nearby");
        setFeedPaused(false);
        setScenarioOverride({ type: "none" });
        setCurrentUserMode("perimeter");
        setInteractions([]);
      },
      setActiveStageId: () => {},
      setSelectedContestantId: () => {},
      setPriorityContestantId: () => {},
    }),
    [currentRoomId],
  );

  return { snapshot, roomDirectory, roomViewModel, actions };
};
