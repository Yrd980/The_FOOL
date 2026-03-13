import type { SocialRelation } from "../types";
import { signed } from "../utils";

export function RelationCard({
  relation,
  color,
  label,
  onClick
}: {
  relation: SocialRelation;
  color: string;
  label: string;
  onClick: () => void;
}) {
  const events = relation.recent_shared_events.slice(0, 2).join(" · ");
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-[#dbcfb4] bg-white/70 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[11px] text-[#5b6a71]">
        <span>{relation.target_id}</span>
        <span>
          {label} {relation.tension}
        </span>
      </div>
      <div className="mb-2 flex items-center gap-2 font-semibold text-[#13232f]">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span>{relation.target_name}</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-3 font-mono text-[11px]">
        <span className="text-[#0f7f78]">trust {signed(relation.trust)}</span>
        <span className="text-[#0f7f78]">aff {signed(relation.affinity)}</span>
        <span className="text-[#db5b3f]">debt {signed(relation.debt)}</span>
      </div>
      <div className="text-xs leading-5 text-[#5b6a71]">{events || "暂无共享事件"}</div>
    </button>
  );
}
