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
import { TabPanel } from "./components/TabPanel";

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
    <div className="flex h-screen flex-col overflow-hidden text-[#1f2a30]">
      <div className="pointer-events-none fixed right-[-90px] top-[20%] h-[260px] w-[260px] rounded-full bg-[#f7a16a]/40 blur-[42px]" />
      <div className="pointer-events-none fixed bottom-[-40px] left-[-120px] h-[320px] w-[320px] rounded-full bg-[#5bc7b5]/40 blur-[42px]" />

      {/* ── Compact toolbar ── */}
      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-[#dbcfb4] bg-[rgba(255,252,244,0.92)] px-4 py-2 backdrop-blur-md">
        <h1 className="text-base font-semibold text-[#13232f]">Pixel War</h1>
        <span className="font-mono text-xs text-[#5b6a71]">
          {currentReplayName
            ? `${currentReplay?.config.width ?? 0}x${currentReplay?.config.height ?? 0} · ${currentReplay?.config.agent_count ?? 0} twins`
            : errorText || "加载中..."}
        </span>
        <span className="font-mono text-xs text-[#0f7f78]">{watchStateText}</span>
        {schemaWarning ? (
          <span className="rounded-lg border border-[#e0bc62] bg-[#fff4cf] px-2 py-0.5 text-xs text-[#7a5b15]">{schemaWarning}</span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <select
            className="rounded-lg border border-[#dbcfb4] bg-white/80 px-2 py-1 text-xs shadow-sm"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as "" | "dry-run" | "live")}
          >
            <option value="">All</option>
            <option value="dry-run">Dry-run</option>
            <option value="live">Live</option>
          </select>
          <select
            className="max-w-[280px] rounded-lg border border-[#dbcfb4] bg-white/80 px-2 py-1 text-xs shadow-sm"
            value={currentReplayName}
            onChange={async (event) => {
              setIsPlaying(false);
              await loadReplay(event.target.value, { autoPlay: true });
            }}
          >
            {replays.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}{entry.mode ? ` · ${entry.mode}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadReplayList({ autoSwitchLatest: followLatest, preserveSelection: true, silent: false })}
            className="rounded-lg border border-[#dbcfb4] bg-transparent px-2 py-1 text-xs text-[#13232f] transition hover:bg-white/70"
          >
            刷新
          </button>
        </div>
      </header>

      {/* ── Main content: fill remaining height ── */}
      <main className="relative z-10 mx-auto grid min-h-0 w-full max-w-[1480px] flex-1 gap-3 p-3 xl:grid-cols-[minmax(440px,1.15fr)_minmax(340px,1fr)]">
        {/* ── Left: Canvas ── */}
        <div className="flex min-h-0 flex-col gap-2">
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

        {/* ── Right: Tabbed panels ── */}
        <div className="flex min-h-0 flex-col">
          <TabPanel
            tabs={[
              {
                id: "stats",
                label: "Stats",
                content: (
                  <div className="space-y-3">
                    <RoundPulse
                      currentRound={currentRound}
                      frame={frame}
                      currentReplay={currentReplay}
                      rankingItems={rankingItems}
                      selectedLensAgentId={selectedLensAgentId}
                      setSelectedLensAgentId={setSelectedLensAgentId}
                    />
                    <ErrorPanel currentRound={currentRound} />
                  </div>
                )
              },
              {
                id: "voices",
                label: "Voices",
                content: (
                  <div className="space-y-3">
                    <PublicVoice currentRound={currentRound} />
                    <PrivateWire currentRound={currentRound} />
                  </div>
                )
              },
              {
                id: "agent",
                label: "Agent",
                content: (
                  <div className="space-y-3">
                    <TwinLens
                      currentReplay={currentReplay}
                      frame={frame}
                      lensSnapshot={lensSnapshot}
                      selectedLensAgentId={selectedLensAgentId}
                      setSelectedLensAgentId={setSelectedLensAgentId}
                    />
                    <PersonaNotes currentRound={currentRound} />
                  </div>
                )
              }
            ]}
          />
        </div>
      </main>
    </div>
  );
}
