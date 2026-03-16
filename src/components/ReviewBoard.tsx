import type { ReviewLane } from "../types";

interface ReviewBoardProps {
  reviewLanes: ReviewLane[];
}

export function ReviewBoard({ reviewLanes }: ReviewBoardProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-6">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
          Review System
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          评审、颁奖和共创不是附录，而是主流程后半段
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {reviewLanes.map((lane) => (
            <article
              key={lane.title}
              className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4"
            >
              <h3 className="text-lg font-semibold text-slate-950">{lane.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{lane.summary}</p>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                {lane.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#e01b24]" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      <aside className="rounded-[1.8rem] border border-slate-900 bg-slate-950 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] sm:p-6">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-400">
          Build Direction
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          下一步重点不在视觉海报，而在可运行的选手接入
        </h2>
        <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>把 contestant skill / heartbeat 固化下来，成为外部 agent 的入口。</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>把 gateway 的 session / presence / message 流接成选手状态和观众面板。</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>让 UI 围绕当前 act 和房间切换工作，而不是停留在说明页。</span>
          </li>
        </ul>
      </aside>
    </section>
  );
}
