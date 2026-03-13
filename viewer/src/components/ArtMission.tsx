import type { HydratedReplay, ReplayRound } from "../types";
import { MetricCard } from "./MetricCard";

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
  aiShowcase,
  compositionNotes
}: {
  currentReplay: HydratedReplay | null;
  currentRound: ReplayRound | null;
  aiShowcase: AiShowcase;
  compositionNotes: string[];
}) {
  const themePrompt = currentReplay?.art_direction.theme_prompt || currentReplay?.config.myth_prompt || "";

  return (
    <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[#13232f]">AI Mission</h2>
        <div className="rounded-full bg-[#13232f] px-3 py-1 font-mono text-xs text-[#f3f8fb]">
          {currentReplay?.config.dry_run ? "dry-run" : currentReplay?.config.model || "live"}
        </div>
      </div>

      <div className="rounded-2xl border border-[#dbcfb4] bg-white/75 p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#0f7f78]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f7f78]">
            {currentReplay?.art_direction.title || "Theme"}
          </span>
          <span className="rounded-full bg-[#13232f]/8 px-3 py-1 text-[11px] font-mono text-[#5b6a71]">
            {currentRound?.art_phase ? `${currentRound.art_phase.label} · ${currentRound.art_phase.focus}` : "AI theatre"}
          </span>
        </div>
        <p className="text-sm leading-6 text-[#13232f]">
          {themePrompt || "当前 replay 未提供主题提示词。"}
        </p>

        {currentReplay?.art_direction.mood_words?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {currentReplay.art_direction.mood_words.map((word) => (
              <span key={word} className="rounded-full border border-[#dbcfb4] bg-white px-3 py-1 text-xs text-[#5b6a71]">
                {word}
              </span>
            ))}
          </div>
        ) : null}

        {currentReplay?.art_direction.motifs?.length ? (
          <div className="mt-4">
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#5b6a71]">Motifs</div>
            <div className="flex flex-wrap gap-2">
              {currentReplay.art_direction.motifs.map((motif) => (
                <span key={motif} className="rounded-full bg-[#db5b3f]/10 px-3 py-1 text-xs text-[#db5b3f]">
                  {motif}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {currentReplay?.art_direction.palette?.length ? (
          <div className="mt-4">
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#5b6a71]">Palette</div>
            <div className="flex flex-wrap gap-2">
              {currentReplay.art_direction.palette.map((color) => (
                <div key={color} className="flex items-center gap-2 rounded-full border border-[#dbcfb4] bg-white px-3 py-1 text-xs text-[#5b6a71]">
                  <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: color }} />
                  {color}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {compositionNotes.length ? (
          <div className="mt-4 space-y-2">
            {compositionNotes.map((note) => (
              <div key={note} className="rounded-2xl bg-[#13232f]/5 px-3 py-2 text-sm text-[#3b4a51]">
                {note}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Active Voices" value={aiShowcase.activeSpeakers} />
        <MetricCard label="Direct Threads" value={aiShowcase.directThreads} />
        <MetricCard label="Persona Notes" value={aiShowcase.personaVoices} />
        <MetricCard label="Model" value={currentReplay?.config.model || "-"} />
      </div>

      {aiShowcase.topPublicLine ? (
        <div className="mt-3 rounded-2xl border border-[#dbcfb4] bg-white/70 p-4 shadow-sm">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#5b6a71]">
            Lead Voice · {aiShowcase.topPublicSpeaker}
          </div>
          <div className="text-sm leading-6 text-[#13232f]">{aiShowcase.topPublicLine}</div>
        </div>
      ) : null}
    </article>
  );
}
