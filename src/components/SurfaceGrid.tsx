import type { ProductSurface } from "../types";

interface SurfaceGridProps {
  surfaces: ProductSurface[];
}

export function SurfaceGrid({ surfaces }: SurfaceGridProps) {
  return (
    <section
      id="surfaces"
      className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-6"
    >
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
        Product Surfaces
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
        这不是活动海报，而是一套可以继续长大的产品结构
      </h2>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
        `asset/task.md` 说的是舞台和流程，真正的产品要把它拆成几个持续运行的面：
        主舞台、选手面板、观众噪声、队伍房间、提交板、评审板，以及 OpenClaw 接入层。
      </p>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {surfaces.map((surface) => (
          <article
            key={surface.title}
            className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4"
          >
            <h3 className="text-lg font-semibold text-slate-950">{surface.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{surface.summary}</p>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
              {surface.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-500" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
