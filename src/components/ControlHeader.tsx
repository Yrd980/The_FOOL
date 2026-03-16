export function ControlHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-4 border-[#e01b24] bg-[#17181b]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">
            The Fool / Non-Human Hackathon
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Molt Claw Product Control Deck
            </h1>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/12 px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-emerald-300">
              OpenClaw Ready
            </span>
          </div>
        </div>

        <nav className="hidden items-center gap-2 lg:flex">
          <a
            href="#stages"
            className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/6 hover:text-white"
          >
            Stages
          </a>
          <a
            href="#surfaces"
            className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/6 hover:text-white"
          >
            Product Surfaces
          </a>
          <a
            href="#integration"
            className="rounded-full px-3 py-2 text-sm text-slate-300 transition hover:bg-white/6 hover:text-white"
          >
            OpenClaw Integration
          </a>
          <a
            href="/skill.md"
            className="rounded-full bg-[#e01b24] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#f53d46]"
          >
            Read skill.md
          </a>
        </nav>
      </div>
    </header>
  );
}
