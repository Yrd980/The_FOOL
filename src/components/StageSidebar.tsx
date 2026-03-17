import type { StageDefinition } from "../types";

interface StageSidebarProps {
  stages: StageDefinition[];
  activeStageId: string;
  authorityStageId: string | null;
  onSelectStage: (stageId: string) => void;
}

export function StageSidebar({
  stages,
  activeStageId,
  authorityStageId,
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
        十幕就是导演台的总控脚本
      </h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        这不是活动说明页，而是一套随着当前 act 切镜头、切房间、切任务的调度界面。
      </p>
      <div className="mt-4 rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-7 text-slate-600">
        {authorityStageId
          ? `当前已接入平台权威 stage：${authorityStageId}。侧栏会跟随平台状态，而不是只靠本地切幕。`
          : "当前还没有拿到平台权威 stage，侧栏仍使用本地预演切幕。"}
      </div>

      <div className="mt-5 space-y-2">
        {stages.map((stage) => {
          const isActive = stage.id === activeStageId;
          const isAuthority = authorityStageId === stage.id;

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
              disabled={Boolean(authorityStageId)}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">
                  {stage.label}
                </p>
                {isAuthority ? (
                  <span className="rounded-full bg-slate-950 px-2 py-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-white">
                    Authority
                  </span>
                ) : null}
              </div>
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
