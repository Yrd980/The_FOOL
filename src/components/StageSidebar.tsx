import type { StageDefinition } from "../types";

interface StageSidebarProps {
  stages: StageDefinition[];
  activeStageId: string;
  onSelectStage: (stageId: string) => void;
}

export function StageSidebar({
  stages,
  activeStageId,
  onSelectStage,
}: StageSidebarProps) {
  return (
    <aside
      id="stages"
      className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
    >
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
        Stage Flow
      </p>
      <h2 className="mt-3 text-lg font-semibold text-slate-950">
        十幕是产品主状态机
      </h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        页面不是静态活动介绍，而是围绕当前 act 切换的控制面板。
      </p>

      <div className="mt-5 space-y-2">
        {stages.map((stage) => {
          const isActive = stage.id === activeStageId;

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage(stage.id)}
              className={`w-full rounded-[1.2rem] border px-3 py-3 text-left transition ${
                isActive
                  ? "border-[#e01b24] bg-[#fff1f2] shadow-[0_12px_30px_rgba(224,27,36,0.12)]"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                {stage.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {stage.title}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                {stage.summary}
              </p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
