import { useState } from "react";
import type {
  GatewayOverview,
  IntegrationDoc,
  OperatorCommand,
} from "../types";

const queryStatusClasses = {
  available: "bg-emerald-100 text-emerald-700",
  degraded: "bg-amber-100 text-amber-700",
  syncing: "bg-amber-100 text-amber-700",
  unavailable: "bg-rose-100 text-rose-700",
  disabled: "bg-slate-100 text-slate-600",
};

const toneClasses = {
  critical: "border-rose-200 bg-rose-50 text-rose-900",
  active: "border-amber-200 bg-amber-50 text-amber-900",
  warm: "border-emerald-200 bg-emerald-50 text-emerald-900",
  idle: "border-slate-200 bg-slate-50 text-slate-700",
};

const structuredStateClasses = {
  "authoritative-query-snapshot": "bg-emerald-100 text-emerald-700",
  "gateway-snapshot": "bg-amber-100 text-amber-700",
  unavailable: "bg-slate-100 text-slate-600",
};

const commandRiskClasses = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  safe: "border-emerald-200 bg-emerald-50 text-emerald-900",
  caution: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
};

const commandAvailabilityClasses = {
  "read-only": "bg-slate-100 text-slate-600",
  ready: "bg-emerald-100 text-emerald-700",
  confirm: "bg-rose-100 text-rose-700",
  disabled: "bg-slate-100 text-slate-500",
};

const commandAvailabilityLabels = {
  "read-only": "read-only",
  ready: "ready",
  confirm: "needs confirm",
  disabled: "disabled",
};

const commandRiskLabels = {
  info: "info",
  safe: "safe",
  caution: "caution",
  danger: "danger",
};

const commandScopeLabels = {
  diagnostic: "diagnostic",
  agent: "agent-direct",
  orchestrator: "orchestrator",
};

