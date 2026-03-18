import {
  buildFocusRooms,
  buildRoomHeatSummaries,
  buildShowAudienceComposition,
  buildShowEmptyState,
  buildShowEvents,
  buildShowStateCopy,
  rankContestants,
} from "../presentation";
import type { GatewayOverview, StageDefinition, StageRuntimeGuide } from "../types";

interface ShowModeProps {
  stage: StageDefinition;
  stages: StageDefinition[];
  runtimeGuide: StageRuntimeGuide;
  gateway: GatewayOverview;
}

const toneClasses = {
  critical: "border-rose-400/35 bg-rose-500/12 text-rose-100",
  active: "border-amber-400/35 bg-amber-500/12 text-amber-100",
  warm: "border-emerald-400/35 bg-emerald-500/12 text-emerald-100",
  idle: "border-slate-400/20 bg-white/6 text-slate-200",
};

export function ShowMode({
  stage,
  stages,
  runtimeGuide,
  gateway,
}: ShowModeProps) {
  const contestants = rankContestants(gateway, runtimeGuide);
  const worldAgentIds = new Set(
    gateway.world.entities
      .filter((entity) => entity.kind === "agent")
      .map((entity) => entity.entityId),
  );
  const stageContestants =
    worldAgentIds.size > 0
      ? contestants.filter((contestant) => worldAgentIds.has(contestant.agentId))
      : contestants;
  const focusContestant = stageContestants[0] ?? null;
  const focusRooms = buildFocusRooms(runtimeGuide, gateway);
  const roomHeat = buildRoomHeatSummaries(gateway, runtimeGuide);
  const roomHeatById = new Map(roomHeat.map((room) => [room.roomId, room]));
  const hottestRoom = roomHeat[0] ?? null;
  const emptyState = buildShowEmptyState(gateway, stage);
  const showState = buildShowStateCopy(focusContestant, stage, runtimeGuide);
  const audience = buildShowAudienceComposition({
    gateway,
    stage,
    runtimeGuide,
  });
  const primaryTeamSpotlight = audience.teamRoomSpotlights[0] ?? null;
  const primaryRoomNarrative = audience.roomNarratives[0] ?? null;
  const primaryFallback = audience.softFallbacks[0] ?? null;
  const stageIndex = stages.findIndex((item) => item.id === stage.id);
  const livePulse = Math.min(
    99,
    (hottestRoom?.heatScore ?? 0) +
      gateway.activities.length * 3 +
      gateway.totalActiveSessions * 2,
  );
  const isScoreStage = stage.presentation.deskMode === "score";
  const stageDeskLabel = isScoreStage ? "Judge Board" : "Submission Desk";
  const stageDeskValue = isScoreStage
    ? audience.score.leaderLabel ?? "待亮分"
    : audience.submission.progressLabel;
  const spotlightTitle =
    focusContestant?.agentId ??
    primaryTeamSpotlight?.teamLabel ??
    primaryFallback?.title ??
    emptyState.title;
  const spotlightEyebrow = focusContestant
    ? `${showState.label} · ${showState.action}`
    : primaryTeamSpotlight?.headline ??
      primaryRoomNarrative?.headline ??
      primaryFallback?.title ??
      emptyState.eyebrow;
  const spotlightBody = focusContestant
    ? [showState.note, primaryTeamSpotlight?.detail]
        .filter((value): value is string => Boolean(value))
        .join(" ")
    : primaryTeamSpotlight?.detail ??
      primaryRoomNarrative?.detail ??
      primaryFallback?.body ??
      emptyState.body;
  const spotlightLine =
    focusContestant?.recentActivity?.content ??
    gateway.activities[0]?.content ??
    primaryTeamSpotlight?.headline ??
    primaryRoomNarrative?.headline ??
    primaryFallback?.body ??
    emptyState.body;
  const fallbackCards =
    audience.softFallbacks.length > 0
      ? audience.softFallbacks
      : [
          {
            title: emptyState.title,
            body: emptyState.body,
          },
          {
            title: runtimeGuide.successSignal,
            body:
              stage.humanActions[0] ??
              "全场都在等第一句能被截进海报和预告片的话。",
          },
        ];
  const platformBeatTimestamp =
    audience.platformCue.timestampLabel ??
    gateway.activeTimer?.remainingLabel ??
    "Live";
  const showEvents = [
    primaryTeamSpotlight
      ? {
          id: `team-spotlight-${primaryTeamSpotlight.id}`,
          eyebrow: "Team Spotlight",
          headline: primaryTeamSpotlight.headline,
          body: primaryTeamSpotlight.detail,
          roomLabel: primaryTeamSpotlight.roomLabel ?? "show-floor",
          timestampLabel: platformBeatTimestamp,
          tone: primaryTeamSpotlight.tone,
        }
      : null,
    primaryRoomNarrative
      ? {
          id: `room-story-${primaryRoomNarrative.roomId}`,
          eyebrow: "Room Story",
          headline: primaryRoomNarrative.headline,
          body: primaryRoomNarrative.detail,
          roomLabel: primaryRoomNarrative.roomLabel,
          timestampLabel: platformBeatTimestamp,
          tone: primaryRoomNarrative.tone,
        }
      : null,
    {
      id: `stage-desk-${stage.id}`,
      eyebrow: stageDeskLabel,
      headline: isScoreStage
        ? audience.score.headline
        : audience.submission.headline,
      body: isScoreStage ? audience.score.detail : audience.submission.detail,
      roomLabel: stageDeskValue,
      timestampLabel: platformBeatTimestamp,
      tone: isScoreStage ? audience.score.tone : audience.submission.tone,
    },
    {
      id: `platform-cue-${stage.id}`,
      eyebrow: "Platform Cue",
      headline: audience.platformCue.headline,
      body: audience.platformCue.detail,
      roomLabel: audience.authorityStageId ?? stage.id,
      timestampLabel: platformBeatTimestamp,
      tone: audience.platformCue.tone,
    },
    ...buildShowEvents(gateway, stageContestants, runtimeGuide).filter(
      (event) => event.eyebrow !== "Platform Cue",
    ),
  ]
    .filter(
      (
        event,
      ): event is {
        id: string;
        eyebrow: string;
        headline: string;
        body: string;
        roomLabel: string;
        timestampLabel: string;
        tone: keyof typeof toneClasses;
      } => event !== null,
    )
    .slice(0, 8);

  const liveLabel =
    gateway.connectionState === "connected" && gateway.totalActiveSessions > 0
      ? "LIVE"
      : gateway.connectionState === "connected"
        ? "STANDBY"
        : gateway.connectionState === "authenticating" ||
            gateway.connectionState === "connecting"
          ? "LINKING"
          : "OFF AIR";

  return (
    <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-8 px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_24%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.2),transparent_22%),linear-gradient(135deg,#0f172a_0%,#140d1f_45%,#1f1130_100%)] shadow-[0_24px_80px_rgba(8,15,33,0.45)]">
        <div className="grid gap-8 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.7fr)] lg:px-8 lg:py-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/12 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-fuchsia-100">
                {stage.label}
              </span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/12 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-emerald-100">
                {liveLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-slate-200">
                Hype {String(livePulse).padStart(2, "0")}
              </span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-slate-200">
                Act {stageIndex + 1}/{stages.length}
              </span>
            </div>

            <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-fuchsia-200/80">
              Focus Camera
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {spotlightTitle}
            </h2>
            <p className="mt-4 text-lg font-medium text-fuchsia-100 sm:text-xl">
              {spotlightEyebrow}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
              {spotlightBody}
            </p>

            <div className="mt-8 rounded-[1.6rem] border border-white/10 bg-black/20 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-400">
                Tonight&apos;s Highlight
              </p>
              <blockquote className="mt-4 text-xl leading-9 text-white sm:text-2xl">
                {spotlightLine}
              </blockquote>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                当前节目任务是 {stage.title}。观众看到的不该是 control 卡片翻版，而是
                谁正在出镜、哪支队伍正在成形、哪间房正在把本幕推向下一拍。
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Camera Landing
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {primaryTeamSpotlight?.roomLabel ??
                    primaryRoomNarrative?.roomLabel ??
                    focusContestant?.roomLabel ??
                    "Focus Room"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {primaryRoomNarrative?.detail ??
                    (focusContestant
                      ? "镜头此刻跟着真实房间落点走，不靠前端脑补假机位。"
                      : primaryFallback?.body ??
                        "焦点房间还在等第一位参与者正式冲进画面。")}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Act Mission
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {stage.contestantActions[0]}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {runtimeGuide.successSignal}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Camera Targets
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {focusRooms.map((room) => room.label).join(" / ")}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {primaryTeamSpotlight
                    ? `${primaryTeamSpotlight.teamLabel} 正在把 ${primaryTeamSpotlight.roomLabel ?? "当前机位"} 推成这幕的重点房间。`
                    : `本幕最值得切镜头的机位一共 ${focusRooms.length} 个。`}
                </p>
              </article>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Authority Stage
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {audience.authorityStageId ?? "local-preview"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {audience.stageHeadline}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Stage Timer
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {gateway.activeTimer?.remainingLabel ?? "--:--"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {gateway.activeTimer
                    ? `${gateway.activeTimer.stateLabel} · ${gateway.activeTimer.stageId ?? "current-stage"}`
                    : "倒计时还没切进前台时，节目会先按这一幕的现场节奏往前推。"}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  {stageDeskLabel}
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {stageDeskValue}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {isScoreStage
                    ? audience.score.detail
                    : audience.submission.detail}
                </p>
              </article>
            </div>
          </div>

          <aside className="space-y-4">
            <article className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-400">
                Stage Pulse
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[1rem] border border-white/8 bg-white/6 px-3 py-3">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                    Room Spotlight
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {primaryRoomNarrative?.headline ??
                      hottestRoom?.heatLabel ??
                      "待点亮"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {primaryRoomNarrative?.detail ??
                      hottestRoom?.story ??
                      primaryFallback?.body ??
                      emptyState.body}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-white/8 bg-white/6 px-3 py-3">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                    Platform Cue
                  </p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {audience.platformCue.headline}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {audience.platformCue.detail}
                  </p>
                  {audience.platformCue.timestampLabel ? (
                    <p className="mt-3 font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                      {audience.platformCue.timestampLabel}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>

            <article className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-400">
                Act Script
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                {stage.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {stage.summary}
              </p>
              <div className="mt-4 space-y-3">
                {stage.contestantActions.slice(0, 3).map((action) => (
                  <div
                    key={action}
                    className="rounded-[1rem] border border-white/8 bg-white/6 px-3 py-3 text-sm leading-7 text-slate-200"
                  >
                    {action}
                  </div>
                ))}
              </div>
              <div
                className={`mt-4 rounded-[1rem] border px-3 py-3 ${toneClasses[audience.backstage.tone]}`}
              >
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-current/80">
                  Backstage Context
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {audience.backstage.headline}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-100">
                  {audience.backstage.detail}
                </p>
                {audience.backstage.docBadges.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {audience.backstage.docBadges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-100"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          </aside>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
              Season Track
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              {stages.length} 幕不是菜单，它们是一幕幕被点亮的现场
            </h3>
          </div>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-slate-200">
            on act {stageIndex + 1}
          </span>
        </div>

        <div className="mt-5 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {stages.map((item, index) => {
              const isActive = item.id === stage.id;

              return (
                <article
                  key={item.id}
                  className={`w-48 rounded-[1.2rem] border px-4 py-4 transition ${
                    isActive
                      ? "border-fuchsia-300/30 bg-fuchsia-500/14 shadow-[0_16px_40px_rgba(217,70,239,0.18)]"
                      : "border-white/8 bg-black/20"
                  }`}
                >
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-300">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {index < stageIndex
                      ? "这一幕已经播完收镜。"
                      : isActive
                        ? "这一幕正在吃满镜头。"
                        : "下一幕还在后台候场。"}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {audience.softFallbacks.length > 0 ? (
        <section className="rounded-[1.8rem] border border-white/10 bg-black/20 p-5 backdrop-blur sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
                Standby Notes
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                现场偶尔会慢半拍，但不会突然变成后台报错页
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-slate-200">
              {audience.softFallbacks.length} soft fallback
            </span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {audience.softFallbacks.map((fallback) => (
              <article
                key={fallback.title}
                className="rounded-[1.2rem] border border-dashed border-white/15 bg-white/6 p-4"
              >
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">
                  gentle fallback
                </p>
                <h4 className="mt-3 text-lg font-semibold text-white">
                  {fallback.title}
                </h4>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  {fallback.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
        <article className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
                Live Beat Feed
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                观众该看到的是剧情推进，不是日志打印
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-slate-200">
              {showEvents.length} beats
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {showEvents.length > 0 ? (
              showEvents.map((event) => (
                <article
                  key={event.id}
                  className={`rounded-[1.2rem] border p-4 ${toneClasses[event.tone]}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-current/80">
                    <span>{event.eyebrow}</span>
                    <span>•</span>
                    <span>{event.timestampLabel}</span>
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-white">
                    {event.headline}
                  </h4>
                  <p className="mt-2 text-sm leading-7 text-slate-100">
                    {event.body}
                  </p>
                </article>
              ))
            ) : (
              fallbackCards.map((beat) => (
                <article
                  key={beat.title}
                  className="rounded-[1.2rem] border border-dashed border-white/15 bg-black/20 p-4"
                >
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">
                    warm-up cue
                  </p>
                  <p className="mt-3 text-base font-medium leading-7 text-white">
                    {beat.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    {beat.body}
                  </p>
                </article>
              ))
            )}
          </div>
        </article>

        <aside className="space-y-6">
          <article className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
                  Room Radar
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  哪个房间正在升温，观众和导播都应该马上感觉到
                </h3>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-slate-200">
                {audience.roomNarratives.length} room stories
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {audience.roomNarratives.map((room) => {
                const heat = roomHeatById.get(room.roomId);
                return (
                  <article
                    key={room.roomId}
                    className={`rounded-[1.2rem] border p-4 ${toneClasses[room.tone]}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-current/80">
                          {room.roomLabel}
                        </p>
                        <h4 className="mt-2 text-lg font-semibold text-white">
                          {room.headline}
                        </h4>
                      </div>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-100">
                        {heat?.count ?? 0} online
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-100">
                      {room.detail}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {room.isFocusRoom ? (
                        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-100">
                          Main Target
                        </span>
                      ) : null}
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-100">
                        {heat?.activityCount ?? 0} fresh lines
                      </span>
                      {(heat?.headliners ?? []).filter((agentId) =>
                        worldAgentIds.size === 0 || worldAgentIds.has(agentId),
                      ).map((agentId, index) => (
                        <span
                          key={`${room.roomId}-${agentId}-${index}`}
                          className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-100"
                        >
                          {agentId}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur sm:p-6">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
              Highlight Board
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                  Team Spotlight
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {primaryTeamSpotlight?.teamLabel ?? "队伍待点亮"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {primaryTeamSpotlight?.headline ??
                    primaryFallback?.title ??
                    "正式队伍镜头一到位，这里会先亮起来。"}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                  Room Spotlight
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {primaryRoomNarrative?.roomLabel ??
                    hottestRoom?.label ??
                    "Focus Room"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {primaryRoomNarrative?.headline ??
                    hottestRoom?.heatLabel ??
                    "房间热度还在酝酿。"}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                  {stageDeskLabel}
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {isScoreStage
                    ? audience.score.headline
                    : audience.submission.headline}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {isScoreStage
                    ? audience.score.detail
                    : audience.submission.detail}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                  Backstage Context
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {audience.backstage.docBadges.length > 0
                    ? audience.backstage.docBadges.join(" / ")
                    : "后台提示待同步"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {audience.backstage.headline}
                </p>
              </article>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
