import type { GatewayOverview, StageDefinition, StageRuntimeGuide, SummaryStat } from "../types";

interface StageWorkspaceProps {
  stage: StageDefinition;
  runtimeGuide: StageRuntimeGuide;
  summaryStats: SummaryStat[];
  gateway: GatewayOverview;
}

export function StageWorkspace({
  stage,
  runtimeGuide,
  summaryStats,
  gateway,
}: StageWorkspaceProps) {
  const focusRooms = runtimeGuide.preferredRoomIds.map((roomId) => {
    const roomCount = gateway.roomCounts.find((room) => room.roomId === roomId);
    return {
      roomId,
      label: roomCount?.label ?? roomId,
      count: roomCount?.count ?? 0,
    };
  });

  const toneClasses = {
    critical: "bg-rose-100 text-rose-700",
    active: "bg-amber-100 text-amber-700",
    warm: "bg-emerald-100 text-emerald-700",
    idle: "bg-slate-100 text-slate-500",
  };

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[1.8rem] border border-slate-900 bg-slate-950 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <div className="border-b border-white/8 px-5 py-4 sm:px-6">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
            Product Summary
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            愚人节首届非人类黑客松
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            这是一个真正要运行的产品：左边是幕结构，中央是当前舞台工作台，右边是
            OpenClaw 选手接入与操作者入口。Moltbook 只影响 agent onboarding
            方式，不接管整个产品视觉。
          </p>
        </div>

        <div className="grid gap-px bg-white/8 sm:grid-cols-3">
          {summaryStats.map((stat) => (
            <article key={stat.label} className="bg-slate-950 px-5 py-4 sm:px-6">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                {stat.label}
              </p>
              <p className="mt-2 text-xl font-semibold text-white">{stat.value}</p>
              <p className="mt-2 text-sm leading-7 text-slate-400">{stat.note}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[#fecdd3] bg-[#fff1f2] px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.22em] text-[#be123c]">
            {stage.label}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.22em] text-slate-600">
            Active Workspace
          </span>
        </div>

        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {stage.title}
        </h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          {stage.summary}
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
              Operator Hint
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {runtimeGuide.operatorHint}
            </p>
            <p className="mt-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-7 text-emerald-800">
              {runtimeGuide.successSignal}
            </p>
          </article>

          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                Focus Rooms
              </p>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                {gateway.totalActiveSessions} sessions
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {focusRooms.map((room) => (
                <article
                  key={room.roomId}
                  className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-3"
                >
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
                    {room.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {room.count}
                  </p>
                  <p className="text-xs text-slate-500">active sessions</p>
                </article>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                Contestant State Pulse
              </p>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                live
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {gateway.stateCounts.map((state) => (
                <article
                  key={state.state}
                  className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-3"
                >
                  <span className={`inline-flex rounded-full px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${toneClasses[state.tone]}`}>
                    {state.label}
                  </span>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">{state.count}</p>
                  <p className="text-xs text-slate-500">contestants</p>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
              Room Occupancy
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {gateway.roomRosters.map((room) => (
                <article
                  key={room.roomId}
                  className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                      {room.label}
                    </p>
                    <span className="text-sm font-semibold text-slate-950">
                      {room.sessions.length}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {room.sessions.length > 0 ? (
                      room.sessions.slice(0, 3).map((session) => (
                        <div
                          key={session.sessionKey}
                          className="flex items-center justify-between gap-3 rounded-[0.9rem] bg-slate-50 px-2.5 py-2"
                        >
                          <span className="font-mono text-[0.72rem] text-slate-700">
                            {session.agentId}
                          </span>
                          <span className={`rounded-full px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] ${toneClasses[session.stateTone]}`}>
                            {session.stateLabel}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs leading-6 text-slate-500">No live sessions</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
              Contestant Output
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
              {stage.contestantActions.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#e01b24]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
              Human Participation
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
              {stage.humanActions.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
              System Feedback
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
              {stage.systemSignals.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                Live Contestant Sessions
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                最近活跃的 OpenClaw contestant session 会直接决定选手在哪个房间、此刻是否在说话，以及舞台是否真的活着。
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
              {gateway.connectionState}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {gateway.sessions.length > 0 ? (
              gateway.sessions.map((session) => (
                <article
                  key={session.sessionKey}
                  className="rounded-[1.2rem] border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-medium text-slate-950">
                      {session.agentId}
                    </p>
                    <span
                      className={`rounded-full px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${toneClasses[session.stateTone]}`}
                    >
                      {session.stateLabel}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{session.roomLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">{session.updatedLabel}</p>
                  <code className="mt-3 block break-all font-mono text-[0.72rem] leading-6 text-slate-500">
                    {session.sessionKey}
                  </code>
                </article>
              ))
            ) : (
              <div className="md:col-span-2 xl:col-span-3 rounded-[1.2rem] border border-dashed border-slate-300 bg-white p-4 text-sm leading-7 text-slate-500">
                {gateway.configured
                  ? "Gateway 已配置，但还没有看到 contestant session。把 agent 接到 `agent:{agentId}:{room}` 之后，这里会开始出现活跃态。"
                  : "当前环境还没配置 OpenClaw gateway。配置 `VITE_OPENCLAW_URL` 和 `VITE_OPENCLAW_TOKEN` 后，这里会显示实时选手会话。"}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
