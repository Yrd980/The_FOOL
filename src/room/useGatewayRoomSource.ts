import { useEffect, useMemo, useRef, useState } from "react";
import { deriveConversationState } from "./deriveConversationState";
import { buildRoomViewModel } from "./buildRoomViewModel";
import { buildRoomDirectory } from "./rooms";
import {
  OpenClawGatewayClient,
  buildPresenceContestantMap,
  mapSessionsToContestantStates,
  mapGatewayMessage,
  resolveGatewayContestantId,
  DEFAULT_REGISTRY,
} from "./gateway";
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
  const contestantDeckRef = useRef(inputs.contestantDeck);
  contestantDeckRef.current = inputs.contestantDeck;
  const presenceContestantMapRef = useRef(new Map<string, string>());

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
      const contestantIds = contestantDeckRef.current.map((c) => c.id);
      const contestantId = resolveGatewayContestantId(
        msg,
        presenceContestantMapRef.current,
        contestantIds,
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
    const contestantIds = inputs.contestantDeck.map((c) => c.id);
    return buildPresenceContestantMap(presences, contestantIds, {});
  }, [presences, inputs.contestantDeck]);
  presenceContestantMapRef.current = presenceContestantMap;

  // Derive contestant states from session data
  const contestantStateMap = useMemo(() => {
    const contestantIds = inputs.contestantDeck.map((c) => c.id);
    return mapSessionsToContestantStates(sessions, DEFAULT_REGISTRY, contestantIds);
  }, [sessions, inputs.contestantDeck]);

  const connectedClientCount = useMemo(
    () => presences.filter((p) => p.mode === "ui").length,
    [presences],
  );

  // Build conversation state
  const stageConversation = useMemo(() => {
    const orderedContestantIds = inputs.contestantDeck.map((c) => c.id);
    const focusIds = inputs.focusTeam.members.map((m) => m.id);
    const championTeam = inputs.teams.find(
      (team) => team.id === inputs.aiResults.summaries[0]?.teamId,
    );
    const championIds = championTeam?.members.map((m) => m.id) ?? [];
    const stageFocusTeamName =
      inputs.activeStageId === "act-8" && championIds.length > 0
        ? (championTeam?.name ?? inputs.focusTeam.name)
        : inputs.focusTeam.name;

    return deriveConversationState({
      activeStageId: inputs.activeStageId,
      activeStageTitle: inputs.activeStageTitle,
      orderedContestantIds,
      focusIds,
      championIds,
      leadingContestantId: inputs.audienceSummary.leadingContestantId ?? null,
      defaultSpeakerId: focusIds[0] ?? orderedContestantIds[0] ?? null,
      selectedContestantId: inputs.selectedContestantId,
      focusTeamName: stageFocusTeamName,
      focusHeadline: inputs.focusHeadline,
      nearbyHint: inputs.nearbyHint,
      contestantNameById: inputs.contestantNameById,
      priorityContestantId: null,
    });
  }, [inputs]);

  // Build room directory
  const roomDirectory = useMemo(
    () =>
      buildRoomDirectory({
        currentRoomId,
        conversationState: stageConversation,
        teams: inputs.teams,
        orderedContestantIds: inputs.contestantDeck.map((c) => c.id),
        listenerEntityIds: inputs.listenerEntityIds,
      }),
    [currentRoomId, stageConversation, inputs.teams, inputs.contestantDeck, inputs.listenerEntityIds],
  );

  // Build room view model with gateway-derived overrides
  const roomViewModel = useMemo(() => {
    const model = buildRoomViewModel({
      conversationState: stageConversation,
      orderedContestantIds: inputs.contestantDeck.map((c) => c.id),
      interactions,
      audioMode,
      nearbyHint: inputs.nearbyHint,
      contestantNameById: inputs.contestantNameById,
      teams: inputs.teams,
      focusTeamId: inputs.focusTeam.id,
      currentRoom: roomDirectory.currentRoom,
      seatStateOverrides: Object.fromEntries(contestantStateMap),
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
    stageConversation,
    inputs,
    interactions,
    audioMode,
    scenarioOverride,
    currentRoomId,
    contestantStateMap,
    connectionStatus,
    sessions,
    connectedClientCount,
    authFailed,
    roomDirectory.currentRoom,
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
    }),
    [inputs.activeStageId, currentRoomId, inputs.selectedContestantId, audioMode, feedPaused, interactions, scenarioOverride, currentUserMode, connectionStatus],
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