const formatStructuredStateSource = (
  source: keyof typeof structuredStateClasses,
): string =>
  source === "authoritative-query-snapshot"
    ? "query snapshot"
    : source === "gateway-snapshot"
      ? "gateway snapshot"
      : "unavailable";

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
  const [armedCommandKey, setArmedCommandKey] = useState<string | null>(null);
  const [confirmationValues, setConfirmationValues] = useState<
    Record<string, string>
  >({});

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
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {gateway.statusMessage}
        </p>
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
              className={`rounded-full px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] ${queryStatusClasses[gateway.orchestratorQuery.status]}`}
            >
              {gateway.orchestratorQuery.statusLabel}
            </span>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {gateway.orchestratorQuery.reason ??
              gateway.orchestratorQuery.freshnessLabel}
          </p>
          <p className="mt-2 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-slate-500">
            source: {gateway.orchestratorQuery.source}
          </p>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            freshness: {gateway.orchestratorQuery.freshnessLabel}
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
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {gateway.orchestratorQuery.checks.map((check) => (
              <article
                key={check.key}
                className={`rounded-[0.9rem] border px-3 py-3 text-sm ${toneClasses[check.tone]}`}
              >
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.16em]">
                  {check.label}
                </p>
                <p className="mt-2 leading-6">{check.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
              Backend Evidence
            </p>
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] ${toneClasses[gateway.backendHealth.tone]}`}
            >
              {gateway.backendHealth.label}
            </span>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {gateway.backendHealth.detail}
          </p>
          <div className="mt-4 space-y-2">
            {gateway.backendHealth.evidence.map((item) => (
              <article
                key={item.id}
                className={`rounded-[0.9rem] border px-3 py-3 text-sm ${toneClasses[item.tone]}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.16em]">
                    {item.title}
                  </p>
                  {item.timestampLabel ? (
                    <span className="text-xs">{item.timestampLabel}</span>
                  ) : null}
                </div>
                <p className="mt-2 leading-6">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
              World / Skill Views
            </p>
            <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-600">
              shared typed state
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <article className="rounded-[0.9rem] border border-slate-200 bg-white px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-slate-500">
                  snapshot.world
                </p>
                <span
                  className={`rounded-full px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] ${structuredStateClasses[gateway.world.source]}`}
                >
                  {formatStructuredStateSource(gateway.world.source)}
                </span>
              </div>
              <p className="mt-2 leading-6 text-slate-700">
                {gateway.world.available
                  ? `${gateway.world.rooms.length} rooms · ${gateway.world.teams.length} teams · ${gateway.world.entities.length} entities`
                  : (gateway.world.reason ?? "World summary is unavailable.")}
              </p>
              {gateway.world.available ? (
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {gateway.world.teams
                    .slice(0, 2)
                    .map(
                      (team) =>
                        `${team.label} -> ${team.roomLabel ?? "room n/a"}`,
                    )
                    .join(" · ") || "No team-room mapping yet."}
                </p>
              ) : null}
            </article>

            <article className="rounded-[0.9rem] border border-slate-200 bg-white px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-slate-500">
                  snapshot.skills
                </p>
                <span
                  className={`rounded-full px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] ${structuredStateClasses[gateway.skills.source]}`}
                >
                  {formatStructuredStateSource(gateway.skills.source)}
                </span>
              </div>
              <p className="mt-2 leading-6 text-slate-700">
                {gateway.skills.available
                  ? `${gateway.skills.currentStageBindings.length} current-stage bindings · ${gateway.skills.globalBindings.length} global bindings`
                  : (gateway.skills.reason ?? "Skill summary is unavailable.")}
              </p>
              {gateway.skills.available ? (
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {gateway.skills.currentStageReason ??
                    (gateway.skills.documents
                      .slice(0, 2)
                      .map(
                        (document) => `${document.docId}@${document.version}`,
                      )
                      .join(" · ") ||
                      "No skill document version is visible yet.")}
                </p>
              ) : null}
            </article>
          </div>
        </div>

        <div className="mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
              Receipt Summary
            </p>
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] ${toneClasses[gateway.auditSummary.tone]}`}
            >
              {gateway.auditSummary.label}
            </span>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {gateway.auditSummary.detail}
          </p>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            {gateway.auditSummary.recordCount} records ·{" "}
            {gateway.auditSummary.acceptedCount} accepted ·{" "}
            {gateway.auditSummary.replayedCount} replayed ·{" "}
            {gateway.auditSummary.rejectedCount} rejected ·{" "}
            {gateway.auditSummary.conflictCount} conflict
          </p>
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
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {room.count}
              </p>
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
                  <span className="text-xs text-slate-500">
                    {session.updatedLabel}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {session.roomLabel}
                </p>
                <code className="mt-2 block break-all font-mono text-[0.75rem] leading-6 text-slate-500">
                  {session.sessionKey}
                </code>
              </article>
            ))
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-7 text-slate-500">
              No recent participant sessions yet.
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
          `move` / `say` 会直接打到 agent；`stage` / `start-timer` /
          `lock-submission` 会生成正式 command envelope。命令区现在按 risk
          分级：safe 可直接查看，caution 会提示 live 影响， danger
          需要额外确认；解锁后的 CLI 会附带 `--confirm`，本地 orchestrator
          也会拒绝缺少确认 proof 的危险 mutation。preview stage 下的 live
          mutation 会被禁用或收起。
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
          {commands.map((command) => {
            const key = `${command.label}::${command.command}`;
            const availability = command.availability ?? "ready";
            const risk = command.risk ?? "safe";
            const scope = command.scope ?? "agent";
            const confirmation = command.confirmation;
            const confirmationValue = confirmationValues[key] ?? "";
            const requiresConfirmation =
              availability === "confirm" && confirmation !== undefined;
            const isArmed = armedCommandKey === key;
            const isConfirmed =
              requiresConfirmation &&
              confirmationValue.trim() === confirmation.expectedText;

            return (
              <article
                key={key}
                className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {command.label}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${commandRiskClasses[risk]}`}
                      >
                        {commandRiskLabels[risk]}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${commandAvailabilityClasses[availability]}`}
                      >
                        {commandAvailabilityLabels[availability]}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                        {commandScopeLabels[scope]}
                      </span>
                    </div>
                  </div>
                  {availability === "disabled" && command.blockingReason ? (
                    <span className="max-w-[16rem] rounded-[0.9rem] border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
                      {command.blockingReason}
                    </span>
                  ) : null}
                </div>

                {availability === "disabled" ? (
                  <div className="mt-3 rounded-[0.9rem] border border-dashed border-slate-300 bg-white px-3 py-3 text-sm leading-7 text-slate-500">
                    {command.blockingReason ??
                      "当前状态下这条命令被禁用，避免对 live authority 静默写入。"}
                  </div>
                ) : requiresConfirmation && !isConfirmed ? (
                  <div className="mt-3 rounded-[1rem] border border-rose-200 bg-white p-3">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-rose-700">
                      {confirmation.title}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">
                      {confirmation.description}
                    </p>
                    {!isArmed ? (
                      <button
                        type="button"
                        onClick={() => setArmedCommandKey(key)}
                        className="mt-3 rounded-full border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                      >
                        进入二次确认
                      </button>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <label className="block">
                          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                            {confirmation.challengeLabel}
                          </span>
                          <input
                            type="text"
                            value={confirmationValue}
                            onChange={(event) =>
                              setConfirmationValues((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                            placeholder={confirmation.expectedText}
                            className="mt-2 w-full rounded-[0.9rem] border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:bg-white"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setArmedCommandKey(null);
                              setConfirmationValues((current) => ({
                                ...current,
                                [key]: "",
                              }));
                            }}
                            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                          >
                            取消
                          </button>
                          <span className="rounded-full bg-slate-100 px-3 py-2 font-mono text-[0.72rem] text-slate-500">
                            expected: {confirmation.expectedText}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 rounded-[0.9rem] border border-dashed border-rose-200 bg-rose-50 px-3 py-3 text-sm leading-7 text-rose-800">
                      {isArmed
                        ? "输入确认口令后，命令正文才会解锁显示，并带上 --confirm proof。"
                        : "这条命令在确认完成前保持隐藏，避免预演页误抄 live mutation。"}
                    </div>
                  </div>
                ) : (
                  <code className="mt-3 block whitespace-pre-wrap break-words rounded-[0.9rem] bg-slate-950 px-3 py-3 font-mono text-[0.78rem] leading-6 text-emerald-300">
                    {command.command}
                  </code>
                )}

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {command.note}
                </p>
              </article>
            );
          })}
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
                <span
                  className={`font-mono text-sm uppercase tracking-[0.18em] ${doc.accent}`}
                >
                  {doc.title}
                </span>
                <span className="text-xs text-slate-500">open →</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {doc.summary}
              </p>
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
          `skill.md` 和 `heartbeat.md` 只负责告诉 agent
          如何参与当前活动。当前幕、
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
