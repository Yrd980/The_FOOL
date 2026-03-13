import type { ReplayRound } from "../types";

export function PrivateWire({ currentRound }: { currentRound: ReplayRound | null }) {
  return (
    <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#13232f]">Private Wire</h2>
      </div>
      <ul className="space-y-2 lg:max-h-[320px] lg:overflow-y-auto lg:pr-1">
        {(currentRound?.private_messages.length
          ? currentRound.private_messages
          : [{ from: "-", to: "-", content: "暂无私聊" }]
        ).map((message, index) => (
          <li key={`${message.from}-${message.to}-${index}`} className="rounded-2xl border border-[#dbcfb4] bg-white/70 p-3 text-sm shadow-sm">
            <div className="mb-1 font-mono text-[11px] text-[#5b6a71]">
              {message.from} -&gt; {message.to}
            </div>
            <div>{message.content}</div>
          </li>
        ))}
      </ul>
    </article>
  );
}
