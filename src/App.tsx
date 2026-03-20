import type { ReactNode } from "react";
import { useGatewayOverview } from "./openclaw/useGatewayOverview";

const cardClass =
  "rounded-3xl border border-slate-200/80 bg-white/88 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur";
const subtleCardClass =
  "rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4";

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
}

function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <article className={subtleCardClass}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </article>
  );
}

interface SectionProps {
  title: string;
  detail: string;
  children: ReactNode;
}

function Section({ title, detail, children }: SectionProps) {
  return (
    <section className={cardClass}>
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="text-sm leading-6 text-slate-600">{detail}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function App() {
  const gateway = useGatewayOverview();
  const currentPath =
    typeof window === "undefined" ? "/" : window.location.pathname || "/";
  const activityTemplateId = gateway.activityRun?.templateId ?? "unconfigured";
  const activeStageId = gateway.activityRun?.currentStageId ?? "pending";
  const activeTimer =
    gateway.activeTimer && gateway.activeTimer.state !== "idle"
      ? gateway.activeTimer.state + " · " + gateway.activeTimer.remainingLabel
      : "No active timer";
  const activityRunId = gateway.activityRun?.id ?? "<activity-run-id>";
  const scoreLeader = gateway.scoreSummary[0]?.targetId ?? "No score summary yet.";

  return (
    <main className="min-h-screen px-4 py-8 text-slate-950 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className={cardClass}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-rose-600">
                OpenClaw Local Platform
              </p>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Browser UI has been reduced to a backend status shell.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  This worktree now treats the orchestrator, activity registry, and CLI as the
                  product surface. The browser stays read-only and only reports platform truth,
                  bootstrap state, and operator entrypoints.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  href="/docs/README.md"
                >
                  Read platform docs
                </a>
                <a
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  href="/skill.md"
                >
                  Open activity handoff docs
                </a>
              </div>
            </div>

            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
              <StatCard
                label="Gateway"
                value={gateway.configured ? gateway.connectionState : "disabled"}
                detail={gateway.gatewayUrl ?? "No VITE_OPENCLAW_URL configured."}
              />
              <StatCard
                label="Authority Query"
                value={gateway.orchestratorQuery.statusLabel}
                detail={gateway.orchestratorQuery.reason ?? gateway.orchestratorQuery.freshnessLabel}
              />
              <StatCard
                label="Template"
                value={activityTemplateId}
                detail={"Current stage: " + activeStageId}
              />
              <StatCard
                label="Timer"
                value={activeTimer}
                detail={"Last sequence: " + (gateway.lastSequence ?? "none")}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Section title="Platform Status" detail={gateway.statusMessage}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className={subtleCardClass}>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Bootstrap
                </p>
                <dl className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Path</dt>
                    <dd className="text-right font-mono text-xs">{currentPath}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Activity Run</dt>
                    <dd className="text-right font-medium">
                      {gateway.activityRun?.id ?? "pending"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Stage</dt>
                    <dd className="text-right font-medium">
                      {gateway.authorityStageId ?? "pending"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Contract</dt>
                    <dd className="text-right font-medium">
                      {gateway.orchestrationContractStatus}
                    </dd>
                  </div>
                </dl>
                {gateway.orchestrationContractNote ? (
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {gateway.orchestrationContractNote}
                  </p>
                ) : null}
              </div>

              <div className={subtleCardClass}>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Backend Health
                </p>
                <p className="mt-4 text-2xl font-semibold text-slate-950">
                  {gateway.backendHealth.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {gateway.backendHealth.detail}
                </p>
                <p className="mt-4 text-sm text-slate-500">
                  {"Source: " + gateway.backendHealth.source + " · " + gateway.backendHealth.freshnessLabel}
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="Operator Entry"
            detail="The browser no longer carries control workflows. Use docs plus the local CLI/orchestrator commands instead."
          >
            <div className="space-y-3 text-sm leading-6 text-slate-700">
              <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
                {"bun run openclaw:orchestrator\\n" +
                  "bun run openclaw:control -- probe\\n" +
                  "bun run openclaw:control -- snapshot " +
                  activityRunId +
                  "\\n" +
                  "bun run openclaw:control -- events " +
                  activityRunId +
                  " --limit 10"}
              </pre>
              <p>
                Explicit bootstrap and template selection now belongs to local backend config and
                env overrides, not the browser shell.
              </p>
              {gateway.gatewayWarning ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                  {gateway.gatewayWarning}
                </p>
              ) : null}
            </div>
          </Section>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Section
            title="Authority World"
            detail="Room and team placement now lives in the authoritative world projection."
          >
            <div className="space-y-3">
              {gateway.world.rooms.length > 0 ? (
                gateway.world.rooms.map((room) => (
                  <div key={room.roomId} className={subtleCardClass}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-950">{room.label}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {room.roomId}
                        </p>
                      </div>
                      <div className="text-right text-sm text-slate-600">
                        <p>{room.teamCount + " teams"}</p>
                        <p>{room.occupantCount + " entities"}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No authority world rooms available yet.</p>
              )}
            </div>
          </Section>

          <Section
            title="Recent Writes"
            detail="Submission, score, and award counts come straight from authority projections."
          >
            <div className="grid gap-3">
              <StatCard
                label="Sessions"
                value={String(gateway.totalActiveSessions)}
                detail="Active websocket sessions currently visible to the browser shell."
              />
              <StatCard
                label="Submissions"
                value={gateway.lockedSubmissionCount + "/" + gateway.totalSubmissionCount}
                detail="Locked versus total submission records."
              />
              <StatCard
                label="Scores"
                value={String(gateway.scores.length)}
                detail={"Leader: " + scoreLeader}
              />
              <StatCard
                label="Awards"
                value={String(gateway.awards.length)}
                detail={gateway.awards[0]?.label ?? "No awards granted yet."}
              />
            </div>
          </Section>

          <Section
            title="Audit Pulse"
            detail="Latest audit records are kept visible here so the shell still proves backend activity."
          >
            <div className="space-y-3">
              {gateway.recentAuditRecords.length > 0 ? (
                gateway.recentAuditRecords.slice(0, 6).map((record) => (
                  <div key={record.id} className={subtleCardClass}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-950">{record.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{record.detail}</p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        {record.status}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No audit records have been read yet.</p>
              )}
            </div>
          </Section>
        </section>
      </div>
    </main>
  );
}

export default App;
