import type { ReplayRound } from "../types";

export function PublicVoice({ currentRound }: { currentRound: ReplayRound | null }) {
  return (
    <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#13232f]">Public Voice</h2>
      </div>
      <ul className="space-y-2 lg:max-h-[320px] lg:overflow-y-auto lg:pr-1">
        {(currentRound?.public_messages.length ? currentRound.public_messages : [{ agent_id: "-", message: "暂无公开发言" }]).map((message, index) => (
          <li key={`${message.agent_id}-${index}`} className="rounded-2xl border border-[#dbcfb4] bg-white/70 p-3 text-sm shadow-sm">
            <div className="mb-1 font-mono text-[11px] text-[#5b6a71]">{message.agent_id}</div>
            <div>{message.message}</div>
          </li>
        ))}
      </ul>
    </article>
  );
}
