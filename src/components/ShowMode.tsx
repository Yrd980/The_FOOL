import {
  buildFocusRooms,
  buildRoomHeatSummaries,
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
  const focusContestant = contestants[0] ?? null;
  const focusRooms = buildFocusRooms(runtimeGuide, gateway);
  const roomHeat = buildRoomHeatSummaries(gateway, runtimeGuide);
  const hottestRoom = roomHeat[0] ?? null;
  const sideStoryContestant =
    contestants.find((contestant) => contestant.state === "raised-hand" && !contestant.isInFocusRoom) ??
    contestants.find((contestant) => contestant.roomId === "quiet-orbit") ??
    contestants[1] ??
    null;
  const emptyState = buildShowEmptyState(gateway, stage);
  const showState = buildShowStateCopy(focusContestant, stage);
  const showEvents = buildShowEvents(gateway, contestants).slice(0, 8);
  const latestPlatformCue = gateway.domainEvents[0] ?? null;
  const stageIndex = stages.findIndex((item) => item.id === stage.id);
  const livePulse = Math.min(
    99,
    (hottestRoom?.heatScore ?? 0) + gateway.activities.length * 3 + gateway.totalActiveSessions * 2,
  );
  const spotlightLine =
    focusContestant?.recentActivity?.content ??
    gateway.activities[0]?.content ??
    emptyState.body;
  const standbyBeats = [
    emptyState.title,
    runtimeGuide.successSignal,
    stage.humanActions[0] ?? "全场都在等第一句能被截进海报和预告片的话。",
  ];

  const liveLabel =
    gateway.connectionState === "connected" && gateway.totalActiveSessions > 0
      ? "LIVE"
      : gateway.connectionState === "connected"
        ? "STANDBY"
        : gateway.connectionState === "authenticating" || gateway.connectionState === "connecting"
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
              Main Stage Camera
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {focusContestant ? focusContestant.agentId : emptyState.title}
            </h2>
            <p className="mt-4 text-lg font-medium text-fuchsia-100 sm:text-xl">
              {focusContestant ? `${showState.label} · ${showState.action}` : emptyState.eyebrow}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
              {focusContestant ? showState.note : emptyState.body}
            </p>

            <div className="mt-8 rounded-[1.6rem] border border-white/10 bg-black/20 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-400">
                Tonight's Highlight
              </p>
              <blockquote className="mt-4 text-xl leading-9 text-white sm:text-2xl">
                {spotlightLine}
              </blockquote>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                当前节目任务是 {stage.title}。观众不是来读配置的，而是来看谁正在出镜、谁正在拱节奏、谁突然把全场点亮。
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Camera Landing
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {focusContestant?.roomLabel ?? "Main Stage"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {focusContestant
                    ? "这位 contestant 现在真的挂在这个房间里，镜头不是演的。"
                    : "主舞台还在等第一位 contestant 正式冲进画面。"}
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
                  本幕最值得切镜头的机位一共 {focusRooms.length} 个。
                </p>
              </article>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Authority Stage
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {gateway.activityRun?.currentStageId ?? "local-preview"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {gateway.activityRun
                    ? "这次镜头切到哪一幕，优先由平台权威状态决定。"
                    : "还没接到权威 stage 时，节目先使用本地预演幕。"}
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
                    : "当前还没有平台计时信息。"}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Submission Lock
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {gateway.lockedSubmissionCount}/{gateway.totalSubmissionCount}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {gateway.totalSubmissionCount > 0
                    ? "观众侧也能直接看到结构化提交是否锁定。"
                    : "这一幕还没有 submission 进度。"}
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
                    Crowd Heat
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {hottestRoom?.heatLabel ?? "待点亮"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {hottestRoom?.story ?? emptyState.body}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-white/8 bg-white/6 px-3 py-3">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                    Platform Cue
                  </p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {latestPlatformCue?.title ?? "平台还没推来新的编排事件"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {latestPlatformCue
                      ? latestPlatformCue.detail
                      : sideStoryContestant
                        ? `${sideStoryContestant.roomLabel} 里还有另一条剧情线在偷偷抬头，随时可能被切进主舞台。`
                        : "一旦平台开始推送 stage / timer / submission 事件，这里会先把它们顶上来。"}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-400">
                Act Script
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{stage.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{stage.summary}</p>
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
              十幕不是菜单，它们是一幕幕被点亮的现场
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
                  <h4 className="mt-3 text-lg font-semibold text-white">{event.headline}</h4>
                  <p className="mt-2 text-sm leading-7 text-slate-100">{event.body}</p>
                </article>
              ))
            ) : (
              standbyBeats.map((beat) => (
                <article
                  key={beat}
                  className="rounded-[1.2rem] border border-dashed border-white/15 bg-black/20 p-4"
                >
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">
                    warm-up cue
                  </p>
                  <p className="mt-3 text-base font-medium leading-7 text-white">{beat}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    主舞台一旦恢复实时心跳，这里就会从预热提示切成真正的现场节奏。
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
                  哪个房间正在炸，观众和导播都应该马上感觉到
                </h3>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-slate-200">
                {roomHeat.length} rooms
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {roomHeat.map((room) => (
                <article
                  key={room.roomId}
                  className={`rounded-[1.2rem] border p-4 ${toneClasses[room.heatTone]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-current/80">
                        {room.label}
                      </p>
                      <h4 className="mt-2 text-lg font-semibold text-white">
                        {room.heatLabel}
                      </h4>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-100">
                      {room.count} online
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-100">{room.story}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {room.isFocusRoom ? (
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-100">
                        Main Target
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-100">
                      {room.activityCount} fresh lines
                    </span>
                    {room.headliners.map((agentId, index) => (
                      <span
                        key={`${room.roomId}-${agentId}-${index}`}
                        className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-100"
                      >
                        {agentId}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur sm:p-6">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
              Highlight Board
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                  Main Face
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {focusContestant?.agentId ?? "主舞台待点亮"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {focusContestant ? showState.label : emptyState.eyebrow}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                  Hottest Room
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {hottestRoom?.label ?? "Main Stage"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {hottestRoom?.heatLabel ?? "待开播"}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                  System Echo
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {stage.systemSignals[0]}
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">
                  Crowd Noise
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {stage.humanActions[0]}
                </p>
              </article>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
