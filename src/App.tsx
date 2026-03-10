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
  contestants,
  danmuTemplates,
  humanJudges,
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
  ContestantScorecard,
  SkillAxis,
  StageId,
  TeamSummary,
} from "./types";

type PresenceKind = "contestant" | "human" | "ai" | "guest";

type Presence = {
  id: string;
  name: string;
  subtitle: string;
  accent: string;
  avatar: string;
  kind: PresenceKind;
  status: string;
  activeLabel: string;
  x?: number;
  y?: number;
};

type FocusCard = {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  stats: Array<{ label: string; value: string }>;
  chips: string[];
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

const railItems = ["OC", "SR", "RM", "PK", "FX"];

const controlItems = [
  { label: "Mic", active: true },
  { label: "Cam", active: false },
  { label: "Chat", active: false },
  { label: "Pin", active: false },
  { label: "Hand", active: false },
];

const axisLabels: Record<SkillAxis, string> = {
  strategy: "策略",
  craft: "质感",
  story: "叙事",
  execution: "执行",
};

const contestantSpots = [
  { x: 47, y: 39 },
  { x: 52, y: 43 },
  { x: 57, y: 39 },
  { x: 61, y: 45 },
  { x: 49, y: 53 },
  { x: 56, y: 56 },
];

const humanSpots = [
  { x: 67, y: 38 },
  { x: 70, y: 54 },
  { x: 35, y: 54 },
];

const aiSpots = [
  { x: 40, y: 33 },
  { x: 64, y: 31 },
  { x: 73, y: 45 },
];

const guestSpots = [
  { x: 42, y: 46 },
  { x: 38, y: 50 },
  { x: 44, y: 60 },
  { x: 58, y: 49 },
  { x: 63, y: 39 },
  { x: 36, y: 60 },
  { x: 54, y: 62 },
  { x: 66, y: 58 },
  { x: 73, y: 61 },
  { x: 29, y: 47 },
  { x: 76, y: 41 },
  { x: 57, y: 30 },
];

const seatSpots = [
  { x: 43, y: 71 },
  { x: 47, y: 74 },
  { x: 51, y: 71 },
  { x: 55, y: 74 },
  { x: 59, y: 71 },
  { x: 63, y: 74 },
  { x: 67, y: 71 },
  { x: 71, y: 74 },
  { x: 46, y: 80 },
  { x: 52, y: 80 },
  { x: 58, y: 80 },
  { x: 64, y: 80 },
];

const guestAccentPalette = [
  "#f2b36d",
  "#86da91",
  "#83bfff",
  "#ef90b7",
  "#b6a0ff",
  "#77d8c8",
];

const humanAccentPalette = ["#f3b46c", "#f08f8f", "#ffe19a"];
const aiAccentPalette = ["#83deff", "#9facff", "#a0e57a"];

const buildPresenceId = (kind: PresenceKind, value: string) => `${kind}:${value}`;

const parsePresenceId = (value: string): [PresenceKind, string] => {
  const separator = value.indexOf(":");

  if (separator === -1) {
    return ["contestant", value];
  }

  return [value.slice(0, separator) as PresenceKind, value.slice(separator + 1)];
};

const buildAvatar = (value: string) => {
  const compact = value.replace(/\s+/g, "");

  if (compact.length >= 2) {
    return `${compact[0]}${compact[compact.length - 1]}`;
  }

  return compact.slice(0, 2).toUpperCase();
};

const buildEventStatus = (event?: AudienceInteraction) => {
  if (!event) {
    return "旁听中";
  }

  if (event.type === "bet") {
    return `押注 ${event.amount}`;
  }

  if (event.type === "like") {
    return "鼓掌";
  }

  if (event.type === "boo") {
    return "起哄";
  }

  return "弹幕";
};

const buildEventTone = (event: AudienceInteraction) => `activity-item--${event.type}`;

const buildToastCopy = (
  event: AudienceInteraction | undefined,
  contestantMap: Record<string, ContestantScorecard>,
) => {
  if (!event) {
    return "OpenClaw 房间正在等待下一条现场信号。";
  }

  const contestantName = contestantMap[event.contestantId]?.name ?? "未知选手";

  if (event.type === "bet") {
    return `${event.source} 给 ${contestantName} 追加了 ${event.amount} 点押注。`;
  }

  if (event.type === "like") {
    return `${event.source} 正在为 ${contestantName} 鼓掌。`;
  }

  if (event.type === "boo") {
    return `${event.source} 刚对 ${contestantName} 发出一阵起哄。`;
  }

  return `${contestantName} 又在房间里引爆了一条新弹幕。`;
};

const resolveTeamForContestant = (
  contestantId: string,
  teams: TeamSummary[],
  fallbackTeam: TeamSummary,
) =>
  teams.find((team) => team.members.some((member) => member.id === contestantId)) ?? fallbackTeam;

function App() {
  const [activeStageId, setActiveStageId] = useState<StageId>(stageDefinitions[0].id);
  const [selectedPresenceId, setSelectedPresenceId] = useState(
    buildPresenceId("contestant", contestants[0].id),
  );
  const [memberQuery, setMemberQuery] = useState("");
  const [interactions, setInteractions] =
    useState<AudienceInteraction[]>(seedAudienceInteractions);

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

  const fallbackTeam = teams[0];
  const leadingTeam = teamMap[audienceSummary.leadingTeamId] ?? fallbackTeam;
  const [selectedKind, selectedRef] = parsePresenceId(selectedPresenceId);
  const selectedContestant =
    selectedKind === "contestant" ? contestantMap[selectedRef] : undefined;
  const focusTeam = selectedContestant
    ? resolveTeamForContestant(selectedContestant.id, teams, leadingTeam)
    : leadingTeam;

  const guestRoster = useMemo(() => {
    const orderedSources = [...interactions].reverse().map((event) => event.source);
    const allSources = [...orderedSources, ...audienceHandles];
    const seen = new Set<string>();
    const uniqueSources: string[] = [];

    for (const source of allSources) {
      if (seen.has(source)) {
        continue;
      }

      seen.add(source);
      uniqueSources.push(source);

      if (uniqueSources.length >= guestSpots.length) {
        break;
      }
    }

    return uniqueSources.map((source, index) => {
      const latestEvent = [...interactions].reverse().find((event) => event.source === source);

      return {
        id: buildPresenceId("guest", source),
        name: source,
        subtitle: latestEvent?.content ?? "正在围观 OpenClaw 房间",
        accent: guestAccentPalette[index % guestAccentPalette.length],
        avatar: buildAvatar(source),
        kind: "guest" as const,
        status: buildEventStatus(latestEvent),
        activeLabel: "Guest",
      };
    });
  }, [interactions]);

  const focusedTeamIds = new Set((focusTeam?.members ?? []).map((member) => member.id));

  const contestantPresences = useMemo(() => {
    const ordered = [
      ...(focusTeam?.members ?? []),
      ...contestantDeck.filter((contestant) => !focusedTeamIds.has(contestant.id)),
    ];

    return ordered.slice(0, contestantSpots.length).map((contestant, index) => ({
      id: buildPresenceId("contestant", contestant.id),
      name: contestant.name,
      subtitle: contestant.title,
      accent: contestant.palette.primary,
      avatar: contestant.avatarGlyph,
      kind: "contestant" as const,
      status: `${contestant.supportScore} 支持 · ${contestant.heatScore} 热度`,
      activeLabel: focusedTeamIds.has(contestant.id) ? "Live" : "Online",
      x: contestantSpots[index]?.x ?? 48,
      y: contestantSpots[index]?.y ?? 48,
    }));
  }, [contestantDeck, focusTeam, focusedTeamIds]);

  const humanPresences = useMemo(
    () =>
      humanJudges.map((judge, index) => ({
        id: buildPresenceId("human", judge.id),
        name: judge.name,
        subtitle: judge.role,
        accent: humanAccentPalette[index % humanAccentPalette.length],
        avatar: buildAvatar(judge.name),
        kind: "human" as const,
        status: judge.catchphrase,
        activeLabel: "Judge",
        x: humanSpots[index]?.x ?? 70,
        y: humanSpots[index]?.y ?? 40,
      })),
    [],
  );

  const aiPresences = useMemo(
    () =>
      aiJudges.map((judge, index) => ({
        id: buildPresenceId("ai", judge.id),
        name: judge.name,
        subtitle: judge.title,
        accent: aiAccentPalette[index % aiAccentPalette.length],
        avatar: "AI",
        kind: "ai" as const,
        status: judge.signature,
        activeLabel: "AI",
        x: aiSpots[index]?.x ?? 62,
        y: aiSpots[index]?.y ?? 36,
      })),
    [],
  );

  const guestPresences = useMemo(
    () =>
      guestRoster.slice(0, guestSpots.length).map((guest, index) => ({
        ...guest,
        x: guestSpots[index]?.x ?? 50,
        y: guestSpots[index]?.y ?? 50,
      })),
    [guestRoster],
  );

  const roomPresences = useMemo(
    () => [...contestantPresences, ...humanPresences, ...aiPresences, ...guestPresences],
    [contestantPresences, humanPresences, aiPresences, guestPresences],
  );

  const sidebarPresences = useMemo(
    () => [...contestantPresences, ...humanPresences, ...aiPresences, ...guestRoster],
    [contestantPresences, humanPresences, aiPresences, guestRoster],
  );

  useEffect(() => {
    if (!sidebarPresences.some((presence) => presence.id === selectedPresenceId)) {
      setSelectedPresenceId(buildPresenceId("contestant", contestantDeck[0]?.id ?? contestants[0].id));
    }
  }, [contestantDeck, selectedPresenceId, sidebarPresences]);

  const speakerSeats = useMemo(() => {
    const seats: Presence[] = [];
    const pushSeat = (presence?: Presence, activeLabel?: string) => {
      if (!presence || seats.some((seat) => seat.id === presence.id)) {
        return;
      }

      seats.push({
        ...presence,
        activeLabel: activeLabel ?? presence.activeLabel,
      });
    };

    pushSeat(humanPresences[0], "Host");
    pushSeat(contestantPresences[0], "Main");
    pushSeat(contestantPresences[1], "Pair");
    pushSeat(contestantPresences[2], "Spot");
    pushSeat(humanPresences[1], "Critic");
    pushSeat(aiPresences[0], "AI");

    return seats.slice(0, 6);
  }, [humanPresences, contestantPresences, aiPresences]);

  const filteredPresences = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();

    if (!query) {
      return sidebarPresences;
    }

    return sidebarPresences.filter((presence) =>
      `${presence.name} ${presence.subtitle} ${presence.status}`.toLowerCase().includes(query),
    );
  }, [deferredQuery, sidebarPresences]);

  const latestFeed = [...interactions].slice(-4).reverse();
  const toastCopy = buildToastCopy(latestFeed[0], contestantMap);
  const countdownLabel = `${String(Math.floor(countdown / 60)).padStart(2, "0")}:${String(
    countdown % 60,
  ).padStart(2, "0")}`;
  const onlineCount = contestantDeck.length + humanJudges.length + aiJudges.length + guestRoster.length;

  const focusCard = useMemo<FocusCard>(() => {
    if (selectedKind === "contestant" && selectedContestant) {
      const wantedPartner = selectedContestant.preferences.want[0]?.contestantId;
      const partnerName = wantedPartner ? contestantMap[wantedPartner]?.name : undefined;

      return {
        badge: selectedContestant.title,
        title: selectedContestant.name,
        subtitle: `${selectedContestant.archetype} · ${focusTeam.name}`,
        description: selectedContestant.moodAfterAudience,
        stats: [
          { label: "支持值", value: formatter.format(selectedContestant.supportScore) },
          { label: "热度", value: formatter.format(selectedContestant.heatScore) },
          { label: "押注", value: formatter.format(selectedContestant.audienceBets) },
          { label: "弹幕", value: formatter.format(selectedContestant.danmuCount) },
        ],
        chips: [
          focusTeam.submission.headline,
          selectedContestant.strengths[0] ?? selectedContestant.specialties[0],
          partnerName ? `想组队 ${partnerName}` : selectedContestant.currentEmotion,
        ],
      };
    }

    if (selectedKind === "human") {
      const judge = humanJudges.find((item) => item.id === selectedRef) ?? humanJudges[0];
      const review =
        humanReviews.find(
          (item) => item.judgeId === judge.id && item.teamId === focusTeam.id,
        )?.summary ?? judge.catchphrase;

      return {
        badge: judge.role,
        title: judge.name,
        subtitle: `${focusTeam.name} 的人类观察视角`,
        description: review,
        stats: [
          { label: "当前房间", value: focusTeam.name },
          { label: "热度指数", value: formatter.format(Math.round(audienceSummary.heatIndex)) },
          { label: "押注总池", value: formatter.format(audienceSummary.totalBetPoints) },
          { label: "阶段", value: `Act ${activeStage.order}` },
        ],
        chips: [judge.style, activeStage.emphasis, focusTeam.submission.headline],
      };
    }

    if (selectedKind === "ai") {
      const judge = aiJudges.find((item) => item.id === selectedRef) ?? aiJudges[0];
      const review =
        aiResults.reviews.find(
          (item) => item.judgeId === judge.id && item.teamId === focusTeam.id,
        )?.reason ?? judge.signature;
      const summary =
        aiResults.summaries.find((item) => item.teamId === focusTeam.id)?.averageScore ?? 0;

      return {
        badge: judge.title,
        title: judge.name,
        subtitle: `${focusTeam.name} 的 AI 侧评价`,
        description: review,
        stats: [
          { label: "平均分", value: summary.toFixed(1) },
          { label: "偏好轴", value: axisLabels[judge.focus] },
          { label: "严苛度", value: `${Math.round(judge.severity * 100)}%` },
          { label: "怪味值", value: `${Math.round(judge.wit * 100)}%` },
        ],
        chips: [judge.persona, judge.signature, focusTeam.theme],
      };
    }

    const guest = guestRoster.find((item) => item.id === selectedPresenceId) ?? guestRoster[0];
    const latestEvent = [...interactions].reverse().find((event) => event.source === selectedRef);

    return {
      badge: "围观席",
      title: guest?.name ?? "Guest",
      subtitle: `${activeStage.title} 的现场旁听者`,
      description: latestEvent?.content ?? "正在房间里听 OpenClaw 的最新对话。",
      stats: [
        { label: "动作", value: latestEvent ? buildEventStatus(latestEvent) : "围观" },
        { label: "阶段", value: `Act ${activeStage.order}` },
        { label: "房间", value: focusTeam.name },
        { label: "计时", value: countdownLabel },
      ],
      chips: [activeStage.subtitle, focusTeam.submission.headline, "现场在线"],
    };
  }, [
    activeStage.order,
    activeStage.subtitle,
    aiResults.reviews,
    aiResults.summaries,
    audienceSummary.heatIndex,
    audienceSummary.totalBetPoints,
    contestantMap,
    countdownLabel,
    focusTeam,
    guestRoster,
    humanReviews,
    interactions,
    selectedContestant,
    selectedKind,
    selectedPresenceId,
    selectedRef,
  ]);

  const selectPresence = (presenceId: string) => {
    startTransition(() => {
      setSelectedPresenceId(presenceId);
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
    <div className="openclaw-app">
      <aside className="app-rail">
        <div className="rail-brand">OC</div>
        <div className="rail-actions">
          {railItems.map((item, index) => (
            <button
              className={`rail-button ${index === 2 ? "is-active" : ""}`}
              key={item}
              type="button"
            >
              {item}
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
              <span className="tiny-label">Program for OpenClaw</span>
              <h1>Hallway Conversation</h1>
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
        </div>

        <section className="hall-card">
          <div className="hall-card-head">
            <div>
              <span className="tiny-label">Live Scene</span>
              <strong>
                Act {activeStage.order} · {activeStage.title}
              </strong>
            </div>
            <b>{countdownLabel}</b>
          </div>
          <p>{activeStage.subtitle}</p>
          <div className="stat-strip">
            <div className="stat-pill">
              <span>Online</span>
              <strong>{formatter.format(onlineCount)}</strong>
            </div>
            <div className="stat-pill">
              <span>Pot</span>
              <strong>{formatter.format(audienceSummary.totalBetPoints)}</strong>
            </div>
            <div className="stat-pill">
              <span>Heat</span>
              <strong>{formatter.format(Math.round(audienceSummary.heatIndex))}</strong>
            </div>
          </div>
        </section>

        <section className="online-panel">
          <div className="online-head">
            <strong>在线成员</strong>
            <span>{focusTeam.name}</span>
          </div>

          <div className="member-list">
            {filteredPresences.map((presence) => (
              <button
                className={`member-row ${
                  selectedPresenceId === presence.id ? "is-selected" : ""
                }`}
                key={presence.id}
                onClick={() => selectPresence(presence.id)}
                type="button"
              >
                <span
                  className={`member-avatar member-avatar--${presence.kind}`}
                  style={{
                    background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.92), ${presence.accent})`,
                  }}
                >
                  {presence.avatar}
                </span>
                <span className="member-copy">
                  <strong>{presence.name}</strong>
                  <span>{presence.subtitle}</span>
                </span>
                <em className="member-badge">{presence.activeLabel}</em>
              </button>
            ))}

            {filteredPresences.length === 0 ? (
              <div className="empty-state">没有找到匹配成员。</div>
            ) : null}
          </div>
        </section>
      </aside>

      <main className="world-shell">
        <header className="speaker-dock">
          <div className="speaker-dock-head">
            <div>
              <span className="tiny-label">OpenClaw Live Program</span>
              <h2>
                {focusTeam.name} / {activeStage.title}
              </h2>
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

          <div className="speaker-row">
            {speakerSeats.map((seat) => (
              <button
                className={`speaker-seat ${selectedPresenceId === seat.id ? "is-selected" : ""}`}
                key={seat.id}
                onClick={() => selectPresence(seat.id)}
                type="button"
              >
                <span className="seat-corner">{seat.activeLabel}</span>
                <span
                  className="seat-token"
                  style={{
                    background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.92), ${seat.accent})`,
                  }}
                >
                  {seat.avatar}
                </span>
                <span className="seat-copy">
                  <strong>{seat.name}</strong>
                  <span>{seat.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        </header>

        <section className="world-stage">
          <div className="stage-glow" />
          <div className="room-floor" />

          <article className="scene-card stage-card">
            <span className="tiny-label">Scene {activeStage.order}</span>
            <strong>{activeStage.title}</strong>
            <p>{activeStage.objective}</p>
            <div className="tag-row">
              {activeStage.deliverables.slice(0, 3).map((deliverable) => (
                <span className="tag" key={deliverable}>
                  {deliverable}
                </span>
              ))}
            </div>
          </article>

          <article className="scene-card focus-card">
            <span className="tiny-label">{focusCard.badge}</span>
            <strong>{focusCard.title}</strong>
            <p className="focus-subtitle">{focusCard.subtitle}</p>
            <p>{focusCard.description}</p>

            <div className="focus-stats">
              {focusCard.stats.map((stat) => (
                <div className="focus-metric" key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>

            <div className="tag-row compact">
              {focusCard.chips.map((chip) => (
                <span className="tag" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
          </article>

          <article className="scene-card activity-card">
            <span className="tiny-label">Room Signals</span>
            <strong>{focusTeam.submission.headline}</strong>
            <div className="activity-list">
              {latestFeed.map((event) => {
                const contestantName = contestantMap[event.contestantId]?.name ?? "未知选手";

                return (
                  <div className={`activity-item ${buildEventTone(event)}`} key={event.id}>
                    <div className="activity-item-head">
                      <strong>{contestantName}</strong>
                      <span>{event.timestampLabel}</span>
                    </div>
                    <p>{event.content}</p>
                  </div>
                );
              })}
            </div>
          </article>

          <div className="room-props">
            <div className="scene-prop prop-bike" />
            <div className="scene-prop prop-workbench" />
            <div className="scene-prop prop-board" />
            <div className="scene-prop prop-easel" />
            <div className="scene-prop prop-cabinet" />
            <div className="scene-prop prop-plant-a" />
            <div className="scene-prop prop-plant-b" />
            <div className="scene-prop prop-plant-c" />
            <div className="scene-prop prop-bench-left" />
            <div className="scene-prop prop-bench-right" />
            <div className="scene-prop prop-console" />
          </div>

          <div className="seat-cloud">
            {seatSpots.map((spot, index) => (
              <span
                className={`room-seat room-seat--${index % 3}`}
                key={`${spot.x}-${spot.y}`}
                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              />
            ))}
          </div>

          {roomPresences.map((presence) => (
            <button
              className={`room-presence room-presence--${presence.kind} ${
                selectedPresenceId === presence.id ? "is-selected" : ""
              }`}
              key={presence.id}
              onClick={() => selectPresence(presence.id)}
              style={{
                left: `${presence.x}%`,
                top: `${presence.y}%`,
                zIndex: Math.round(presence.y ?? 0),
              }}
              type="button"
            >
              <span className="presence-shadow" />
              <span
                className="presence-token"
                style={{
                  background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.92), ${presence.accent})`,
                }}
              >
                {presence.avatar}
              </span>
              <span className="presence-label">
                <i />
                {presence.name}
                <em>{presence.activeLabel}</em>
              </span>
            </button>
          ))}

          <div className="mini-map">
            <span className="tiny-label">Mini Map</span>
            <div className="mini-map-floor">
              {roomPresences.map((presence) => (
                <span
                  className={`mini-map-dot ${
                    selectedPresenceId === presence.id ? "mini-map-focus" : ""
                  }`}
                  key={`map-${presence.id}`}
                  style={{
                    background: presence.accent,
                    left: `${presence.x}%`,
                    top: `${presence.y}%`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="scene-toast">{toastCopy}</div>

          <div className="control-dock">
            {controlItems.map((item) => (
              <button
                className={`control-button ${item.active ? "is-active" : ""}`}
                key={item.label}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="utility-rail">
            <button className="utility-button" type="button">
              Fit
            </button>
            <button className="utility-button" type="button">
              Grid
            </button>
            <button className="utility-button" type="button">
              Team
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
