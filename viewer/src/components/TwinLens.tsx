import type { HydratedReplay, Frame, ReplayRound } from "../types";
import { RelationCard } from "./RelationCard";

export function TwinLens({
  currentReplay,
  frame,
  lensSnapshot,
  selectedLensAgentId,
  setSelectedLensAgentId
}: {
  currentReplay: HydratedReplay | null;
  frame: Frame | null;
  lensSnapshot: NonNullable<ReplayRound["social_snapshot"]>[number] | null;
  selectedLensAgentId: string;
  setSelectedLensAgentId: (id: string) => void;
}) {
  return (
    <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md lg:max-h-[680px] lg:overflow-y-auto">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#13232f]">Twin Lens</h2>
        <select
          className="rounded-xl border border-[#dbcfb4] bg-white/80 px-3 py-2 text-sm shadow-sm"
          value={lensSnapshot?.agent_id ?? selectedLensAgentId}
          onChange={(event) => setSelectedLensAgentId(event.target.value)}
        >
          {(currentReplay?.agentDirectory || []).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
              {entry.archetype ? ` · ${entry.archetype}` : ""}
            </option>
          ))}
        </select>
      </div>

      {lensSnapshot ? (
        <>
          <div className="rounded-2xl border border-[#dbcfb4] bg-white/75 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#13232f]">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: currentReplay?.colorMap.get(lensSnapshot.agent_id) || lensSnapshot.color || "#999" }}
              />
              {lensSnapshot.name}
            </div>
            <div className="mb-2 flex flex-wrap gap-2 font-mono text-[11px] text-[#5b6a71]">
              <span>{lensSnapshot.agent_id}</span>
              <span>{lensSnapshot.archetype}</span>
              <span>cells {frame?.territory.get(lensSnapshot.agent_id) || 0}</span>
            </div>
            <p className="text-sm leading-6 text-[#3b4a51]">
              {lensSnapshot.last_round_summary || "这一回合还没有形成足够明确的人际摘要。"}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {([
                ["anger", lensSnapshot.emotion.anger],
                ["fear", lensSnapshot.emotion.fear],
                ["confidence", lensSnapshot.emotion.confidence],
                ["satisfaction", lensSnapshot.emotion.satisfaction]
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#13232f]/5 p-3">
                  <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-[#5b6a71]">{label}</div>
                  <div className="font-mono text-sm text-[#13232f]">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f7f78]">Strong Bonds</h3>
              <div className="space-y-2">
                {lensSnapshot.strongest_bonds.length > 0 ? (
                  lensSnapshot.strongest_bonds.map((relation) => (
                    <RelationCard
                      key={`bond-${relation.target_id}`}
                      relation={relation}
                      color={currentReplay?.colorMap.get(relation.target_id) || "#999"}
                      label="bond"
                      onClick={() => setSelectedLensAgentId(relation.target_id)}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-[#dbcfb4] bg-white/70 p-3 text-sm text-[#5b6a71] shadow-sm">暂无明显盟友</div>
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#db5b3f]">Hot Rivalries</h3>
              <div className="space-y-2">
                {lensSnapshot.hottest_rivalries.length > 0 ? (
                  lensSnapshot.hottest_rivalries.map((relation) => (
                    <RelationCard
                      key={`rival-${relation.target_id}`}
                      relation={relation}
                      color={currentReplay?.colorMap.get(relation.target_id) || "#999"}
                      label="heat"
                      onClick={() => setSelectedLensAgentId(relation.target_id)}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-[#dbcfb4] bg-white/70 p-3 text-sm text-[#5b6a71] shadow-sm">暂无明显宿敌</div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-[#dbcfb4] bg-white/70 p-4 text-sm text-[#5b6a71] shadow-sm">当前 replay 不包含社交快照。</div>
      )}
    </article>
  );
}
