import { useState } from "react";
import type { HydratedReplay, ReplayRound } from "../types";

export type AiShowcase = {
  activeSpeakers: number;
  directThreads: number;
  personaVoices: number;
  topPublicSpeaker: string;
  topPublicLine: string;
};

export function ArtMission({
  currentReplay,
  currentRound,
  aiShowcase: _aiShowcase,
  compositionNotes
}: {
  currentReplay: HydratedReplay | null;
  currentRound: ReplayRound | null;
  aiShowcase: AiShowcase;
  compositionNotes: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const themePrompt = currentReplay?.art_direction.theme_prompt || currentReplay?.config.myth_prompt || "";

  return (
    <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-3 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 rounded-full bg-[#0f7f78]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f7f78]">
            {currentReplay?.art_direction.title || "Theme"}
          </span>
          <span className="truncate text-sm text-[#13232f]">{themePrompt || "—"}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-[#13232f] px-2.5 py-0.5 font-mono text-[11px] text-[#f3f8fb]">
            {currentReplay?.config.dry_run ? "dry-run" : currentReplay?.config.model || "live"}
          </span>
          <span className="text-xs text-[#5b6a71]">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded ? (
        <div className="mt-3 rounded-2xl border border-[#dbcfb4] bg-white/75 p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#13232f]/8 px-3 py-1 text-[11px] font-mono text-[#5b6a71]">
              {currentRound?.art_phase ? `${currentRound.art_phase.label} · ${currentRound.art_phase.focus}` : "AI theatre"}
            </span>
          </div>
          <p className="text-sm leading-6 text-[#13232f]">{themePrompt || "当前 replay 未提供主题提示词。"}</p>

          {currentReplay?.art_direction.mood_words?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {currentReplay.art_direction.mood_words.map((word) => (
                <span key={word} className="rounded-full border border-[#dbcfb4] bg-white px-2.5 py-0.5 text-xs text-[#5b6a71]">
                  {word}
                </span>
              ))}
            </div>
          ) : null}

          {currentReplay?.art_direction.motifs?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {currentReplay.art_direction.motifs.map((motif) => (
                <span key={motif} className="rounded-full bg-[#db5b3f]/10 px-2.5 py-0.5 text-xs text-[#db5b3f]">
                  {motif}
                </span>
              ))}
            </div>
          ) : null}

          {currentReplay?.art_direction.palette?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {currentReplay.art_direction.palette.map((color) => (
                <span key={color} className="inline-flex items-center gap-1.5 rounded-full border border-[#dbcfb4] bg-white px-2.5 py-0.5 text-xs text-[#5b6a71]">
                  <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: color }} />
                  {color}
                </span>
              ))}
            </div>
          ) : null}

          {compositionNotes.length ? (
            <div className="mt-3 space-y-1.5">
              {compositionNotes.map((note) => (
                <div key={note} className="rounded-xl bg-[#13232f]/5 px-3 py-1.5 text-sm text-[#3b4a51]">
                  {note}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
