import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ConversationDock from "./components/ConversationDock";
import { DemoControlPanel } from "./components/DemoControlPanel";
import PresenceSidebar from "./components/PresenceSidebar";
import SpatialRoomFloor from "./components/SpatialRoomFloor";
import {
  aiJudges,
  audienceHandles,
  contestants,
  contestantOpenClawPresences,
  humanJudges,
  openClawConversation,
  seedAudienceInteractions,
  stageDefinitions,
} from "./data";
import {
  buildAiReviewSummary,
  buildAudienceSummary,
  buildContestantDeck,
  buildHumanReviews,
  buildTeams,
} from "./logic";
import { useSeedRoomSource } from "./room";
import type {
  ContestantOpenClawPresence,
  ContestantScorecard,
  OpenClawContestantState,
  StageId,
  TeamSummary,
} from "./types";

type SelectionKind = "contestant" | "judge" | "ai" | "listener";

type SidebarEntity = {
  selectionId: string;
  refId: string;
  kind: SelectionKind;
  group: string;
  name: string;
  subtitle: string;
  status: string;
  badge: string;
  accent: string;
  avatar: string;
  searchable: string;
  x?: number;
  y?: number;
};

type ContestantSeat = ContestantScorecard &
  ContestantOpenClawPresence & {
    selectionId: string;
    state: OpenClawContestantState;
    stateLabel: string;
    meter: number;
    teamName: string;
    stageNote: string;
    availabilityLabel: string;
    availabilityTone: "available" | "focus" | "busy";
  };

type DetailCard = {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  stats: Array<{ label: string; value: string }>;
  chips: string[];
  actions?: Array<{ id: string; label: string; active?: boolean; disabled?: boolean }>;
};

const formatter = new Intl.NumberFormat("zh-CN");

const stageTimerMap: Record<StageId, number> = {
  "act-1": 90,
  "act-2": 75,
  "act-3": 60,
  "act-4": 120,
  "act-5": 90,
  "act-6": 105,
  "act-7": 90,
  "act-8": 75,
  "act-9": 120,
  "act-10": 60,
};

const railItems = ["Hall", "Find", "Room", "Acts", "Feed"];

const listenerSpots = [
  { x: 16, y: 18 },
  { x: 84, y: 18 },
  { x: 18, y: 72 },
  { x: 82, y: 72 },
  { x: 72, y: 26 },
  { x: 26, y: 28 },
  { x: 64, y: 82 },
  { x: 34, y: 84 },
  { x: 90, y: 48 },
  { x: 10, y: 48 },
];

const miniLegend = {
  contestant: "#ffb372",
  judge: "#f3b46c",
  ai: "#83deff",
  listener: "#86ea84",
};

const humanAccentPalette = ["#f3b46c", "#f08f8f", "#ffe19a"];
const aiAccentPalette = ["#83deff", "#9facff", "#a0e57a"];
const listenerAccentPalette = ["#86ea84", "#84cbff", "#f29ec4", "#f2b36d"];

const stateRank: Record<OpenClawContestantState, number> = {
  speaking: 0,
  "raised-hand": 1,
  listening: 2,
  queued: 3,
  muted: 4,
};

const buildSelectionId = (kind: SelectionKind, value: string) => `${kind}:${value}`;

const parseSelectionId = (value: string): [SelectionKind, string] => {
  const separator = value.indexOf(":");

  if (separator === -1) {
    return ["contestant", value];
  }

  return [value.slice(0, separator) as SelectionKind, value.slice(separator + 1)];
};

const buildAvatar = (value: string) => {
  const compact = value.replace(/\s+/g, "");

  if (compact.length >= 2) {
    return `${compact[0]}${compact[compact.length - 1]}`;
  }

  return compact.slice(0, 2).toUpperCase();
};

const stateCopy: Record<
  OpenClawContestantState,
  { label: string; meter: number; status: string }
> = {
  speaking: { label: "LIVE", meter: 96, status: "Mic live" },
  "raised-hand": { label: "HAND", meter: 78, status: "Raised hand" },
  listening: { label: "LISTEN", meter: 64, status: "Listening in" },
  queued: { label: "QUEUE", meter: 52, status: "Ready to jump" },
  muted: { label: "MUTED", meter: 32, status: "Muted off stage" },
};

const resolveTeamForContestant = (
  contestantId: string,
  teams: TeamSummary[],
  fallbackTeam: TeamSummary,
) =>
  teams.find((team) => team.members.some((member) => member.id === contestantId)) ?? fallbackTeam;

