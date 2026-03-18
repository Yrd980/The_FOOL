import type { ActivityViewModel, GatewayOverview, StageDefinition } from "../types";

interface ControlHeaderProps {
  mode: "control" | "show";
  onSelectMode: (mode: "control" | "show") => void;
  activity: ActivityViewModel;
  activeStage: StageDefinition;
  gateway: GatewayOverview;
}

const modeCopy = {
  control: {
    eyebrow: "Director Console",
    title: "Molt Claw / 调度与监看同屏",
    shell: "border-[#e01b24] bg-[#111318]/94",
    buttonActive: "bg-[#e01b24] text-white shadow-[0_12px_30px_rgba(224,27,36,0.35)]",
    buttonIdle: "bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white",
  },
  show: {
    eyebrow: "Live Show Feed",
    title: "Molt Claw / OpenClaw 正在把节目推到台前",
    shell: "border-fuchsia-400/30 bg-[#09090f]/94",
    buttonActive: "bg-white text-slate-950 shadow-[0_12px_30px_rgba(255,255,255,0.2)]",
    buttonIdle: "bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white",
  },
} as const;

export function ControlHeader({
  mode,
  onSelectMode,
  activity,
  activeStage,
  gateway,
}: ControlHeaderProps) {
  const copy = modeCopy[mode];
  const liveLabel =
    gateway.connectionState === "connected" && gateway.totalActiveSessions > 0
      ? "Live"
      : gateway.connectionState === "connected"
        ? "Standby"
        : gateway.connectionState === "authenticating" || gateway.connectionState === "connecting"
          ? "Linking"
          : "Offline";

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur ${copy.shell}`}>
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">
              {copy.eyebrow}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {copy.title}
              </h1>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/12 px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-emerald-300">
                OpenClaw Ready
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectMode("show")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "show" ? copy.buttonActive : copy.buttonIdle
              }`}
            >
              Show Mode
            </button>
            <button
              type="button"
              onClick={() => onSelectMode("control")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "control" ? copy.buttonActive : copy.buttonIdle
              }`}
            >
              Control Mode
            </button>
            <a
              href="/skill.md"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/6 hover:text-white"
            >
              skill.md
            </a>
            <a
              href="/task.md"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/6 hover:text-white"
            >
              task.md
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">
            {activity.badgeLabel}
          </p>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-300">
            {activeStage.label} / {activeStage.title}
          </span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-300">
            {gateway.totalActiveSessions} live sessions
          </span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-300">
            {liveLabel}
          </span>
        </div>
      </div>
    </header>
  );
}
