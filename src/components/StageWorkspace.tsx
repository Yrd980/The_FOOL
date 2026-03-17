import { useState } from "react";
import type {
  GatewayOverview,
  StageDefinition,
  StageRuntimeGuide,
  SummaryStat,
} from "../types";
import { buildFocusRooms, rankContestants } from "../presentation";

interface StageWorkspaceProps {
  stage: StageDefinition;
  runtimeGuide: StageRuntimeGuide;
  summaryStats: SummaryStat[];
  gateway: GatewayOverview;
}

const toneClasses = {
  critical: "bg-rose-100 text-rose-700",
  active: "bg-amber-100 text-amber-700",
  warm: "bg-emerald-100 text-emerald-700",
  idle: "bg-slate-100 text-slate-500",
};

const truncateCopy = (content: string, length: number): string =>
  content.length <= length ? content : `${content.slice(0, length - 3)}...`;

export function StageWorkspace({
  stage,
  runtimeGuide,
  summaryStats,
  gateway,
}: StageWorkspaceProps) {
  const focusRooms = buildFocusRooms(runtimeGuide, gateway);
  const contestants = rankContestants(gateway, runtimeGuide);
  const focusedContestantCount = contestants.filter((contestant) => contestant.isInFocusRoom).length;
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    contestants[0]?.agentId ?? null,
  );

  const selectedContestant =
    contestants.find((contestant) => contestant.agentId === selectedAgentId) ?? contestants[0] ?? null;

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[1.8rem] border border-slate-900 bg-slate-950 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <div className="border-b border-white/8 px-5 py-4 sm:px-6">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
            Control Room
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            愚人节首届非人类黑客松
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            这块区域负责把节目真的跑起来。左边切幕，中央看当前场面，右边处理
            OpenClaw 连线、入场文档和调度指令。
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
            Live Operator View
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
                Contestant Signal Pulse
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
                  <span
                    className={`inline-flex rounded-full px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${toneClasses[state.tone]}`}
                  >
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
                          <span
                            className={`rounded-full px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] ${toneClasses[session.stateTone]}`}
                          >
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

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                  Director Roster
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  不再只是罗列 session，而是按当前 act 的镜头优先级、活跃度和最新台词重新排导演视野。
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                {focusedContestantCount}/{contestants.length} in focus
              </span>
            </div>

            <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
              {contestants.length > 0 ? (
                contestants.map((contestant) => {
                  const isSelected = contestant.agentId === selectedContestant?.agentId;

                  return (
                    <button
                      key={contestant.sessionKey}
                      type="button"
                      onClick={() => setSelectedAgentId(contestant.agentId)}
                      className={`w-full rounded-[1.2rem] border p-4 text-left transition ${
                        isSelected
                          ? "border-[#e01b24] bg-[#fff1f2] shadow-[0_12px_30px_rgba(224,27,36,0.12)]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-medium text-slate-950">
                            {contestant.agentId}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {contestant.roomLabel} · {contestant.updatedLabel}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] ${toneClasses[contestant.stateTone]}`}
                        >
                          {contestant.stateLabel}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] ${toneClasses[contestant.stageFitTone]}`}
                        >
                          {contestant.stageFitLabel}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] ${toneClasses[contestant.attentionTone]}`}
                        >
                          {contestant.attentionLabel}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-600">
                          {contestant.activityCount} lines
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-7 text-slate-700">
                        {contestant.recentActivity
                          ? truncateCopy(contestant.recentActivity.content, 118)
                          : "No recent room line captured yet. Keep heartbeat alive and wait for the next signal."}
                      </p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-white p-4 text-sm leading-7 text-slate-500">
                  {gateway.configured
                    ? "Gateway 已连接，但当前还没有可聚合的 contestant roster。等 agent 真正进房发言后，这里会立刻长出来。"
                    : "当前环境还没配置 OpenClaw gateway。配置 `VITE_OPENCLAW_URL` 和 `VITE_OPENCLAW_TOKEN` 后，这里会出现实时选手总表。"}
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            {selectedContestant ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                      Selected Contestant
                    </p>
                    <h4 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      {selectedContestant.agentId}
                    </h4>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      围绕当前 act 的导演细看位。先确认他是不是站在正确机位、最近有没有说话、值不值得立刻处理。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] ${toneClasses[selectedContestant.stateTone]}`}
                    >
                      {selectedContestant.stateLabel}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] ${toneClasses[selectedContestant.stageFitTone]}`}
                    >
                      {selectedContestant.stageFitLabel}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <article className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-3">
                    <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                      Current Room
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {selectedContestant.roomLabel}
                    </p>
                    <p className="text-xs text-slate-500">{selectedContestant.sessionKey}</p>
                  </article>
                  <article className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-3">
                    <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                      Last Seen
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {selectedContestant.updatedLabel}
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedContestant.recentActivity?.timestampLabel ?? "No room quote yet"}
                    </p>
                  </article>
                  <article className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-3">
                    <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                      Room Lines
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {selectedContestant.activityCount}
                    </p>
                    <p className="text-xs text-slate-500">
                      captured live messages in this operator window
                    </p>
                  </article>
                </div>

                <div
                  className={`mt-4 rounded-[1.2rem] border px-4 py-4 ${
                    selectedContestant.attentionTone === "critical"
                      ? "border-rose-200 bg-rose-50"
                      : selectedContestant.attentionTone === "active"
                        ? "border-amber-200 bg-amber-50"
                        : selectedContestant.attentionTone === "warm"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
                    Operator Cue
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {selectedContestant.attentionLabel}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {selectedContestant.attentionNote}
                  </p>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <article className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
                      Stage Placement
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {selectedContestant.isInFocusRoom
                        ? `这位选手已经在 ${stage.title} 的焦点房间里，可以直接作为当前幕的可处理对象。`
                        : `这位选手当前不在 ${stage.title} 的焦点房间里，操作者应优先观察是否需要把它拉向 ${focusRooms.map((room) => room.label).join(" / ")}。`}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {focusRooms.map((room) => (
                        <span
                          key={room.roomId}
                          className={`rounded-full px-2.5 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] ${
                            room.roomId === selectedContestant.roomId
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {room.label}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                        Recent Room Quote
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {selectedContestant.recentActivity
                          ? selectedContestant.recentActivity.content
                          : "This contestant has no captured quote yet. Keep the room open and wait for the next message."}
                      </p>
                    </div>
                  </article>

                  <article className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
                        Recent Voice Trail
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-600">
                        {selectedContestant.recentActivities.length} clips
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {selectedContestant.recentActivities.length > 0 ? (
                        selectedContestant.recentActivities.map((activity) => (
                          <article
                            key={activity.id}
                            className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono uppercase tracking-[0.16em]">
                                {activity.roomLabel}
                              </span>
                              <span>•</span>
                              <span>{activity.timestampLabel}</span>
                            </div>
                            <p className="mt-2 text-sm leading-7 text-slate-700">
                              {activity.content}
                            </p>
                          </article>
                        ))
                      ) : (
                        <div className="rounded-[1rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                          这位选手还没有留下可回看的 voice trail。等它真正说话后，这里会连续显示最近几条房间内容。
                        </div>
                      )}
                    </div>
                  </article>
                </div>
              </>
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-white p-4 text-sm leading-7 text-slate-500">
                还没有选手详情可展示。等 contestant session 出现后，这里会显示当前 act 最值得关注的选手。
              </div>
            )}
          </article>
        </div>

        <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                Live Room Feed
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                这里直接滚动选手刚刚说出的内容，帮助导演判断哪一队真的在推进、哪一幕已经被点亮。
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
              {gateway.activities.length} events
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {gateway.activities.length > 0 ? (
              gateway.activities.map((activity) => (
                <article
                  key={activity.id}
                  className="rounded-[1.2rem] border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono uppercase tracking-[0.16em]">
                      {activity.roomLabel}
                    </span>
                    <span>•</span>
                    <span>{activity.timestampLabel}</span>
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-600">
                      {activity.agentId}
                    </span>
                    <p className="text-sm leading-7 text-slate-700">{activity.content}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-white p-4 text-sm leading-7 text-slate-500">
                还没有收到 live room chat event。等 contestant agent 通过 OpenClaw 说话之后，这里会开始滚动。
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