const buildContestantGroup = (state: OpenClawContestantState) => {
  if (state === "speaking" || state === "listening") {
    return "On mic";
  }

  if (state === "raised-hand" || state === "queued") {
    return "Queue rail";
  }

  return "Listener orbit";
};

const buildAvailability = (
  state: OpenClawContestantState,
): { label: string; tone: "available" | "focus" | "busy" } => {
  if (state === "speaking" || state === "listening") {
    return { label: "In convo", tone: "busy" };
  }

  if (state === "raised-hand" || state === "queued") {
    return { label: "Available", tone: "available" };
  }

  return { label: "Focus", tone: "focus" };
};

function App() {
  const [activeStageId, setActiveStageId] = useState<StageId>(stageDefinitions[0].id);
  const [selectedEntityId, setSelectedEntityId] = useState(
    buildSelectionId("contestant", contestants[0].id),
  );
  const [memberQuery, setMemberQuery] = useState("");
  const [simplifiedView, setSimplifiedView] = useState(false);

  const deferredQuery = useDeferredValue(memberQuery);

  const activeStage =
    stageDefinitions.find((stage) => stage.id === activeStageId) ?? stageDefinitions[0];
  const activeStageIndex = stageDefinitions.findIndex((stage) => stage.id === activeStageId);
  const activeStageTimer = stageTimerMap[activeStage.id] ?? 90;
  const [countdown, setCountdown] = useState(activeStageTimer);

  useEffect(() => {
    setCountdown(activeStageTimer);
  }, [activeStage.id, activeStageTimer]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((current) => (current <= 1 ? activeStageTimer : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeStageTimer]);

  // Use a ref to break the circular dependency between the hook (which owns interactions)
  // and the business derivations (which need interactions). On first render, use initial seed
  // data. On subsequent renders, use the previous render's snapshot.interactions.
  const interactionsRef = useRef(seedAudienceInteractions);

  const [selectedKind, selectedRef] = parseSelectionId(selectedEntityId);

  // Business derivations computed from latest available interactions
  const contestantDeck = useMemo(
    () => buildContestantDeck(contestants, interactionsRef.current),
    [interactionsRef.current],
  );

  const contestantMap = useMemo(
    () =>
      contestantDeck.reduce<Record<string, ContestantScorecard>>((acc, contestant) => {
        acc[contestant.id] = contestant;
        return acc;
      }, {}),
    [contestantDeck],
  );

  const teams = useMemo(() => buildTeams(contestantDeck, 3), [contestantDeck]);

  const teamMap = useMemo(
    () =>
      teams.reduce<Record<string, TeamSummary>>((acc, team) => {
        acc[team.id] = team;
        return acc;
      }, {}),
    [teams],
  );

  const audienceSummary = useMemo(
    () => buildAudienceSummary(contestantDeck, interactionsRef.current, teams),
    [contestantDeck, interactionsRef.current, teams],
  );

  const humanReviews = useMemo(() => buildHumanReviews(teams, humanJudges), [teams]);
  const aiResults = useMemo(() => buildAiReviewSummary(teams, aiJudges), [teams]);

  const fallbackTeam = teams[0]!;
  const leadingTeam = teamMap[audienceSummary.leadingTeamId] ?? fallbackTeam;
  const selectedContestant =
    selectedKind === "contestant" ? contestantMap[selectedRef] : undefined;
  const focusTeam = selectedContestant
    ? resolveTeamForContestant(selectedContestant.id, teams, leadingTeam)
    : leadingTeam;

  const contestantNameById = useMemo(
    () =>
      contestantDeck.reduce<Record<string, string>>((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {}),
    [contestantDeck],
  );

  // Build listener entity IDs for the room directory
  const listenerEntityIds = useMemo(() => {
    const judgeIds = humanJudges.map((j) => j.id);
    const aiIds = aiJudges.map((j) => j.id);
    return [...judgeIds, ...aiIds];
  }, []);

  // Hook inputs — derived from business logic
  const hookInputs = useMemo(
    () => ({
      contestantDeck,
      teams,
      focusTeam,
      aiResults,
      audienceSummary,
      activeStageId: activeStage.id,
      activeStageTitle: activeStage.title,
      nearbyHint: openClawConversation.nearbyHint,
      contestantNameById,
      selectedContestantId: selectedContestant?.id ?? null,
      focusHeadline: focusTeam.submission.headline,
      listenerEntityIds,
    }),
    [
      contestantDeck,
      teams,
      focusTeam,
      aiResults,
      audienceSummary,
      activeStage.id,
      activeStage.title,
      contestantNameById,
      selectedContestant?.id,
      listenerEntityIds,
    ],
  );

  const { snapshot, roomDirectory, roomViewModel, actions } = useSeedRoomSource(hookInputs);

  // Update the ref so next render uses current interactions
  interactionsRef.current = snapshot.interactions;

  const { interactions, audioMode, priorityContestantId } = snapshot;
  const { roomCallout, audibleSignals } = roomViewModel;

  const seatStateMap = useMemo(
    () =>
      roomViewModel.openClawSeats.reduce<Record<string, OpenClawContestantState>>((acc, seat) => {
        acc[seat.id] = seat.state;
        return acc;
      }, {}),
    [roomViewModel.openClawSeats],
  );

  const presenceMap = useMemo(
    () =>
      contestantOpenClawPresences.reduce<Record<string, ContestantOpenClawPresence>>(
        (acc, presence) => {
          acc[presence.contestantId] = presence;
          return acc;
        },
        {},
      ),
    [],
  );

  const openClawSeats = useMemo<ContestantSeat[]>(
    () =>
      contestantDeck.map((contestant, index) => {
        const fallbackPresence = contestantOpenClawPresences[index] ?? contestantOpenClawPresences[0];
        const presence = presenceMap[contestant.id] ?? {
          contestantId: contestant.id,
          seatLabel: `Seat ${index + 1}`,
          connectionLabel: "Joined the hallway grid",
          roomX: fallbackPresence?.roomX ?? 44 + index * 4,
          roomY: fallbackPresence?.roomY ?? 44 + index * 2,
        };

        const state: OpenClawContestantState = seatStateMap[contestant.id] ?? "muted";
        const seatState = stateCopy[state];
        const availability = buildAvailability(state);
        const team = resolveTeamForContestant(contestant.id, teams, focusTeam);
        const stageNote =
          state === "speaking"
            ? `${activeStage.title} 当前由 ${contestant.name} 扛主麦，队伍叙事和节奏都在她/他这里。`
            : state === "raised-hand"
              ? `${contestant.name} 已经举手等待切入，准备把 conversation 往下一段推进。`
              : state === "listening"
                ? `${team.name} 仍在当前对话环里，正在顺着房间节奏补位。`
                : state === "queued"
                  ? `${contestant.name} 在 queue rail 上候场，只要房间转向就会被拉进主圈。`
                  : "暂时退到房间边缘，继续听场内节奏。";

        return {
          ...contestant,
          ...presence,
          selectionId: buildSelectionId("contestant", contestant.id),
          state,
          stateLabel: seatState.label,
          meter: seatState.meter,
          teamName: team.name,
          stageNote,
          availabilityLabel: availability.label,
          availabilityTone: availability.tone,
        };
      }),
    [
      activeStage.title,
      contestantDeck,
      focusTeam,
      presenceMap,
      seatStateMap,
      teams,
    ],
  );

  const speakerSeats = useMemo(
    () =>
      [...openClawSeats].sort(
        (left, right) =>
          stateRank[left.state] - stateRank[right.state] ||
          right.supportScore - left.supportScore,
      ),
    [openClawSeats],
  );

  const listenerEntities = useMemo(() => {
    const orderedSources = [...interactions].reverse().map((event) => event.source);
    const allSources = [...orderedSources, ...audienceHandles];
    const uniqueSources: string[] = [];
    const seen = new Set<string>();

    for (const source of allSources) {
      if (seen.has(source)) {
        continue;
      }

      seen.add(source);
      uniqueSources.push(source);
    }

    const judgeListeners: SidebarEntity[] = humanJudges.map((judge, index) => ({
      selectionId: buildSelectionId("judge", judge.id),
      refId: judge.id,
      kind: "judge",
      group: "Observers",
      name: judge.name,
      subtitle: judge.role,
      status: judge.catchphrase,
      badge: "Judge",
      accent: humanAccentPalette[index % humanAccentPalette.length],
      avatar: buildAvatar(judge.name),
      searchable: `${judge.name} ${judge.role} ${judge.catchphrase}`,
      x: listenerSpots[index]?.x ?? 16,
      y: listenerSpots[index]?.y ?? 16,
    }));

    const aiListeners: SidebarEntity[] = aiJudges.map((judge, index) => ({
      selectionId: buildSelectionId("ai", judge.id),
      refId: judge.id,
      kind: "ai",
      group: "Observers",
      name: judge.name,
      subtitle: judge.title,
      status: judge.signature,
      badge: "AI",
      accent: aiAccentPalette[index % aiAccentPalette.length],
      avatar: "AI",
      searchable: `${judge.name} ${judge.title} ${judge.signature}`,
      x: listenerSpots[humanJudges.length + index]?.x ?? 82,
      y: listenerSpots[humanJudges.length + index]?.y ?? 22,
    }));

    const audienceListeners: SidebarEntity[] = uniqueSources.slice(0, 4).map((source, index) => {
      const latestEvent = [...interactions].reverse().find((event) => event.source === source);
      const spotIndex = humanJudges.length + aiJudges.length + index;

      return {
        selectionId: buildSelectionId("listener", source),
        refId: source,
        kind: "listener",
        group: "Nearby listeners",
        name: source,
        subtitle: latestEvent?.content ?? "Nearby listener",
        status: latestEvent ? latestEvent.type : "listen",
        badge: "Nearby",
        accent: listenerAccentPalette[index % listenerAccentPalette.length],
        avatar: buildAvatar(source),
        searchable: `${source} ${latestEvent?.content ?? ""}`,
        x: listenerSpots[spotIndex]?.x ?? 50,
        y: listenerSpots[spotIndex]?.y ?? 82,
      };
    });

    return [...judgeListeners, ...aiListeners, ...audienceListeners];
  }, [interactions]);

  const contestantSidebar = useMemo<SidebarEntity[]>(
    () =>
      speakerSeats.map((seat) => ({
        selectionId: seat.selectionId,
        refId: seat.id,
        kind: "contestant",
        group: buildContestantGroup(seat.state),
        name: seat.name,
        subtitle: `${seat.seatLabel} · ${seat.teamName}`,
        status: `${seat.availabilityLabel} · ${seat.connectionLabel}`,
        badge: seat.stateLabel,
        accent: seat.palette.primary,
        avatar: seat.avatarGlyph,
        searchable: `${seat.name} ${seat.title} ${seat.teamName} ${seat.connectionLabel}`,
      })),
    [speakerSeats],
  );

  const filteredContestants = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    if (!query) {
      return contestantSidebar;
    }

    return contestantSidebar.filter((entity) => entity.searchable.toLowerCase().includes(query));
  }, [contestantSidebar, deferredQuery]);

  const filteredListeners = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    if (!query) {
      return listenerEntities;
    }

    return listenerEntities.filter((entity) => entity.searchable.toLowerCase().includes(query));
  }, [deferredQuery, listenerEntities]);

  const contestantGroups = useMemo(
    () => ({
      onMic: filteredContestants.filter((entity) => entity.group === "On mic"),
      queue: filteredContestants.filter((entity) => entity.group === "Queue rail"),
      orbit: filteredContestants.filter((entity) => entity.group === "Listener orbit"),
    }),
    [filteredContestants],
  );

  const listenerGroups = useMemo(
    () => ({
      observers: filteredListeners.filter((entity) => entity.group === "Observers"),
      nearby: filteredListeners.filter((entity) => entity.group === "Nearby listeners"),
    }),
    [filteredListeners],
  );

  useEffect(() => {
    const allIds = [
      ...contestantSidebar.map((entity) => entity.selectionId),
      ...listenerEntities.map((entity) => entity.selectionId),
    ];

    if (allIds.length > 0 && !allIds.includes(selectedEntityId)) {
      setSelectedEntityId(contestantSidebar[0]?.selectionId ?? allIds[0]);
    }
  }, [contestantSidebar, listenerEntities, selectedEntityId]);

  const countdownLabel = `${String(Math.floor(countdown / 60)).padStart(2, "0")}:${String(
    countdown % 60,
  ).padStart(2, "0")}`;
  const onlineCount = openClawSeats.length + listenerEntities.length;
  const { micCount, queueCount } = roomViewModel;

  const detailCard = useMemo<DetailCard>(() => {
    if (selectedKind === "contestant") {
      const seat = openClawSeats.find((item) => item.id === selectedRef) ?? speakerSeats[0];
      const team = resolveTeamForContestant(seat.id, teams, focusTeam);

      return {
        badge: `${seat.seatLabel} / ${seat.stateLabel}`,
        title: seat.name,
        subtitle: `${seat.title} · ${team.name}`,
        description: seat.stageNote,
        stats: [
          { label: "Support", value: formatter.format(seat.supportScore) },
          { label: "Heat", value: formatter.format(seat.heatScore) },
          { label: "Mic", value: stateCopy[seat.state].status },
          { label: "Room", value: team.name },
        ],
        chips: [
          team.submission.headline,
          seat.strengths[0] ?? seat.specialties[0],
          seat.connectionLabel,
          seat.availabilityLabel,
        ],
        actions: [
          {
            id: "wave-over",
            label: seat.state === "speaking" ? "Already live" : "Wave over",
            active: seat.id === priorityContestantId,
            disabled: seat.state === "speaking",
          },
        ],
      };
    }

    if (selectedKind === "judge") {
      const judge = humanJudges.find((item) => item.id === selectedRef) ?? humanJudges[0];
      const review =
        humanReviews.find((item) => item.judgeId === judge.id && item.teamId === focusTeam.id)
          ?.summary ?? judge.catchphrase;

      return {
        badge: "Nearby judge",
        title: judge.name,
        subtitle: `${focusTeam.name} 的现场点评位`,
        description: review,
        stats: [
          { label: "Heat", value: formatter.format(Math.round(audienceSummary.heatIndex)) },
          { label: "Pot", value: formatter.format(audienceSummary.totalBetPoints) },
          { label: "Stage", value: `Act ${activeStage.order}` },
          { label: "Focus", value: focusTeam.name },
        ],
        chips: [judge.style, focusTeam.submission.headline, openClawConversation.roomLabel],
        actions: [],
      };
    }

    if (selectedKind === "ai") {
      const judge = aiJudges.find((item) => item.id === selectedRef) ?? aiJudges[0];
      const review =
        aiResults.reviews.find((item) => item.judgeId === judge.id && item.teamId === focusTeam.id)
          ?.reason ?? judge.signature;
      const summary =
        aiResults.summaries.find((item) => item.teamId === focusTeam.id)?.averageScore ?? 0;

      return {
        badge: "Observer AI",
        title: judge.name,
        subtitle: `${focusTeam.name} 的外圈算法视角`,
        description: review,
        stats: [
          { label: "Avg", value: summary.toFixed(1) },
          { label: "Axis", value: judge.focus },
          { label: "Severity", value: `${Math.round(judge.severity * 100)}%` },
          { label: "Wit", value: `${Math.round(judge.wit * 100)}%` },
        ],
        chips: [judge.persona, judge.signature, focusTeam.theme],
        actions: [],
      };
    }

    const listener = listenerEntities.find((item) => item.refId === selectedRef) ?? listenerEntities[0];
    const latestEvent = [...interactions].reverse().find((event) => event.source === selectedRef);

    return {
      badge: "Nearby listener",
      title: listener?.name ?? "Listener",
      subtitle: `${activeStage.title} 的现场旁听者`,
      description: latestEvent?.content ?? "正在房间边缘听选手们轮流上麦。",
      stats: [
        { label: "Action", value: latestEvent?.type ?? "listen" },
        { label: "Stage", value: `Act ${activeStage.order}` },
        { label: "Room", value: focusTeam.name },
        { label: "Timer", value: countdownLabel },
      ],
      chips: [activeStage.subtitle, focusTeam.submission.headline, "Passive listener"],
      actions: [],
    };
  }, [
    activeStage.order,
    activeStage.subtitle,
    activeStage.title,
    audioMode,
    aiResults.reviews,
    aiResults.summaries,
    audienceSummary.heatIndex,
    audienceSummary.totalBetPoints,
    countdownLabel,
    focusTeam,
    humanReviews,
    interactions,
    listenerEntities,
    openClawSeats,
    priorityContestantId,
    selectedKind,
    selectedRef,
    simplifiedView,
    speakerSeats,
    teams,
  ]);

  const handleDetailAction = (actionId: string) => {
    if (actionId === "wave-over" && selectedKind === "contestant") {
      actions.setPriorityContestantId(
        priorityContestantId === selectedRef ? null : selectedRef,
      );
      return;
    }

    if (actionId === "focus-audio") {
      actions.setAudioMode("focus");
      return;
    }

    if (actionId === "nearby-audio") {
      actions.setAudioMode("nearby");
      return;
    }

    if (actionId === "mute-audio") {
      actions.setAudioMode("muted");
      return;
    }

    if (actionId === "toggle-view") {
      setSimplifiedView((current) => !current);
    }
  };

  const selectEntity = (selectionId: string) => {
    startTransition(() => {
      setSelectedEntityId(selectionId);
    });
  };

  const moveStage = (direction: -1 | 1) => {
    const nextIndex = activeStageIndex + direction;

    if (nextIndex < 0 || nextIndex >= stageDefinitions.length) {
      return;
    }

    startTransition(() => {
      setActiveStageId(stageDefinitions[nextIndex].id);
    });
  };

  return (
    <div className={`openclaw-app ${simplifiedView ? "is-simplified" : ""}`}>
      <aside className="app-rail">
        <div className="rail-brand">OC</div>
        <div className="rail-actions">
          {railItems.map((item, index) => (
            <button
              className={`rail-button ${index === 2 ? "is-active" : ""}`}
              key={item}
              type="button"
            >
              {item.slice(0, 2)}
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <button className="rail-button" type="button">
            +
          </button>
          <button className="rail-button" type="button">
            ?
          </button>
        </div>
      </aside>

      <PresenceSidebar
        conversationSubtitle={openClawConversation.subtitle}
        conversationTitle={openClawConversation.title}
        conversationHostLabel={openClawConversation.hostLabel}
        memberQuery={memberQuery}
        onMemberQueryChange={setMemberQuery}
        activeStageOrder={activeStage.order}
        activeStageTitle={activeStage.title}
        activeStageSubtitle={activeStage.subtitle}
        countdownLabel={countdownLabel}
        micCount={micCount}
        queueCount={queueCount}
        listenerCount={listenerEntities.length}
        heatIndex={audienceSummary.heatIndex}
        filteredContestantCount={filteredContestants.length}
        filteredListenerCount={filteredListeners.length}
        contestantGroups={contestantGroups}
        listenerGroups={listenerGroups}
        selectedEntityId={selectedEntityId}
        onSelectEntity={selectEntity}
        detailCard={detailCard}
        onDetailAction={handleDetailAction}
        formatter={formatter}
      />

      <main className="world-shell">
        <ConversationDock
          conversationRoomLabel={openClawConversation.roomLabel}
          focusHeadline={focusTeam.submission.headline}
          conversationNearbyHint={openClawConversation.nearbyHint}
          activeStageOrder={activeStage.order}
          focusTeamName={focusTeam.name}
          audioMode={audioMode}
          simplifiedView={simplifiedView}
          onlineCount={onlineCount}
          speakerSeats={speakerSeats}
          selectedEntityId={selectedEntityId}
          onSelectEntity={selectEntity}
          onMoveStage={moveStage}
        />
        <DemoControlPanel
          currentRoomId={snapshot.currentRoomId}
          audioMode={snapshot.audioMode}
          feedPaused={snapshot.feedPaused}
          roomSwitchTargets={roomDirectory.rooms.map((r) => ({ id: r.id, name: r.name }))}
          onSwitchRoom={actions.switchRoom}
          onSetAudioMode={actions.setAudioMode}
          onToggleFeedPaused={actions.toggleFeedPaused}
          onInjectScenario={actions.injectScenario}
          onResetDemo={actions.resetDemo}
        />
        <SpatialRoomFloor
          conversationTitle={openClawConversation.title}
          activeStageTitle={activeStage.title}
          activeStageObjective={activeStage.objective}
          activeStageDeliverables={activeStage.deliverables}
          focusTeamName={focusTeam.name}
          focusTeamTheme={focusTeam.theme}
          conversationSubtitle={openClawConversation.subtitle}
          conversationHostLabel={openClawConversation.hostLabel}
          audibleSignals={audibleSignals}
          contestantMap={contestantMap}
          listenerEntities={listenerEntities}
          openClawSeats={openClawSeats}
          selectedEntityId={selectedEntityId}
          onSelectEntity={selectEntity}
          miniLegend={miniLegend}
          roomCallout={roomCallout}
          audioMode={audioMode}
          simplifiedView={simplifiedView}
          priorityContestantId={priorityContestantId}
          onSetAudioMode={actions.setAudioMode}
          onToggleSimplifiedView={() => setSimplifiedView((current) => !current)}
          onClearPriorityContestant={() => actions.setPriorityContestantId(null)}
        />
      </main>
    </div>
  );
}

export default App;
