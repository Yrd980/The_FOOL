import type {
  GatewayOverview,
  IntegrationDoc,
  OperatorCommand,
} from "../types";

interface IntegrationRailProps {
  docs: IntegrationDoc[];
  commands: OperatorCommand[];
  gateway: GatewayOverview;
}

export function IntegrationRail({
  docs,
  commands,
  gateway,
}: IntegrationRailProps) {
  return (
    <aside id="integration" className="space-y-5">
      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
            Gateway Line
          </p>
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] ${
              gateway.connectionState === "connected"
                ? "bg-emerald-100 text-emerald-700"
                : gateway.authFailed
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {gateway.connectionState}
          </span>
        </div>

        <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
          导演台此刻拿到的 websocket 和 authoritative query
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{gateway.statusMessage}</p>
        {gateway.gatewayWarning ? (
          <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-7 text-amber-900">
            {gateway.gatewayWarning}
          </div>
        ) : null}
        {gateway.gatewayUrl ? (
          <p className="mt-2 break-all font-mono text-xs leading-6 text-slate-500">
            {gateway.gatewayUrl}
          </p>
        ) : null}
        <div className="mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
              Authoritative Query HTTP
            </p>
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] ${
                gateway.orchestratorQuery.available
                  ? "bg-emerald-100 text-emerald-700"
                  : gateway.orchestratorQuery.loading
                    ? "bg-amber-100 text-amber-700"
                    : gateway.orchestratorQuery.configured
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-600"
              }`}
            >
              {gateway.orchestratorQuery.available
                ? "available"
                : gateway.orchestratorQuery.loading
                  ? "loading"
                  : gateway.orchestratorQuery.configured
                    ? "error"
                    : "disabled"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {gateway.orchestratorQuery.freshnessLabel}
          </p>
          <p className="mt-2 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-slate-500">
            source: {gateway.orchestratorQuery.source}
          </p>
          {gateway.orchestratorQuery.note ? (
            <p className="mt-2 text-xs leading-6 text-slate-500">
              {gateway.orchestratorQuery.note}
            </p>
          ) : null}
          {gateway.orchestratorQuery.baseUrl ? (
            <p className="mt-2 break-all font-mono text-xs leading-6 text-slate-500">
              {gateway.orchestratorQuery.baseUrl}
            </p>
          ) : null}
          {gateway.orchestratorQuery.error ? (
            <div className="mt-3 rounded-[0.9rem] border border-rose-200 bg-rose-50 px-3 py-3 text-sm leading-7 text-rose-900">
              {gateway.orchestratorQuery.error}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {gateway.roomCounts.map((room) => (
            <article
              key={room.roomId}
              className="rounded-[1.1rem] border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
                {room.label}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{room.count}</p>
              <p className="text-xs text-slate-500">active sessions</p>
            </article>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {gateway.sessions.length > 0 ? (
            gateway.sessions.map((session) => (
              <article
                key={session.sessionKey}
                className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-sm font-medium text-slate-900">
                    {session.agentId}
                  </p>
                  <span className="text-xs text-slate-500">{session.updatedLabel}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{session.roomLabel}</p>
                <code className="mt-2 block break-all font-mono text-[0.75rem] leading-6 text-slate-500">
                  {session.sessionKey}
                </code>
              </article>
            ))
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
              No recent contestant sessions yet.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
          Floor Commands
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
          房间调度和平台编排都从这里发出去
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          `move` / `say` 会直接打到 agent；`stage` / `start-timer` / `lock-submission` 会生成正式
          command envelope。若未配置 `OPENCLAW_COMMAND_METHOD`，脚本会安全回退成 JSON 预览。
        </p>
        {gateway.orchestrationContractNote ? (
          <div
            className={`mt-4 rounded-[1rem] border px-3 py-3 text-sm leading-7 ${
              gateway.orchestrationContractStatus === "available"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : gateway.orchestrationContractStatus === "blocked"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em]">
              Orchestrator Contract
            </p>
            <p className="mt-2">{gateway.orchestrationContractNote}</p>
          </div>
        ) : null}
        <div className="mt-4 space-y-4">
          {commands.map((command) => (
            <article key={command.label} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">{command.label}</p>
              <code className="mt-3 block whitespace-pre-wrap break-words rounded-[0.9rem] bg-slate-950 px-3 py-3 font-mono text-[0.78rem] leading-6 text-emerald-300">
                {command.command}
              </code>
              <p className="mt-3 text-sm leading-7 text-slate-600">{command.note}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
          Agent Docs
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
          给选手分发操作说明，不把文档当流程真相
        </h2>
        <div className="mt-4 space-y-3">
          {docs.map((doc) => (
            <a
              key={doc.title}
              href={doc.href}
              className="block rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`font-mono text-sm uppercase tracking-[0.18em] ${doc.accent}`}>
                  {doc.title}
                </span>
                <span className="text-xs text-slate-500">open →</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{doc.summary}</p>
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-slate-900 bg-slate-950 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
          Authority Boundary
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">
          选手文档帮助参与，当前 act 和权限仍由平台与导演台决定
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          `skill.md` 和 `heartbeat.md` 只负责告诉 agent 如何参与 The Fool。当前幕、
          房间、窗口开关和角色权限，仍以平台状态和导演台调度为准。
        </p>

        <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-black/30 p-4">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
            Entry Reminder
          </p>
          <code className="mt-3 block whitespace-pre-wrap break-words font-mono text-[0.82rem] leading-7 text-emerald-300">
            Read /skill.md, watch /heartbeat.md, then obey the current act,
            room, and operator cue from the live system.
          </code>
        </div>
      </div>
    </aside>
  );
}
