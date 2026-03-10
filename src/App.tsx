import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  aiJudges,
  audienceHandles,
  contestantOpenClawPresences,
  contestants,
  danmuTemplates,
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
import type {
  AudienceInteraction,
  ContestantOpenClawPresence,
  ContestantScorecard,
  OpenClawContestantState,
  StageId,
  TeamSummary,
} from "./types";

type SelectionKind = "contestant" | "judge" | "ai" | "listener";
type AudioMode = "nearby" | "focus" | "muted";

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
  const [interactions, setInteractions] =
    useState<AudienceInteraction[]>(seedAudienceInteractions);
  const [audioMode, setAudioMode] = useState<AudioMode>("nearby");
  const [simplifiedView, setSimplifiedView] = useState(false);
  const [priorityContestantId, setPriorityContestantId] = useState<string | null>(null);

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setInteractions((current) => {
        const contestant = contestants[current.length % contestants.length];
        const template = danmuTemplates[current.length % danmuTemplates.length];
        const cycle = current.length % 6;
        const type =
          cycle === 0
            ? "bet"
            : cycle === 1
              ? "like"
              : cycle === 2
                ? "danmaku"
                : cycle === 3
                  ? "like"
                  : cycle === 4
                    ? "boo"
                    : "danmaku";
        const amount = type === "bet" ? 8 + ((current.length * 3) % 19) : 1;

        return [
          ...current,
          {
            id: `evt-live-${current.length + 1}`,
            contestantId: contestant.id,
            type,
            source: audienceHandles[current.length % audienceHandles.length],
            content:
              type === "bet"
                ? `${contestant.name} 又被房间追加了 ${amount} 点押注。`
                : template.replace("{name}", contestant.name),
            amount,
            timestampLabel: `20:${String(13 + ((current.length + 1) % 45)).padStart(2, "0")}`,
          },
        ];
      });
    }, 7000);

    return () => window.clearInterval(timer);
  }, []);

  const contestantDeck = useMemo(
    () => buildContestantDeck(contestants, interactions),
    [interactions],
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
    () => buildAudienceSummary(contestantDeck, interactions, teams),
    [contestantDeck, interactions, teams],
  );

  const humanReviews = useMemo(() => buildHumanReviews(teams, humanJudges), [teams]);
  const aiResults = useMemo(() => buildAiReviewSummary(teams, aiJudges), [teams]);

  const [selectedKind, selectedRef] = parseSelectionId(selectedEntityId);
  const fallbackTeam = teams[0]!;
  const leadingTeam = teamMap[audienceSummary.leadingTeamId] ?? fallbackTeam;
  const selectedContestant =
    selectedKind === "contestant" ? contestantMap[selectedRef] : undefined;
  const focusTeam = selectedContestant
    ? resolveTeamForContestant(selectedContestant.id, teams, leadingTeam)
    : leadingTeam;

  const stageConversation = useMemo(() => {
    const orderedIds = contestantDeck.map((contestant) => contestant.id);
    const focusIds = focusTeam.members.map((member) => member.id);
    const outsideFocusIds = orderedIds.filter((id) => !focusIds.includes(id));
    const championTeam =
      teams.find((team) => team.id === aiResults.summaries[0]?.teamId) ?? leadingTeam;
    const championIds = championTeam.members.map((member) => member.id);
    const defaultSpeakerId = focusIds[0] ?? orderedIds[0] ?? contestants[0].id;
    const leadingId = audienceSummary.leadingContestantId || orderedIds[0] || contestants[0].id;

    const baseConversation = (() => {
      switch (activeStage.id) {
      case "act-1":
        return {
          speakerId: orderedIds[0] ?? defaultSpeakerId,
          raisedHandId: orderedIds[1] ?? defaultSpeakerId,
          listeningIds: orderedIds.slice(0, 3),
          queuedIds: orderedIds.slice(3, 5),
          callout: `${activeStage.title} 正在建人设，${contestantMap[orderedIds[0] ?? defaultSpeakerId]?.name ?? "当前选手"} 先把主麦拿走了。`,
        };
      case "act-2":
        return {
          speakerId: selectedContestant?.id ?? defaultSpeakerId,
          raisedHandId: outsideFocusIds[0] ?? orderedIds[1] ?? defaultSpeakerId,
          listeningIds: [...focusIds, orderedIds[2]].filter(Boolean).slice(0, 3),
          queuedIds: outsideFocusIds.slice(0, 2),
          callout: `${activeStage.title} 把偏好和嫌弃都摊开了，房间里开始有人抢着举手回应。`,
        };
      case "act-3":
        return {
          speakerId: focusIds[0] ?? defaultSpeakerId,
          raisedHandId: focusIds[1] ?? outsideFocusIds[0] ?? defaultSpeakerId,
          listeningIds: focusIds,
          queuedIds: outsideFocusIds.slice(0, 1),
          callout: `${focusTeam.name} 正在被推到 conversation ring 中央，其他选手在外圈等候下一轮分组。`,
        };
      case "act-4":
        return {
          speakerId: focusIds[1] ?? focusIds[0] ?? defaultSpeakerId,
          raisedHandId: focusIds[0] ?? outsideFocusIds[0] ?? defaultSpeakerId,
          listeningIds: focusIds,
          queuedIds: outsideFocusIds.slice(0, 2),
          callout: `${focusTeam.name} 的队内讨论已经热起来了，主麦在成员之间快速切换。`,
        };
      case "act-5":
        return {
          speakerId: focusIds[0] ?? defaultSpeakerId,
          raisedHandId: focusIds[1] ?? outsideFocusIds[0] ?? defaultSpeakerId,
          listeningIds: focusIds,
          queuedIds: focusIds.slice(2, 3),
          callout: `${focusTeam.submission.headline} 正在收束成可展示版本，队伍成员轮流补充最终卖点。`,
        };
      case "act-6":
        return {
          speakerId: focusIds[0] ?? defaultSpeakerId,
          raisedHandId: leadingId,
          listeningIds: focusIds,
          queuedIds: outsideFocusIds.slice(0, 1),
          callout: `人类评审正在外圈围观，${contestantMap[focusIds[0] ?? defaultSpeakerId]?.name ?? "队长"} 继续守着主麦解释方案。`,
        };
      case "act-7":
        return {
          speakerId: focusIds[0] ?? defaultSpeakerId,
          raisedHandId: championIds[1] ?? leadingId,
          listeningIds: [...new Set([...focusIds, ...championIds])].slice(0, 4),
          queuedIds: outsideFocusIds.slice(0, 1),
          callout: `AI 评审接管节奏，冠军候选队开始在房间中央反复被点名。`,
        };
      case "act-8":
        return {
          speakerId: championIds[0] ?? defaultSpeakerId,
          raisedHandId: championIds[1] ?? focusIds[1] ?? defaultSpeakerId,
          listeningIds: championIds,
          queuedIds: [leadingId].filter((id) => !championIds.includes(id)),
          callout: `${championTeam.name} 正站在聚光区，其他选手在外圈等着奖项和人格标签落地。`,
        };
      case "act-9":
        return {
          speakerId: leadingId,
          raisedHandId: orderedIds[1] ?? defaultSpeakerId,
          listeningIds: orderedIds.slice(0, 4),
          queuedIds: orderedIds.slice(4, 6),
          callout: `赛后诗和像素画接管了空间，房间不再争主麦，而是在轮流放大情绪。`,
        };
      case "act-10":
        return {
          speakerId: outsideFocusIds[0] ?? leadingId,
          raisedHandId: focusIds[0] ?? defaultSpeakerId,
          listeningIds: [...focusIds, leadingId].filter(Boolean).slice(0, 4),
          queuedIds: outsideFocusIds.slice(1, 3),
          callout: `开放麦阶段让 conversation 重新散开，主麦开始在房间和看台之间游走。`,
        };
      default:
        return {
          speakerId: defaultSpeakerId,
          raisedHandId: focusIds[1] ?? leadingId,
          listeningIds: focusIds,
          queuedIds: outsideFocusIds.slice(0, 1),
          callout: openClawConversation.nearbyHint,
        };
      }
    })();

    if (priorityContestantId && priorityContestantId !== baseConversation.speakerId) {
      return {
        ...baseConversation,
        raisedHandId: priorityContestantId,
        queuedIds: [
          priorityContestantId,
          ...baseConversation.queuedIds.filter((id) => id !== priorityContestantId),
        ],
        callout: `${contestantMap[priorityContestantId]?.name ?? "选手"} 被 wave over 到当前 conversation，房间正在为她/他留出切入点。`,
      };
    }

    return baseConversation;
  }, [
    activeStage.id,
    activeStage.title,
    aiResults.summaries,
    audienceSummary.leadingContestantId,
    contestantDeck,
    contestantMap,
    focusTeam,
    leadingTeam,
    priorityContestantId,
    selectedContestant,
    teams,
  ]);

  const activeSpeakerId = stageConversation.speakerId;
  const raisedHandId = stageConversation.raisedHandId;
  const focusMemberIds = new Set(
    [stageConversation.speakerId, stageConversation.raisedHandId, ...stageConversation.listeningIds].filter(
      Boolean,
    ),
  );
  const queuedIds = new Set(stageConversation.queuedIds.filter(Boolean));

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

        let state: OpenClawContestantState = "muted";
        if (contestant.id === activeSpeakerId) {
          state = "speaking";
        } else if (contestant.id === raisedHandId) {
          state = "raised-hand";
        } else if (focusMemberIds.has(contestant.id)) {
          state = "listening";
        } else if (queuedIds.has(contestant.id)) {
          state = "queued";
        }

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
      activeSpeakerId,
      activeStage.title,
      contestantDeck,
      focusMemberIds,
      focusTeam,
      presenceMap,
      queuedIds,
      raisedHandId,
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

  const roomSignals = useMemo(() => {
    const scoped = [...interactions]
      .filter((event) => focusMemberIds.has(event.contestantId) || queuedIds.has(event.contestantId))
      .slice(-4)
      .reverse();

    return scoped.length > 0 ? scoped : [...interactions].slice(-4).reverse();
  }, [focusMemberIds, interactions, queuedIds]);
  const audibleSignals = useMemo(() => {
    if (audioMode === "muted") {
      return [];
    }

    if (audioMode === "focus") {
      const focused = roomSignals.filter((event) => event.contestantId === activeSpeakerId);
      return focused.length > 0 ? focused : roomSignals.slice(0, 2);
    }

    return roomSignals;
  }, [activeSpeakerId, audioMode, roomSignals]);
  const activeSeat = openClawSeats.find((seat) => seat.id === activeSpeakerId) ?? openClawSeats[0];
  const queuedSeat = openClawSeats.find((seat) => seat.id === raisedHandId);
  const countdownLabel = `${String(Math.floor(countdown / 60)).padStart(2, "0")}:${String(
    countdown % 60,
  ).padStart(2, "0")}`;
  const onlineCount = openClawSeats.length + listenerEntities.length;
  const micCount = openClawSeats.filter(
    (seat) => seat.state === "speaking" || seat.state === "listening",
  ).length;
  const queueCount = openClawSeats.filter(
    (seat) => seat.state === "raised-hand" || seat.state === "queued",
  ).length;

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
          { id: "focus-audio", label: "Focus audio", active: audioMode === "focus" },
          { id: "toggle-view", label: "Simplify view", active: simplifiedView },
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
        actions: [
          { id: "nearby-audio", label: "Hear nearby", active: audioMode === "nearby" },
          { id: "toggle-view", label: "Simplify view", active: simplifiedView },
        ],
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
        actions: [
          { id: "mute-audio", label: "Mute all", active: audioMode === "muted" },
          { id: "toggle-view", label: "Simplify view", active: simplifiedView },
        ],
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
      actions: [
        { id: "nearby-audio", label: "Hear nearby", active: audioMode === "nearby" },
        { id: "toggle-view", label: "Simplify view", active: simplifiedView },
      ],
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

  const roomCallout = activeSeat
    ? `${stageConversation.callout} ${
        queuedSeat ? `${queuedSeat.name} 也在边上举手等待切入。` : openClawConversation.nearbyHint
      } ${audioMode === "muted" ? "你当前听不到房间声音。" : audioMode === "focus" ? "你当前只听主麦。" : "你当前会听到附近对话。"}`
    : openClawConversation.nearbyHint;

  const handleDetailAction = (actionId: string) => {
    if (actionId === "wave-over" && selectedKind === "contestant") {
      setPriorityContestantId((current) => (current === selectedRef ? null : selectedRef));
      return;
    }

    if (actionId === "focus-audio") {
      setAudioMode("focus");
      return;
    }

    if (actionId === "nearby-audio") {
      setAudioMode("nearby");
      return;
    }

    if (actionId === "mute-audio") {
      setAudioMode("muted");
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

      <aside className="member-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="brand-icon">OC</div>
            <div>
              <span className="tiny-label">{openClawConversation.subtitle}</span>
              <h1>{openClawConversation.title}</h1>
              <p>{openClawConversation.hostLabel}</p>
            </div>
          </div>

          <label className="search-box">
            <input
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="Search people"
              type="search"
              value={memberQuery}
            />
            <span>Ctrl K</span>
          </label>

          <section className="hall-card">
            <div className="hall-card-head">
              <div>
                <span className="tiny-label">Live scene</span>
                <strong>
                  Act {activeStage.order} · {activeStage.title}
                </strong>
              </div>
              <b>{countdownLabel}</b>
            </div>
            <p>{activeStage.subtitle}</p>
            <div className="stat-strip">
              <div className="stat-pill">
                <span>On mic</span>
                <strong>{formatter.format(micCount)}</strong>
              </div>
              <div className="stat-pill">
                <span>Queue</span>
                <strong>{formatter.format(queueCount)}</strong>
              </div>
              <div className="stat-pill">
                <span>Nearby</span>
                <strong>{formatter.format(listenerEntities.length)}</strong>
              </div>
              <div className="stat-pill">
                <span>Heat</span>
                <strong>{formatter.format(Math.round(audienceSummary.heatIndex))}</strong>
              </div>
            </div>
          </section>
        </div>

        <div className="sidebar-scroll">
          <section className="presence-section">
            <div className="section-head">
              <strong>OpenClaw contestants</strong>
              <span>{filteredContestants.length}</span>
            </div>

            {[
              { label: "On mic", items: contestantGroups.onMic },
              { label: "Queue rail", items: contestantGroups.queue },
              { label: "Listener orbit", items: contestantGroups.orbit },
            ].map((group) =>
              group.items.length > 0 ? (
                <div className="member-group" key={group.label}>
                  <div className="member-group-head">
                    <strong>{group.label}</strong>
                    <span>{group.items.length}</span>
                  </div>

                  <div className="member-list">
                    {group.items.map((entity) => (
                      <button
                        className={`member-row ${
                          selectedEntityId === entity.selectionId ? "is-selected" : ""
                        }`}
                        key={entity.selectionId}
                        onClick={() => selectEntity(entity.selectionId)}
                        type="button"
                      >
                        <span className="member-dot" style={{ background: entity.accent }} />
                        <span
                          className="member-avatar member-avatar--contestant"
                          style={{
                            background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.92), ${entity.accent})`,
                          }}
                        >
                          {entity.avatar}
                        </span>
                        <span className="member-copy">
                          <strong>{entity.name}</strong>
                          <span>{entity.subtitle}</span>
                          <small>{entity.status}</small>
                        </span>
                        <em className="member-badge">{entity.badge}</em>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </section>

          <section className="presence-section is-secondary">
            <div className="section-head">
              <strong>Nearby listeners</strong>
              <span>{filteredListeners.length}</span>
            </div>

            {[
              { label: "Observers", items: listenerGroups.observers },
              { label: "Nearby listeners", items: listenerGroups.nearby },
            ].map((group) =>
              group.items.length > 0 ? (
                <div className="member-group" key={group.label}>
                  <div className="member-group-head">
                    <strong>{group.label}</strong>
                    <span>{group.items.length}</span>
                  </div>

                  <div className="member-list">
                    {group.items.map((entity) => (
                      <button
                        className={`member-row member-row--listener ${
                          selectedEntityId === entity.selectionId ? "is-selected" : ""
                        }`}
                        key={entity.selectionId}
                        onClick={() => selectEntity(entity.selectionId)}
                        type="button"
                      >
                        <span className="member-dot" style={{ background: entity.accent }} />
                        <span
                          className={`member-avatar member-avatar--${entity.kind}`}
                          style={{
                            background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.94), ${entity.accent})`,
                          }}
                        >
                          {entity.avatar}
                        </span>
                        <span className="member-copy">
                          <strong>{entity.name}</strong>
                          <span>{entity.subtitle}</span>
                          <small>{entity.status}</small>
                        </span>
                        <em className="member-badge">{entity.badge}</em>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </section>

          <article className="detail-card">
            <span className="tiny-label">{detailCard.badge}</span>
            <strong>{detailCard.title}</strong>
            <p className="detail-subtitle">{detailCard.subtitle}</p>
            <p className="detail-description">{detailCard.description}</p>

            <div className="detail-stats">
              {detailCard.stats.map((stat) => (
                <div className="detail-stat" key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>

            <div className="chip-row">
              {detailCard.chips.map((chip) => (
                <span className="chip" key={chip}>
                  {chip}
                </span>
              ))}
            </div>

            {detailCard.actions && detailCard.actions.length > 0 ? (
              <div className="detail-actions">
                {detailCard.actions.map((action) => (
                  <button
                    className={`detail-action ${action.active ? "is-active" : ""}`}
                    disabled={action.disabled}
                    key={action.id}
                    onClick={() => handleDetailAction(action.id)}
                    type="button"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        </div>
      </aside>

      <main className="world-shell">
        <header className="speaker-dock">
          <div className="speaker-dock-head">
            <div>
              <span className="tiny-label">{openClawConversation.roomLabel}</span>
              <h2>{focusTeam.submission.headline}</h2>
              <p>{openClawConversation.nearbyHint}</p>
            </div>

            <div className="dock-actions">
            <div className="dock-pills">
              <span className="summary-pill">{`Act ${activeStage.order}`}</span>
              <span className="summary-pill is-accent">{focusTeam.name}</span>
              <span className="summary-pill">{`Audio ${audioMode}`}</span>
              <span className={`summary-pill ${simplifiedView ? "is-accent" : ""}`}>
                {simplifiedView ? "Simple view" : "Rich view"}
              </span>
              <span className="summary-pill">{`${onlineCount} online`}</span>
            </div>
              <div className="stage-switcher">
                <button onClick={() => moveStage(-1)} type="button">
                  Prev
                </button>
                <button onClick={() => moveStage(1)} type="button">
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="speaker-row">
            {speakerSeats.map((seat) => (
              <button
                className={`speaker-seat is-${seat.state} ${
                  selectedEntityId === seat.selectionId ? "is-selected" : ""
                }`}
                key={seat.selectionId}
                onClick={() => selectEntity(seat.selectionId)}
                type="button"
              >
                <div className="speaker-seat-head">
                  <span className="seat-corner">{seat.seatLabel}</span>
                  <span className="seat-state">{seat.stateLabel}</span>
                </div>

                <span
                  className="seat-token"
                  style={{
                    background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.94), ${seat.palette.primary})`,
                  }}
                >
                  {seat.avatarGlyph}
                </span>

                <span className="seat-copy">
                  <strong>{seat.name}</strong>
                  <span>{seat.title}</span>
                </span>

                <span className="seat-meter">
                  <i style={{ width: `${seat.meter}%` }} />
                  <b>{seat.teamName}</b>
                </span>
              </button>
            ))}
          </div>
        </header>

        <section className="world-stage">
          <div className="stage-glow" />
          <div className="room-floor" />
          <div className="conversation-ring" />

          <article className="scene-note">
            <span className="tiny-label">{openClawConversation.title}</span>
            <strong>{activeStage.title}</strong>
            <p>{activeStage.objective}</p>
            <div className="chip-row compact">
              {activeStage.deliverables.slice(0, 3).map((deliverable) => (
                <span className="chip" key={deliverable}>
                  {deliverable}
                </span>
              ))}
            </div>
          </article>

          <article className="signal-card">
            <span className="tiny-label">Room signals</span>
            <strong>{focusTeam.name}</strong>
            <div className="signal-list">
              {audibleSignals.length > 0 ? (
                audibleSignals.map((event) => {
                  const contestantName = contestantMap[event.contestantId]?.name ?? "未知选手";

                  return (
                    <div className={`signal-item signal-item--${event.type}`} key={event.id}>
                      <div className="signal-item-head">
                        <strong>{contestantName}</strong>
                        <span>{event.timestampLabel}</span>
                      </div>
                      <p>{event.content}</p>
                    </div>
                  );
                })
              ) : (
                <div className="signal-empty">Muted mode is on. No nearby room audio.</div>
              )}
            </div>
          </article>

          <div className="room-banner">
            <div>
              <span className="tiny-label">{openClawConversation.subtitle}</span>
              <strong>{openClawConversation.title}</strong>
              <p>{openClawConversation.hostLabel}</p>
            </div>
            <div className="banner-pills">
              <span>{focusTeam.name}</span>
              <span>{focusTeam.theme}</span>
            </div>
          </div>

          <div className="zone-legend">
            <span className="zone-pill zone-pill--mic">Mic lane</span>
            <span className="zone-pill zone-pill--queue">Queue rail</span>
            <span className="zone-pill zone-pill--nearby">Listener orbit</span>
          </div>

          <div className="room-prop room-prop--board" />
          <div className="room-prop room-prop--console" />
          <div className="room-prop room-prop--bench-left" />
          <div className="room-prop room-prop--bench-right" />
          <div className="room-prop room-prop--plant-a" />
          <div className="room-prop room-prop--plant-b" />

          {listenerEntities
            .filter((entity) => entity.x !== undefined && entity.y !== undefined)
            .map((entity) => (
              <button
                className={`room-presence room-presence--listener room-presence--${entity.kind} ${
                  selectedEntityId === entity.selectionId ? "is-selected" : ""
                }`}
                key={entity.selectionId}
                onClick={() => selectEntity(entity.selectionId)}
                style={{
                  left: `${entity.x}%`,
                  top: `${entity.y}%`,
                  zIndex: Math.round(entity.y ?? 0),
                }}
                type="button"
              >
                <span className="presence-shadow" />
                <span
                  className="presence-token"
                  style={{
                    background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.94), ${entity.accent})`,
                  }}
                >
                  {entity.avatar}
                </span>
                <span className="presence-label">
                  <i />
                  {entity.name}
                  <em>{entity.badge}</em>
                </span>
              </button>
            ))}

          {openClawSeats.map((seat) => (
            <button
              className={`room-presence room-presence--contestant is-${seat.state} ${
                selectedEntityId === seat.selectionId ? "is-selected" : ""
              }`}
              key={seat.selectionId}
              onClick={() => selectEntity(seat.selectionId)}
              style={{
                left: `${seat.roomX}%`,
                top: `${seat.roomY}%`,
                zIndex: 200 + Math.round(seat.roomY),
              }}
              type="button"
            >
              <span className="presence-shadow" />
              <span
                className="presence-token"
                style={{
                  background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.94), ${seat.palette.primary})`,
                }}
              >
                {seat.avatarGlyph}
              </span>
              <span className="presence-callout">{seat.seatLabel}</span>
              <span className="presence-label">
                <i />
                {seat.name}
                <em>{seat.stateLabel}</em>
              </span>
            </button>
          ))}

          <div className="mini-map">
            <span className="tiny-label">Mini map</span>
            <div className="mini-map-floor">
              {listenerEntities
                .filter((entity) => entity.x !== undefined && entity.y !== undefined)
                .map((entity) => (
                  <span
                    className={`mini-map-dot ${
                      selectedEntityId === entity.selectionId ? "mini-map-focus" : ""
                    }`}
                    key={`map-${entity.selectionId}`}
                    style={{
                      background: miniLegend[entity.kind],
                      left: `${entity.x}%`,
                      top: `${entity.y}%`,
                    }}
                  />
                ))}
              {openClawSeats.map((seat) => (
                <span
                  className={`mini-map-dot ${
                    selectedEntityId === seat.selectionId ? "mini-map-focus" : ""
                  }`}
                  key={`map-${seat.selectionId}`}
                  style={{
                    background: miniLegend.contestant,
                    left: `${seat.roomX}%`,
                    top: `${seat.roomY}%`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="scene-toast">{roomCallout}</div>

          <div className="control-dock">
            <button
              className={`control-button ${audioMode === "nearby" ? "is-active" : ""}`}
              onClick={() => setAudioMode("nearby")}
              type="button"
            >
              Nearby
            </button>
            <button
              className={`control-button ${audioMode === "focus" ? "is-active" : ""}`}
              onClick={() => setAudioMode("focus")}
              type="button"
            >
              Focus
            </button>
            <button
              className={`control-button ${audioMode === "muted" ? "is-active" : ""}`}
              onClick={() => setAudioMode("muted")}
              type="button"
            >
              Mute
            </button>
            <button
              className={`control-button ${simplifiedView ? "is-active" : ""}`}
              onClick={() => setSimplifiedView((current) => !current)}
              type="button"
            >
              Simple
            </button>
            <button
              className={`control-button ${priorityContestantId ? "is-active" : ""}`}
              onClick={() => setPriorityContestantId(null)}
              type="button"
            >
              Clear Wave
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
