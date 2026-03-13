import type { ReplayRound } from "../types";

const ERROR_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  schema_validation: { bg: "bg-red-50", border: "border-red-300", text: "text-red-800" },
  schema_repaired: { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-800" },
  decision_generation: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800" }
};

const DEFAULT_COLOR = { bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-800" };

export function ErrorPanel({ currentRound }: { currentRound: ReplayRound | null }) {
  const errors = currentRound?.errors ?? [];
  if (errors.length === 0) return null;

  return (
    <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
      <h2 className="mb-3 text-xl font-semibold text-[#13232f]">Errors</h2>
      <ul className="space-y-2">
        {errors.map((error, index) => {
          const style = ERROR_COLORS[error.type] ?? DEFAULT_COLOR;
          return (
            <li key={index} className={`rounded-xl border ${style.border} ${style.bg} px-3 py-2`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase ${style.text}`}>{error.type}</span>
                <span className="font-mono text-xs text-[#5b6a71]">{error.agent_id}</span>
              </div>
              <p className="mt-1 text-xs text-[#5b6a71]">{error.detail}</p>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
