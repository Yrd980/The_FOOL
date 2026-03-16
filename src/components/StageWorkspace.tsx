import type { StageDefinition, SummaryStat } from "../types";

interface StageWorkspaceProps {
  stage: StageDefinition;
  summaryStats: SummaryStat[];
}

export function StageWorkspace({
  stage,
  summaryStats,
}: StageWorkspaceProps) {
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
      </div>
    </section>
  );
}
