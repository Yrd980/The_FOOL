import type { GatewayOverview } from "../../types";

interface BackendEvidencePanelsProps {
  gateway: GatewayOverview;
}

export function BackendEvidencePanels({
  gateway,
}: BackendEvidencePanelsProps) {
  return (
    <>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
            Backend Availability
          </p>
          <p className="mt-3 text-xl font-semibold text-slate-950">
            {gateway.orchestratorQuery.statusLabel}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {gateway.orchestratorQuery.reason ??
              gateway.orchestratorQuery.freshnessLabel}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {gateway.orchestratorQuery.source} · {gateway.orchestratorQuery.freshnessLabel}
          </p>
        </article>

        <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
            Latest Receipt
          </p>
          <p className="mt-3 text-xl font-semibold text-slate-950">
            {gateway.auditSummary.latestRecord?.statusLabel ?? gateway.auditSummary.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {gateway.auditSummary.latestRecord?.detail ?? gateway.auditSummary.detail}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {gateway.auditSummary.recordCount} records · {gateway.auditSummary.acceptedCount} accepted · {gateway.auditSummary.replayedCount} replayed · {gateway.auditSummary.rejectedCount} rejected · {gateway.auditSummary.conflictCount} conflict
          </p>
        </article>

        <article className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
            Backend Health
          </p>
          <p className="mt-3 text-xl font-semibold text-slate-950">
            {gateway.backendHealth.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {gateway.backendHealth.detail}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {gateway.backendHealth.freshnessLabel}
            {gateway.backendHealth.agentCount > 0
              ? ` · ${gateway.backendHealth.agentCount} agents`
              : ""}
          </p>
        </article>
      </div>

      <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
              Recent Audit Trail
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {gateway.auditSummary.detail}
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
            {gateway.recentAuditRecords.length} records
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
              Audit Summary
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {gateway.auditSummary.label}
            </p>
            <p className="text-xs text-slate-500">
              {gateway.auditSummary.error ?? "latest receipt-ish evidence from authoritative audit"}
            </p>
          </article>
          <article className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
              Accepted
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {gateway.auditSummary.acceptedCount}
            </p>
            <p className="text-xs text-slate-500">recent accepted receipts</p>
          </article>
          <article className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
              Replayed
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {gateway.auditSummary.replayedCount}
            </p>
            <p className="text-xs text-slate-500">recent replayed receipts</p>
          </article>
          <article className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-slate-500">
              Rejected / Conflict
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {gateway.auditSummary.rejectedCount + gateway.auditSummary.conflictCount}
            </p>
            <p className="text-xs text-slate-500">recent backend blocks</p>
          </article>
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
                    {record.title}
                  </span>
                  <span>•</span>
                  <span>{record.handledLabel}</span>
                  <span>•</span>
                  <span>{record.emittedSequenceLabel}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">
                  {record.actorRole} / {record.actorId}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {record.detail}
                </p>
                <p className="mt-1 break-all text-xs leading-6 text-slate-500">
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
              Backend Health Evidence
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              snapshot.health、authoritative query、audit 三条证据线在这里汇总，方便导演判断 backend 现在到底是不是稳的。
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
            {gateway.backendHealth.label}
          </span>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {gateway.backendHealth.evidence.map((item) => (
            <article
              key={item.id}
              className="rounded-[1.1rem] border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono uppercase tracking-[0.16em]">
                  {item.title}
                </span>
                {item.timestampLabel ? (
                  <>
                    <span>•</span>
                    <span>{item.timestampLabel}</span>
                  </>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">{item.detail}</p>
            </article>
          ))}
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
              还没有收到 live room chat event。等 participant agent 通过 OpenClaw 说话之后，这里会开始滚动。
            </div>
          )}
        </div>
      </div>
    </>
  );
}
