import { useCallback, useEffect, useMemo, useState } from "react";

import { useReplayData } from "./hooks/useReplayData";
import { usePlaybackControl } from "./hooks/usePlaybackControl";
import { useCanvasRenderer } from "./hooks/useCanvasRenderer";
import { ArtMission } from "./components/ArtMission";
import { BattleCanvas } from "./components/BattleCanvas";
import { RoundPulse } from "./components/RoundPulse";
import { PublicVoice } from "./components/PublicVoice";
import { PrivateWire } from "./components/PrivateWire";
import { PersonaNotes } from "./components/PersonaNotes";
import { TwinLens } from "./components/TwinLens";
import { ErrorPanel } from "./components/ErrorPanel";

export function App() {
  const {
    replays,
    currentReplay,
    currentReplayName,
    frames,
    followLatest,
    setFollowLatest,
    errorText,
    schemaWarning,
    loadReplay: rawLoadReplay,
    loadReplayList: rawLoadReplayList,
    filterMode,
    setFilterMode,
    filterAgentsMin,
    setFilterAgentsMin
  } = useReplayData();

  const {
    roundIndex,
    setRoundIndex,
    revealedStepCount,
    setRevealedStepCount,
    revealedStepUpdateCount: _revealedStepUpdateCount,
    setRevealedStepUpdateCount,
    isPlaying,
    setIsPlaying,
    speed,
    setSpeed,
    loop,
    setLoop,
    setWatchHint,
    frame,
    previousFrame,
    currentRound,
    currentActionSteps,
    totalStepUpdates,
    revealedUpdateCount,
    revealPercent,
    activePlaybackStep,
    visibleStepCount,
    totalActionSteps,
    activeStepLabel,
    watchStateText
  } = usePlaybackControl(frames, followLatest, currentReplay);

  const { canvasRef } = useCanvasRenderer(
    currentReplay,
    frame,
    previousFrame,
    currentActionSteps,
    revealedStepCount,
    activePlaybackStep,
    _revealedStepUpdateCount
  );

  const [selectedLensAgentId, setSelectedLensAgentId] = useState("");

  const loadReplay = useCallback(
    async (name: string, options?: { autoPlay?: boolean; hint?: string }) => {
      const result = await rawLoadReplay(name, options);
      setRoundIndex(0);
      setRevealedStepCount(result.initialStepCount);
      setRevealedStepUpdateCount(0);
      setWatchHint(result.hint);
      setSelectedLensAgentId((previous) => {
        if (previous && result.hydrated.agentDirectory.some((item) => item.id === previous)) return previous;
        return result.hydrated.ranking[0]?.agent_id ?? result.hydrated.agentDirectory[0]?.id ?? "";
      });
      if (result.shouldAutoPlay) {
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    },
    [rawLoadReplay, setRoundIndex, setRevealedStepCount, setRevealedStepUpdateCount, setWatchHint, setIsPlaying]
  );

  const loadReplayList = useCallback(
    async (options?: { autoSwitchLatest?: boolean; preserveSelection?: boolean; silent?: boolean }) => {
      const result = await rawLoadReplayList(options);
      if (result) {
        setRoundIndex(0);
        setRevealedStepCount(result.initialStepCount);
        setRevealedStepUpdateCount(0);
        setWatchHint(result.hint);
        setSelectedLensAgentId((previous) => {
          if (previous && result.hydrated.agentDirectory.some((item) => item.id === previous)) return previous;
          return result.hydrated.ranking[0]?.agent_id ?? result.hydrated.agentDirectory[0]?.id ?? "";
        });
        if (result.shouldAutoPlay) {
          setIsPlaying(true);
        } else {
          setIsPlaying(false);
        }
      }
    },
    [rawLoadReplayList, setRoundIndex, setRevealedStepCount, setRevealedStepUpdateCount, setWatchHint, setIsPlaying]
  );

  const rankingItems = useMemo(() => {
    if (!currentReplay || !frame) return [];
    const totalCells = currentReplay.config.width * currentReplay.config.height;
    const ids = new Set<string>(currentReplay.ranking.map((item) => item.agent_id));
    for (const [id] of frame.territory) ids.add(id);

    return [...ids]
      .map((id) => {
        const cells = frame.territory.get(id) || 0;
        const prev = previousFrame ? previousFrame.territory.get(id) || 0 : cells;
        const delta = cells - prev;
        const score = currentReplay.ranking.find((item) => item.agent_id === id)?.final_score || 0;
        const name = currentReplay.agentDirectory.find((item) => item.id === id)?.name || id;
        return { id, name, cells, delta, score, share: totalCells > 0 ? (cells / totalCells) * 100 : 0 };
      })
      .sort((left, right) => right.cells - left.cells || right.score - left.score)
      .slice(0, Math.min(12, currentReplay.config.agent_count || 12));
  }, [currentReplay, frame, previousFrame]);

  const lensSnapshot = useMemo(() => {
    if (!currentRound) return null;
    return currentRound.social_snapshot.find((item) => item.agent_id === selectedLensAgentId) || currentRound.social_snapshot[0] || null;
  }, [currentRound, selectedLensAgentId]);

  const aiShowcase = useMemo(() => {
    if (!currentRound) {
      return { activeSpeakers: 0, directThreads: 0, personaVoices: 0, topPublicSpeaker: "", topPublicLine: "" };
    }
    const speakerCounts = new Map<string, number>();
    for (const message of currentRound.public_messages) {
      speakerCounts.set(message.agent_id, (speakerCounts.get(message.agent_id) || 0) + 1);
    }
    const [topPublicSpeaker = "", topPublicCount = 0] =
      [...speakerCounts.entries()].sort((left, right) => right[1] - left[1])[0] || [];
    const topPublicLine =
      currentRound.public_messages.find((message) => message.agent_id === topPublicSpeaker)?.message ||
      currentRound.public_messages[0]?.message ||
      "";
    return {
      activeSpeakers: new Set([
        ...currentRound.public_messages.map((message) => message.agent_id),
        ...currentRound.private_messages.flatMap((message) => [message.from, message.to]),
        ...currentRound.persona_notes.map((note) => note.agent_id)
      ]).size,
      directThreads: currentRound.private_messages.length,
      personaVoices: currentRound.persona_notes.length,
      topPublicSpeaker: topPublicCount > 0 ? topPublicSpeaker : "",
      topPublicLine
    };
  }, [currentRound]);

  const compositionNotes = currentReplay?.art_direction.composition_notes?.slice(0, 2) || [];

  useEffect(() => {
    if (!lensSnapshot) return;
    setSelectedLensAgentId(lensSnapshot.agent_id);
  }, [lensSnapshot?.agent_id]);

  return (
    <div className="min-h-screen overflow-x-hidden px-4 py-7 text-[#1f2a30]">
      <div className="pointer-events-none fixed right-[-90px] top-[20%] h-[260px] w-[260px] rounded-full bg-[#f7a16a]/40 blur-[42px]" />
      <div className="pointer-events-none fixed bottom-[-40px] left-[-120px] h-[320px] w-[320px] rounded-full bg-[#5bc7b5]/40 blur-[42px]" />

      <main className="relative z-10 mx-auto w-full max-w-[1380px]">
        <header className="mb-4 flex flex-col justify-between gap-4 xl:flex-row">
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.2em] text-[#0f7f78]">AI Digital Twins Arena</p>
            <h1 className="mt-1 text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[0.98] text-[#13232f]">Pixel Crowd Theatre</h1>
            <p className="mt-2 text-sm text-[#5b6a71]">
              {currentReplayName
                ? `${currentReplayName} · ${currentReplay?.config.width ?? 0}x${currentReplay?.config.height ?? 0} · ${currentReplay?.config.agent_count ?? 0} twins`
                : errorText || "加载中..."}
            </p>
            <p className="mt-2 font-mono text-xs text-[#0f7f78]">{watchStateText}</p>
            {schemaWarning ? (
              <p className="mt-2 rounded-xl border border-[#e0bc62] bg-[#fff4cf] px-3 py-2 text-xs text-[#7a5b15]">{schemaWarning}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <select
              className="rounded-xl border border-[#dbcfb4] bg-white/80 px-3 py-2 text-sm shadow-sm"
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as "" | "dry-run" | "live")}
            >
              <option value="">All modes</option>
              <option value="dry-run">Dry-run</option>
              <option value="live">Live</option>
            </select>
            <select
              className="rounded-xl border border-[#dbcfb4] bg-white/80 px-3 py-2 text-sm shadow-sm"
              value={currentReplayName}
              onChange={async (event) => {
                setIsPlaying(false);
                await loadReplay(event.target.value, { autoPlay: true });
              }}
            >
              {replays.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name} · {entry.mtime}{entry.mode ? ` · ${entry.mode}` : ""}{entry.agent_count ? ` · ${entry.agent_count}a` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadReplayList({ autoSwitchLatest: followLatest, preserveSelection: true, silent: false })}
              className="rounded-xl border border-[#dbcfb4] bg-transparent px-4 py-2 text-sm text-[#13232f] shadow-sm transition hover:bg-white/70"
            >
              刷新列表
            </button>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(420px,1.08fr)_minmax(360px,1fr)] xl:items-start">
          <div className="space-y-4 xl:sticky xl:top-6">
            <ArtMission currentReplay={currentReplay} currentRound={currentRound} aiShowcase={aiShowcase} compositionNotes={compositionNotes} />
            <BattleCanvas
              canvasRef={canvasRef}
              frame={frame}
              frames={frames}
              roundIndex={roundIndex}
              setRoundIndex={setRoundIndex}
              revealedStepCount={revealedStepCount}
              setRevealedStepCount={setRevealedStepCount}
              setRevealedStepUpdateCount={setRevealedStepUpdateCount}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              speed={speed}
              setSpeed={setSpeed}
              followLatest={followLatest}
              setFollowLatest={setFollowLatest}
              loop={loop}
              setLoop={setLoop}
              currentActionSteps={currentActionSteps}
              visibleStepCount={visibleStepCount}
              totalActionSteps={totalActionSteps}
              revealedUpdateCount={revealedUpdateCount}
              totalStepUpdates={totalStepUpdates}
              revealPercent={revealPercent}
              activeStepLabel={activeStepLabel}
            />
          </div>

          <div className="space-y-4">
            <RoundPulse
              currentRound={currentRound}
              frame={frame}
              currentReplay={currentReplay}
              rankingItems={rankingItems}
              selectedLensAgentId={selectedLensAgentId}
              setSelectedLensAgentId={setSelectedLensAgentId}
            />
            <ErrorPanel currentRound={currentRound} />
            <section className="grid gap-4 lg:grid-cols-2">
              <PublicVoice currentRound={currentRound} />
              <PrivateWire currentRound={currentRound} />
              <PersonaNotes currentRound={currentRound} />
              <TwinLens
                currentReplay={currentReplay}
                frame={frame}
                lensSnapshot={lensSnapshot}
                selectedLensAgentId={selectedLensAgentId}
                setSelectedLensAgentId={setSelectedLensAgentId}
              />
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
