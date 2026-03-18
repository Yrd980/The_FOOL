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

const formatPayloadValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry)))
      .join(" · ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return "n/a";
};

const buildSubmissionFieldEntries = (data: Record<string, unknown> | null) => {
  if (!data) {
    return [];
  }

  const preferredOrder = ["posterOrDeck", "elevatorPitch", "highlights", "risk"];
  const seen = new Set<string>();
  const orderedKeys = [
    ...preferredOrder.filter((key) => key in data),
    ...Object.keys(data).filter((key) => !preferredOrder.includes(key)),
  ];

  return orderedKeys
    .filter((key) => {
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((key) => ({
      key,
      value: data[key],
    }));
};

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

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
              Authority Stage
            </p>
            <p className="mt-3 text-xl font-semibold text-slate-950">
              {gateway.activityRun?.currentStageId ?? "local-preview"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {gateway.activityRun
                ? "当前幕已经来自平台权威状态，show/control 会跟着它走。"
                : "还没接到平台快照时，导演台先退回本地预演切幕。"}
            </p>
          </article>

          <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
              Stage Timer
            </p>
            <p className="mt-3 text-xl font-semibold text-slate-950">
              {gateway.activeTimer?.remainingLabel ?? "--:--"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {gateway.activeTimer
                ? `${gateway.activeTimer.stateLabel} · ${gateway.activeTimer.stageId ?? "current-stage"}`
                : "当前还没有收到平台计时器。"}
            </p>
          </article>

          <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
              Submission Lock
            </p>
            <p className="mt-3 text-xl font-semibold text-slate-950">
              {gateway.lockedSubmissionCount}/{gateway.totalSubmissionCount}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {gateway.totalSubmissionCount > 0
                ? "提交锁定进度已经进入导演台，可以直接判断是否该切下一幕。"
                : "当前还没有收到结构化 submission 状态。"}
            </p>
          </article>

          <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
              Event Sequence
            </p>
            <p className="mt-3 text-xl font-semibold text-slate-950">
              {gateway.lastSequence ?? "n/a"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              最近一次平台领域事件序号，用来确认导演台跟权威事件流是否对齐。
            </p>
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

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                  Authoritative Submission
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  当前 submission payload 和 version history 直接来自 local authoritative contract，不再靠组件手拼。
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                {gateway.currentSubmission
                  ? `${gateway.currentSubmission.locked ? "locked" : "open"} · ${gateway.currentSubmission.versions.length} versions`
                  : `${gateway.submissions.length} submissions`}
              </span>
            </div>

            {gateway.currentSubmission ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <article className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
                    <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                      Submission
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {gateway.currentSubmission.id}
                    </p>
                    <p className="text-xs text-slate-500">
                      {gateway.currentSubmission.schemaId}
                    </p>
                  </article>
                  <article className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
                    <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                      Version
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {gateway.currentSubmission.version
                        ? `v${gateway.currentSubmission.version}`
                        : "n/a"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {gateway.currentSubmission.updatedLabel ?? "No update timestamp"}
                    </p>
                  </article>
                  <article className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
                    <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                      Latest Actor
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {gateway.currentSubmission.latestActorId ?? "n/a"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {gateway.currentSubmission.latestActorRole ?? "role unknown"}
                    </p>
                  </article>
                  <article className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
                    <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                      Team / Stage
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {gateway.currentSubmission.teamId ?? "team n/a"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {gateway.currentSubmission.stageId ?? "stage n/a"}
                    </p>
                  </article>
                </div>

                <div className="mt-4 grid gap-3">
                  {buildSubmissionFieldEntries(gateway.currentSubmission.data).map((field) => (
                    <article
                      key={field.key}
                      className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4"
                    >
                      <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                        {field.key}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {formatPayloadValue(field.value)}
                      </p>
                    </article>
                  ))}
                </div>

                <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
                      Version History
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-600">
                      {gateway.currentSubmission.versions.length} records
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {gateway.currentSubmission.versions.length > 0 ? (
                      gateway.currentSubmission.versions.slice(0, 5).map((version) => (
                        <article
                          key={`${gateway.currentSubmission?.id}-${version.version}`}
                          className="rounded-[0.95rem] border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono uppercase tracking-[0.16em]">
                              v{version.version}
                            </span>
                            <span>•</span>
                            <span>{version.updatedLabel}</span>
                            <span>•</span>
                            <span>{version.actorRole ?? "role unknown"}</span>
                            <span>•</span>
                            <span>{version.actorId ?? "actor n/a"}</span>
                          </div>
                          <p className="mt-2 text-sm leading-7 text-slate-700">
                            {buildSubmissionFieldEntries(version.data)
                              .slice(0, 2)
                              .map((field) => `${field.key}: ${formatPayloadValue(field.value)}`)
                              .join(" | ")}
                          </p>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-[0.95rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                        当前 submission 还没有 version history。
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-[1rem] border border-dashed border-slate-300 bg-white p-4 text-sm leading-7 text-slate-500">
                还没有 authoritative submission payload。先走 open-submission / submit / update-submission / lock-submission 命令链，这里就会补齐。
              </div>
            )}
          </article>

          <article className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                  Score Projection
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  当前 scores 和 scoreSummary 直接取自 authoritative query，不再等组件侧自己推断。
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                {gateway.scores.length} scores
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <article className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                  Summary Targets
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {gateway.scoreSummary.length}
                </p>
                <p className="text-xs text-slate-500">aggregated targets</p>
              </article>
              <article className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                  Query Status
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {gateway.orchestratorQuery.freshnessLabel}
                </p>
                <p className="text-xs text-slate-500">
                  {gateway.orchestratorQuery.available
                    ? "authoritative http is readable"
                    : gateway.orchestratorQuery.error ?? "awaiting backend sync"}
                </p>
              </article>
            </div>

            <div className="mt-4 space-y-3">
              {gateway.scoreSummary.length > 0 ? (
                gateway.scoreSummary.map((summary) => (
                  <article
                    key={`${summary.targetType}-${summary.targetId}`}
                    className="rounded-[1rem] border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
                          {summary.targetType}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          {summary.submissionId ?? summary.targetId}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold text-slate-950">
                          {summary.averageLabel}
                        </p>
                        <p className="text-xs text-slate-500">
                          {summary.judgeCount} judges · {summary.lastSubmittedLabel}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[1rem] border border-dashed border-slate-300 bg-white p-4 text-sm leading-7 text-slate-500">
                  当前还没有 authoritative score summary。切到 `act-7-ai-judging` 并执行 `submit-score` 后，这里会先亮起来。
                </div>
              )}
            </div>

            <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
                  Recent Scores
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[0.63rem] uppercase tracking-[0.16em] text-slate-600">
                  latest {Math.min(4, gateway.scores.length)}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {gateway.scores.length > 0 ? (
                  gateway.scores.slice(0, 4).map((score) => (
                    <article
                      key={score.id}
                      className="rounded-[0.95rem] border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono uppercase tracking-[0.16em]">
                          {score.judgeRole ?? "judge"}
                        </span>
                        <span>•</span>
                        <span>{score.judgeId ?? "unknown-judge"}</span>
                        <span>•</span>
                        <span>{score.submittedLabel}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {score.submissionId ?? score.targetId} · {score.score}/10
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {score.reason}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[0.95rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    最近还没有 score submission。
                  </div>
                )}
              </div>
            </div>
          </article>
        </div>

        <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                Recent Audit Trail
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                command receipt / replay / reject 证据统一从 authoritative audit 里读，方便导演确认 backend 真的处理过什么。
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
              {gateway.recentAuditRecords.length} records
            </span>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {gateway.recentAuditRecords.length > 0 ? (
              gateway.recentAuditRecords.map((record) => (
                <article
                  key={record.id}
                  className="rounded-[1.1rem] border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono uppercase tracking-[0.16em]">
                      {record.commandType}
                    </span>
                    <span>•</span>
                    <span>{record.handledLabel}</span>
                    <span>•</span>
                    <span>{record.status}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-950">
                    {record.actorRole} / {record.actorId}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    commandId: {record.commandId}
                  </p>
                  {record.idempotencyKey ? (
                    <p className="mt-1 break-all text-xs leading-6 text-slate-500">
                      idempotencyKey: {record.idempotencyKey}
                    </p>
                  ) : null}
                  {record.errorMessage ? (
                    <p className="mt-2 rounded-[0.9rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-7 text-rose-900">
                      {record.errorCode ? `[${record.errorCode}] ` : ""}
                      {record.errorMessage}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-[1.1rem] border border-dashed border-slate-300 bg-white p-4 text-sm leading-7 text-slate-500">
                authoritative audit 还没有记录。执行 command 链后，这里会显示 receipt / replay / reject 的最小证据。
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                Platform Event Feed
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                这条流不是聊天室文本，而是平台编排层刚刚发生的关键事件。
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
              {gateway.domainEvents.length} orchestration events
            </span>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {gateway.domainEvents.length > 0 ? (
              gateway.domainEvents.slice(0, 6).map((event) => (
                <article
                  key={event.id}
                  className="rounded-[1.2rem] border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono uppercase tracking-[0.16em]">
                      {event.type}
                    </span>
                    <span>•</span>
                    <span>{event.timestampLabel}</span>
                    {event.sequence !== null ? (
                      <>
                        <span>•</span>
                        <span>seq {event.sequence}</span>
                      </>
                    ) : null}
                  </div>
                  <h4 className="mt-3 text-base font-semibold text-slate-950">
                    {event.title}
                  </h4>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{event.detail}</p>
                  {(event.provenance.actorId ||
                    event.provenance.actorRole ||
                    event.provenance.commandId ||
                    event.provenance.idempotencyKey) ? (
                    <div className="mt-3 rounded-[0.95rem] border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-600">
                      {event.provenance.actorRole || event.provenance.actorId ? (
                        <p>
                          actor: {event.provenance.actorRole ?? "unknown"} /{" "}
                          {event.provenance.actorId ?? "n/a"}
                        </p>
                      ) : null}
                      {event.provenance.commandId ? (
                        <p className="break-all">
                          commandId: {event.provenance.commandId}
                        </p>
                      ) : null}
                      {event.provenance.idempotencyKey ? (
                        <p className="break-all">
                          idempotencyKey: {event.provenance.idempotencyKey}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-white p-4 text-sm leading-7 text-slate-500">
                还没有收到 stage、timer、submission、award 这类平台事件。接上后，这里会成为导演判断切幕的主线证据。
              </div>
            )}
          </div>
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
