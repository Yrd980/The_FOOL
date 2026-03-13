import type { ReplayRound, Frame, HydratedReplay } from "../types";
import { cn } from "../utils";
import { MetricCard } from "./MetricCard";

export type RankingItem = {
  id: string;
  cells: number;
  delta: number;
  score: number;
  share: number;
};

export function RoundPulse({
  currentRound,
  frame,
  currentReplay,
  rankingItems,
  selectedLensAgentId,
  setSelectedLensAgentId
}: {
  currentRound: ReplayRound | null;
  frame: Frame | null;
  currentReplay: HydratedReplay | null;
  rankingItems: RankingItem[];
  selectedLensAgentId: string;
  setSelectedLensAgentId: (id: string) => void;
}) {
  const metrics = currentRound?.round_metrics ?? {
    expanded: 0,
    attacked: 0,
    treaties_signed: 0,
    public_messages: 0,
    private_messages: 0
  };

  const socialMetrics = currentRound?.social_metrics ?? {
    alliance_links: 0,
    rivalry_links: 0,
    max_tension: 0,
    avg_trust: 0,
    avg_debt: 0
  };

  return (
    <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[#13232f]">Round Pulse</h2>
        <span className="font-mono text-xs text-[#5b6a71]">
          {currentRound?.art_phase ? `${currentRound.art_phase.label} · ${currentRound.art_phase.focus}` : "social + territory"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard label="Expanded" value={metrics.expanded} />
        <MetricCard label="Attacked" value={metrics.attacked} />
        <MetricCard label="Treaties" value={metrics.treaties_signed} />
        <MetricCard label="Public Msg" value={metrics.public_messages} />
        <MetricCard label="Private Msg" value={metrics.private_messages} />
        <MetricCard label="Occupied" value={frame ? [...frame.territory.values()].reduce((sum, value) => sum + value, 0) : 0} />
      </div>

      <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f7f78]">Top Ranking</h3>
      <ol className="mt-3 space-y-2">
        {rankingItems.map((item) => {
          const color = currentReplay?.colorMap.get(item.id) || "#999";
          const deltaClass = item.delta > 0 ? "text-[#0f7f78]" : item.delta < 0 ? "text-[#db5b3f]" : "text-[#5b6a71]";
          const deltaText = item.delta > 0 ? `+${item.delta}` : `${item.delta}`;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelectedLensAgentId(item.id)}
                className={cn(
                  "w-full rounded-2xl px-3 py-3 text-left transition",
                  selectedLensAgentId === item.id ? "bg-[#0f7f78]/10 shadow-sm" : "hover:bg-white/70"
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-3 font-mono text-xs">
                  <span className="flex items-center gap-2 text-[#13232f]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    {item.id}
                  </span>
                  <span>
                    <span className={deltaClass}>{deltaText}</span> · {item.cells}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#13232f]/10">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(1, item.share).toFixed(2)}%`, background: color }} />
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f7f78]">Social Heat</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Alliances" value={socialMetrics.alliance_links} />
        <MetricCard label="Rivalries" value={socialMetrics.rivalry_links} />
        <MetricCard label="Max Tension" value={socialMetrics.max_tension} />
        <MetricCard label="Avg Trust" value={socialMetrics.avg_trust} />
        <MetricCard label="Avg Debt" value={socialMetrics.avg_debt} />
      </div>
    </article>
  );
}
