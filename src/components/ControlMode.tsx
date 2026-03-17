import { IntegrationRail } from "./IntegrationRail";
import { StageSidebar } from "./StageSidebar";
import { StageWorkspace } from "./StageWorkspace";
import { buildFocusRooms, rankContestants } from "../presentation";
import type {
  GatewayOverview,
  IntegrationDoc,
  OperatorCommand,
  StageDefinition,
  StageRuntimeGuide,
  SummaryStat,
} from "../types";

interface ControlModeProps {
  stage: StageDefinition;
  stages: StageDefinition[];
  activeStageId: string;
  onSelectStage: (stageId: string) => void;
  runtimeGuide: StageRuntimeGuide;
  gateway: GatewayOverview;
  summaryStats: SummaryStat[];
  docs: IntegrationDoc[];
  commands: OperatorCommand[];
}

export function ControlMode({
  stage,
  stages,
  activeStageId,
  onSelectStage,
  runtimeGuide,
  gateway,
  summaryStats,
  docs,
  commands,
}: ControlModeProps) {
  const focusRooms = buildFocusRooms(runtimeGuide, gateway);
  const contestants = rankContestants(gateway, runtimeGuide);
  const leadContestant = contestants[0] ?? null;

  return (
    <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-900 bg-[linear-gradient(135deg,#190d10_0%,#111827_55%,#111318_100%)] text-white shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(21rem,0.7fr)] lg:px-8 lg:py-8">
          <div>
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-rose-300/80">
              Director Deck
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              当前总控幕是 {stage.label} / {stage.title}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              这里不是普通 dashboard，而是导演台。左边切幕，中间看选手和房间，右边处理
              OpenClaw 连线、操作脚本和接入文档。
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Live Sessions
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {gateway.totalActiveSessions}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  当前被导播台看见的 OpenClaw 会话总数。
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Focus Rooms
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {focusRooms.reduce((sum, room) => sum + room.count, 0)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  本幕焦点房间总活跃数，决定导演镜头该往哪里压。
                </p>
              </article>
              <article className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                  Gateway Line
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {gateway.connectionState}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {gateway.statusMessage}
                </p>
              </article>
            </div>
          </div>

          <div className="space-y-4">
            <article className="rounded-[1.4rem] border border-rose-400/20 bg-rose-500/10 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-rose-200">
                Current Cue
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {runtimeGuide.operatorHint}
              </p>
              <p className="mt-3 text-sm leading-7 text-rose-100/80">
                {runtimeGuide.successSignal}
              </p>
            </article>

            <article className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-400">
                Director Watchlist
              </p>
              {leadContestant ? (
                <>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold text-white">
                      {leadContestant.agentId}
                    </h3>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-300">
                      {leadContestant.attentionLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    {leadContestant.attentionNote}
                  </p>
                  <p className="mt-4 rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm leading-7 text-slate-200">
                    {leadContestant.recentActivity?.content ??
                      "这位选手还没留下最新台词，先让 heartbeat 把它重新推醒。"}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  还没有选手进入总控视野。等 gateway 真正收到房间会话后，导演待办会从这里长出来。
                </p>
              )}
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[18rem,minmax(0,1fr),24rem]">
        <StageSidebar
          stages={stages}
          activeStageId={activeStageId}
          onSelectStage={onSelectStage}
        />
        <StageWorkspace
          stage={stage}
          runtimeGuide={runtimeGuide}
          summaryStats={summaryStats}
          gateway={gateway}
        />
        <IntegrationRail
          docs={docs}
          commands={commands}
          gateway={gateway}
        />
      </section>
    </main>
  );
}
