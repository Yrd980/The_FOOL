import { useCallback, useEffect, useMemo, useState } from "react";
import {
  audienceHandles,
  contestants as seedContestants,
  danmuTemplates,
} from "../data";
import { deriveConversationState } from "./deriveConversationState";
import { appendSeedInteraction, createInitialSnapshot, reduceRoomAction } from "./seedRoomSource";
import { buildRoomDirectory } from "./rooms";
import { buildRoomViewModel } from "./buildRoomViewModel";
import type {
  AudioMode,
  RoomAction,
  RoomActionApi,
  RoomSourceSnapshot,
  SeedRoomSourceInputs,
  SeedRoomSourceResult,
} from "./types";

export const useSeedRoomSource = (inputs: SeedRoomSourceInputs): SeedRoomSourceResult => {
  const [snapshot, setSnapshot] = useState<RoomSourceSnapshot>(() =>
    createInitialSnapshot({ activeStageId: inputs.activeStageId }),
  );

  const dispatch = useCallback((action: RoomAction) => {
    setSnapshot((current) => reduceRoomAction(current, action));
  }, []);

  // Sync activeStageId from App into snapshot
  useEffect(() => {
    setSnapshot((current) =>
      current.activeStageId !== inputs.activeStageId
        ? { ...current, activeStageId: inputs.activeStageId }
        : current,
    );
  }, [inputs.activeStageId]);

  // Sync selectedContestantId from App into snapshot
  useEffect(() => {
    setSnapshot((current) =>
      current.selectedContestantId !== inputs.selectedContestantId
        ? { ...current, selectedContestantId: inputs.selectedContestantId }
        : current,
    );
  }, [inputs.selectedContestantId]);

  // 7-second feed interval
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSnapshot((current) => {
        if (current.feedPaused) return current;
        const nextInteractions = appendSeedInteraction({
          current: current.interactions,
          contestants: seedContestants,
          audienceHandles,
          danmuTemplates,
        });
        return { ...current, interactions: nextInteractions };
      });
    }, 7000);

    return () => window.clearInterval(timer);
  }, []);

  // Derive conversation state using inputs from App
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
      selectedContestantId: snapshot.selectedContestantId,
      focusTeamName: stageFocusTeamName,
      focusHeadline: inputs.focusHeadline,
      nearbyHint: inputs.nearbyHint,
      contestantNameById: inputs.contestantNameById,
      priorityContestantId: snapshot.priorityContestantId,
    });
  }, [
    inputs.activeStageId,
    inputs.activeStageTitle,
    inputs.contestantDeck,
    inputs.focusTeam,
    inputs.teams,
    inputs.aiResults.summaries,
    inputs.audienceSummary.leadingContestantId,
    inputs.focusHeadline,
    inputs.nearbyHint,
    inputs.contestantNameById,
    snapshot.selectedContestantId,
    snapshot.priorityContestantId,
  ]);

  // Build room directory
  const roomDirectory = useMemo(
    () =>
      buildRoomDirectory({
        currentRoomId: snapshot.currentRoomId,
        conversationState: stageConversation,
        teams: inputs.teams,
        orderedContestantIds: inputs.contestantDeck.map((c) => c.id),
        listenerEntityIds: inputs.listenerEntityIds,
      }),
    [
      snapshot.currentRoomId,
      stageConversation,
      inputs.teams,
      inputs.contestantDeck,
      inputs.listenerEntityIds,
    ],
  );

  // Discard scenario override if targetRoomId became invalid
  useEffect(() => {
    if (snapshot.scenarioOverride.type === "none") return;
    const validRoomIds = new Set(roomDirectory.rooms.map((r) => r.id));
    if (!validRoomIds.has(snapshot.scenarioOverride.targetRoomId)) {
      setSnapshot((current) => ({ ...current, scenarioOverride: { type: "none" } }));
    }
  }, [roomDirectory.rooms, snapshot.scenarioOverride]);

  // Build room view model
  const roomViewModel = useMemo(
    () =>
      buildRoomViewModel({
        conversationState: stageConversation,
        orderedContestantIds: inputs.contestantDeck.map((c) => c.id),
        interactions: snapshot.interactions,
        audioMode: snapshot.audioMode,
        nearbyHint: inputs.nearbyHint,
        contestantNameById: inputs.contestantNameById,
        teams: inputs.teams,
        focusTeamId: inputs.focusTeam.id,
        currentRoom: roomDirectory.currentRoom,
        scenarioOverride: snapshot.scenarioOverride,
        currentRoomId: snapshot.currentRoomId,
      }),
    [
      stageConversation,
      inputs.contestantDeck,
      snapshot.interactions,
      snapshot.audioMode,
      inputs.nearbyHint,
      inputs.contestantNameById,
      inputs.teams,
      inputs.focusTeam.id,
      roomDirectory.currentRoom,
      snapshot.scenarioOverride,
      snapshot.currentRoomId,
    ],
  );

  const actions: RoomActionApi = useMemo(
    () => ({
      switchRoom: (roomId: string) => dispatch({ type: "switch-room", roomId }),
      joinConversation: () => dispatch({ type: "join-conversation" }),
      leaveConversation: () => dispatch({ type: "leave-conversation" }),
      setAudioMode: (mode: AudioMode) => dispatch({ type: "set-audio-mode", mode }),
      toggleFeedPaused: () => dispatch({ type: "toggle-feed-paused" }),
      injectScenario: (scenario: string, targetRoomId?: string) =>
        dispatch({ type: "inject-scenario", scenario, targetRoomId }),
      resetDemo: () => dispatch({ type: "reset-demo" }),
      setActiveStageId: (stageId: string) =>
        setSnapshot((current) => ({ ...current, activeStageId: stageId })),
      setSelectedContestantId: (id: string | null) =>
        setSnapshot((current) => ({ ...current, selectedContestantId: id })),
      setPriorityContestantId: (id: string | null) =>
        setSnapshot((current) => ({ ...current, priorityContestantId: id })),
    }),
    [dispatch],
  );

  return { snapshot, roomDirectory, roomViewModel, actions };
};
