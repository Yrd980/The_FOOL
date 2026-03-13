import type { ReplayRound } from "../types";

export function PersonaNotes({ currentRound }: { currentRound: ReplayRound | null }) {
  return (
    <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#13232f]">Persona Notes</h2>
      </div>
      <ul className="space-y-2">
        {(currentRound?.persona_notes.length
          ? currentRound.persona_notes
          : [{ agent_id: "-", note: "暂无人格注释", proactive_score: 0 }]
        ).map((note) => (
          <li key={note.agent_id} className="rounded-2xl border border-[#dbcfb4] bg-white/70 p-3 text-sm shadow-sm">
            <div className="mb-1 font-mono text-[11px] text-[#5b6a71]">{note.agent_id}</div>
            <div>{note.note}</div>
            <div className="mt-2 font-mono text-xs text-[#0f7f78]">active {note.proactive_score}</div>
          </li>
        ))}
      </ul>
    </article>
  );
}
