import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SocialRelation, ReplayData, ReplayListItem, Frame, HydratedReplay } from "./types";
import {
  REPLAY_POLL_MS,
  DEFAULT_SPEED,
  MIN_REVEAL_TICK_MS,
  cn,
  signed,
  revealChunkSize,
  actionStepsForRound,
  stableColorMap,
  buildAgentDirectory,
  buildFrames,
  fetchJSON,
  normalizedSchemaVersion,
  schemaWarningFor
} from "./utils";

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#dbcfb4] bg-white/70 p-3 shadow-sm backdrop-blur-sm">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#5b6a71]">{label}</div>
      <div className="mt-1 font-mono text-2xl text-[#13232f]">{value}</div>
    </div>
  );
}

function RelationCard({
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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [replays, setReplays] = useState<ReplayListItem[]>([]);
  const [currentReplay, setCurrentReplay] = useState<HydratedReplay | null>(null);
  const [currentReplayName, setCurrentReplayName] = useState("");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [revealedStepCount, setRevealedStepCount] = useState(0);
  const [revealedStepUpdateCount, setRevealedStepUpdateCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [followLatest, setFollowLatest] = useState(true);
  const [loop, setLoop] = useState(true);
  const [watchHint, setWatchHint] = useState("");
  const [selectedLensAgentId, setSelectedLensAgentId] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [schemaWarning, setSchemaWarning] = useState("");

  const frame = frames[roundIndex] ?? null;
  const previousFrame = roundIndex > 0 ? frames[roundIndex - 1] : null;
  const currentRound = frame?.source ?? null;
  const currentActionSteps = useMemo(() => actionStepsForRound(currentRound), [currentRound]);
  const totalStepUpdates = useMemo(
    () => currentActionSteps.reduce((sum, step) => sum + step.updates.length, 0),
    [currentActionSteps]
  );
  const revealedUpdateCount = useMemo(() => {
    let total = 0;
    for (let i = 0; i < Math.min(revealedStepCount, currentActionSteps.length); i += 1) {
      total += currentActionSteps[i].updates.length;
    }
    if (revealedStepCount < currentActionSteps.length) {
      total += Math.min(revealedStepUpdateCount, currentActionSteps[revealedStepCount].updates.length);
    }
    return total;
  }, [currentActionSteps, revealedStepCount, revealedStepUpdateCount]);
  const revealPercent = totalStepUpdates > 0 ? Math.round((revealedUpdateCount / totalStepUpdates) * 100) : 100;
  const activePlaybackStep = currentActionSteps[revealedStepCount] ?? null;
  const visibleStepCount = Math.min(
    currentActionSteps.length,
    revealedStepCount + (activePlaybackStep ? 1 : 0)
  );
  const totalActionSteps = currentActionSteps.length;
  const activeStepLabel =
    activePlaybackStep?.label ?? (totalActionSteps > 0 ? currentActionSteps[totalActionSteps - 1]?.label || "Round Complete" : "No Steps");

  const loadReplay = useCallback(
    async (name: string, options?: { autoPlay?: boolean; hint?: string }) => {
      const data = await fetchJSON<ReplayData>(`/api/replay/${encodeURIComponent(name)}`);
      const schemaVersion = normalizedSchemaVersion(data.schema_version);
      const normalizedData: ReplayData = {
        ...data,
        schema_version: schemaVersion
      };
      const hydrated: HydratedReplay = {
        ...normalizedData,
        colorMap: stableColorMap(normalizedData),
        agentDirectory: buildAgentDirectory(normalizedData)
      };
      const builtFrames = buildFrames(normalizedData);
      const shouldAutoPlay = options?.autoPlay ?? true;
      const initialSteps = actionStepsForRound(builtFrames[0]?.source);

      setCurrentReplayName(name);
      setCurrentReplay(hydrated);
      setFrames(builtFrames);
      setRoundIndex(0);
      setRevealedStepCount(shouldAutoPlay ? 0 : initialSteps.length);
      setRevealedStepUpdateCount(0);
      setErrorText("");
      setSchemaWarning(schemaWarningFor(schemaVersion));
      setWatchHint(options?.hint ?? "");
      setSelectedLensAgentId((previous) => {
        if (previous && hydrated.agentDirectory.some((item) => item.id === previous)) return previous;
        return hydrated.ranking[0]?.agent_id ?? hydrated.agentDirectory[0]?.id ?? "";
      });

      if (shouldAutoPlay) {
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    },
    []
  );

  const loadReplayList = useCallback(
    async (options?: { autoSwitchLatest?: boolean; preserveSelection?: boolean; silent?: boolean }) => {
      if (loadingList) return;
      setLoadingList(true);
      try {
        const data = await fetchJSON<{ replays: ReplayListItem[] }>("/api/replays");
        const incoming = data.replays || [];
        setReplays(incoming);

        if (incoming.length === 0) {
          setSchemaWarning("");
          setErrorText("output 目录没有 replay 文件，先运行一局模拟。");
          return;
        }

        const newest = incoming[0]?.name ?? "";
        const previousReplay = currentReplayName;
        const preserveSelection = options?.preserveSelection ?? true;
        const autoSwitchLatest = options?.autoSwitchLatest ?? true;

        let target = newest;
        if (!followLatest && preserveSelection && previousReplay && incoming.some((item) => item.name === previousReplay)) {
          target = previousReplay;
        }
        if (followLatest && autoSwitchLatest) {
          target = newest;
        }

        if (!currentReplay || target !== previousReplay) {
          const switchedByLatest = Boolean(previousReplay) && target === newest && target !== previousReplay && followLatest;
          await loadReplay(target, {
            autoPlay: true,
            hint: switchedByLatest ? "检测到新 replay，已自动切换" : options?.silent ? "" : ""
          });
        }
      } catch (error) {
        setSchemaWarning("");
        setErrorText(error instanceof Error ? error.message : String(error));
      } finally {
        setLoadingList(false);
      }
    },
    [currentReplay, currentReplayName, followLatest, loadReplay, loadingList]
  );

  useEffect(() => {
    loadReplayList({ autoSwitchLatest: true, preserveSelection: true, silent: false }).catch(() => undefined);
  }, [loadReplayList]);

  useEffect(() => {
    if (!followLatest) return undefined;
    const handle = window.setInterval(() => {
      loadReplayList({ autoSwitchLatest: true, preserveSelection: true, silent: true }).catch(() => undefined);
    }, REPLAY_POLL_MS);
    return () => window.clearInterval(handle);
  }, [followLatest, loadReplayList]);

  useEffect(() => {
    if (!isPlaying || !frame) return undefined;

    const totalUnits = currentActionSteps.reduce((sum, step) => {
      if (step.updates.length === 0) return sum + 1;
      return sum + Math.max(1, Math.ceil(step.updates.length / revealChunkSize(step.updates.length)));
    }, 0);
    const revealTickMs = Math.max(MIN_REVEAL_TICK_MS, Math.round(speed / (Math.max(1, totalUnits) + 2)));
    const holdMs = Math.max(120, speed - revealTickMs * Math.max(1, totalUnits));
    const currentStep = currentActionSteps[revealedStepCount] ?? null;
    const delay = currentStep ? revealTickMs : holdMs;

    const handle = window.setTimeout(() => {
      if (currentStep) {
        const totalUpdates = currentStep.updates.length;
        if (totalUpdates === 0) {
          setRevealedStepCount((current) => Math.min(currentActionSteps.length, current + 1));
          setRevealedStepUpdateCount(0);
          return;
        }

        if (revealedStepUpdateCount < totalUpdates) {
          const chunkSize = revealChunkSize(totalUpdates);
          setRevealedStepUpdateCount((current) => Math.min(totalUpdates, current + chunkSize));
          return;
        }

        setRevealedStepCount((current) => Math.min(currentActionSteps.length, current + 1));
        setRevealedStepUpdateCount(0);
        return;
      }

      if (roundIndex >= frames.length - 1) {
        if (!loop) {
          setIsPlaying(false);
          setRevealedStepCount(currentActionSteps.length);
          setRevealedStepUpdateCount(0);
          return;
        }
        setRoundIndex(0);
        setRevealedStepCount(0);
        setRevealedStepUpdateCount(0);
        return;
      }

      setRoundIndex(roundIndex + 1);
      setRevealedStepCount(0);
      setRevealedStepUpdateCount(0);
    }, delay);

    return () => window.clearTimeout(handle);
  }, [currentActionSteps, frame, frames.length, isPlaying, loop, revealedStepCount, revealedStepUpdateCount, roundIndex, speed]);

  useEffect(() => {
    if (!currentReplay || !frame || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const cellW = canvas.width / currentReplay.config.width;
    const cellH = canvas.height / currentReplay.config.height;

    context.fillStyle = "#111";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < currentReplay.config.height; y += 1) {
      for (let x = 0; x < currentReplay.config.width; x += 1) {
        const cell = previousFrame?.board[y]?.[x];
        if (!cell?.owner) continue;
        context.fillStyle = cell.color;
        context.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    for (const step of currentActionSteps.slice(0, Math.min(revealedStepCount, currentActionSteps.length))) {
      for (const update of step.updates) {
        const px = Math.floor(update.x * cellW);
        const py = Math.floor(update.y * cellH);
        const pw = Math.ceil(cellW);
        const ph = Math.ceil(cellH);

        if (!update.owner) {
          context.fillStyle = "#111";
          context.fillRect(px, py, pw, ph);
          continue;
        }

        context.fillStyle = update.color;
        context.fillRect(px, py, pw, ph);
      }
    }

    for (const update of activePlaybackStep?.updates.slice(0, revealedStepUpdateCount) ?? []) {
      const px = Math.floor(update.x * cellW);
      const py = Math.floor(update.y * cellH);
      const pw = Math.ceil(cellW);
      const ph = Math.ceil(cellH);

      if (!update.owner) {
        context.fillStyle = "#111";
        context.fillRect(px, py, pw, ph);
        continue;
      }

      context.fillStyle = update.color;
      context.fillRect(px, py, pw, ph);
    }

    context.strokeStyle = "rgba(255,255,255,0.03)";
    context.lineWidth = 1;
    for (let x = 0; x <= currentReplay.config.width; x += Math.max(1, Math.round(currentReplay.config.width / 16))) {
      const px = x * cellW;
      context.beginPath();
      context.moveTo(px, 0);
      context.lineTo(px, canvas.height);
      context.stroke();
    }
  }, [activePlaybackStep, currentActionSteps, currentReplay, frame, previousFrame, revealedStepCount, revealedStepUpdateCount]);

  const watchStateText = useMemo(() => {
    const follow = followLatest ? "ON" : "OFF";
    const loopState = loop ? "ON" : "OFF";
    const base = `跟随最新:${follow} | 循环:${loopState} | 轮询:${Math.round(REPLAY_POLL_MS / 1000)}s`;
    return watchHint ? `${base} | ${watchHint}` : base;
  }, [followLatest, loop, watchHint]);

  const metrics = currentRound?.round_metrics ?? {
    expanded: 0,
    attacked: 0,
    treaties_signed: 0,
    public_messages: 0,
    private_messages: 0
  };

  const socialMetrics = currentRound?.social_metrics ?? {
    alliance_links: 0,
    rivalry_links: 0,
    max_tension: 0,
    avg_trust: 0,
    avg_debt: 0
  };

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
        return {
          id,
          cells,
          delta,
          score,
          share: totalCells > 0 ? (cells / totalCells) * 100 : 0
        };
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
      return {
        activeSpeakers: 0,
        directThreads: 0,
        personaVoices: 0,
        topPublicSpeaker: "",
        topPublicLine: ""
      };
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

  const themePrompt = currentReplay?.art_direction.theme_prompt || currentReplay?.config.myth_prompt || "";
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
              <p className="mt-2 rounded-xl border border-[#e0bc62] bg-[#fff4cf] px-3 py-2 text-xs text-[#7a5b15]">
                {schemaWarning}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
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
                  {entry.name} · {entry.mtime}
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

            <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[#13232f]">Battle Canvas</h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="rounded-full bg-[#13232f] px-3 py-1 font-mono text-xs text-[#f3f8fb]">
                    Round {frame?.round ?? 0} / {frames.length}
                  </div>
                  <div className="rounded-full border border-[#dbcfb4] bg-white/85 px-3 py-1 font-mono text-xs text-[#5b6a71]">
                    Step {visibleStepCount}/{totalActionSteps || 0} · Pixels {revealedUpdateCount}/{totalStepUpdates || 0} · {revealPercent}%
                  </div>
                </div>
              </div>

              <canvas
                ref={canvasRef}
                width={768}
                height={768}
                aria-label="battle canvas"
                className="mx-auto w-full max-w-[620px] rounded-2xl border border-[#c8bda5] bg-[#111] shadow-inner"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#5b6a71]">
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    const nextIndex = Math.max(0, roundIndex - 1);
                    setRoundIndex(nextIndex);
                    setRevealedStepCount(actionStepsForRound(frames[nextIndex]?.source).length);
                    setRevealedStepUpdateCount(0);
                  }}
                  className="rounded-xl border border-[#dbcfb4] bg-white/70 px-4 py-2 text-[#13232f] shadow-sm transition hover:-translate-y-0.5"
                >
                  上一回合
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setIsPlaying((current) => {
                      if (!current && revealedStepCount >= currentActionSteps.length) {
                        setRevealedStepCount(0);
                        setRevealedStepUpdateCount(0);
                      }
                      if (current) return false;
                      return true;
                    })
                  }
                  className="rounded-xl bg-gradient-to-br from-[#db5b3f] to-[#ec7d56] px-5 py-2 text-white shadow-sm transition hover:-translate-y-0.5"
                >
                  {isPlaying ? "暂停" : "播放"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    const nextIndex = Math.min(frames.length - 1, roundIndex + 1);
                    setRoundIndex(nextIndex);
                    setRevealedStepCount(actionStepsForRound(frames[nextIndex]?.source).length);
                    setRevealedStepUpdateCount(0);
                  }}
                  className="rounded-xl border border-[#dbcfb4] bg-white/70 px-4 py-2 text-[#13232f] shadow-sm transition hover:-translate-y-0.5"
                >
                  下一回合
                </button>

                <label className="rounded-full border border-[#dbcfb4] bg-white/70 px-3 py-1 text-xs text-[#13232f]">
                  <input type="checkbox" className="mr-2" checked={followLatest} onChange={(event) => setFollowLatest(event.target.checked)} />
                  跟随最新
                </label>
                <label className="rounded-full border border-[#dbcfb4] bg-white/70 px-3 py-1 text-xs text-[#13232f]">
                  <input type="checkbox" className="mr-2" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
                  循环播放
                </label>

                <label className="ml-auto flex items-center gap-2">
                  速度
                  <input type="range" min="300" max="1800" step="100" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
                </label>
              </div>

              <div className="mt-3 rounded-2xl border border-[#dbcfb4] bg-white/70 px-3 py-2 text-xs text-[#5b6a71] shadow-sm">
                当前步骤：{activeStepLabel}
              </div>

              <input
                className="mt-3 w-full"
                type="range"
                min={0}
                max={Math.max(0, frames.length - 1)}
                value={roundIndex}
                onChange={(event) => {
                  setIsPlaying(false);
                  const nextIndex = Number(event.target.value);
                  setRoundIndex(nextIndex);
                  setRevealedStepCount(actionStepsForRound(frames[nextIndex]?.source).length);
                  setRevealedStepUpdateCount(0);
                }}
              />
            </article>
          </div>

          <div className="space-y-4">
            <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[#13232f]">Round Pulse</h2>
                <span className="font-mono text-xs text-[#5b6a71]">
                  {currentRound?.art_phase ? `${currentRound.art_phase.label} · ${currentRound.art_phase.focus}` : "social + territory"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Expanded" value={metrics.expanded} />
                <MetricCard label="Attacked" value={metrics.attacked} />
                <MetricCard label="Treaties" value={metrics.treaties_signed} />
                <MetricCard label="Public Msg" value={metrics.public_messages} />
                <MetricCard label="Private Msg" value={metrics.private_messages} />
                <MetricCard label="Occupied" value={frame ? [...frame.territory.values()].reduce((sum, value) => sum + value, 0) : 0} />
              </div>

              <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f7f78]">Top Ranking</h3>
              <ol className="mt-3 space-y-2">
                {rankingItems.map((item) => {
                  const color = currentReplay?.colorMap.get(item.id) || "#999";
                  const deltaClass = item.delta > 0 ? "text-[#0f7f78]" : item.delta < 0 ? "text-[#db5b3f]" : "text-[#5b6a71]";
                  const deltaText = item.delta > 0 ? `+${item.delta}` : `${item.delta}`;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedLensAgentId(item.id)}
                        className={cn(
                          "w-full rounded-2xl px-3 py-3 text-left transition",
                          selectedLensAgentId === item.id ? "bg-[#0f7f78]/10 shadow-sm" : "hover:bg-white/70"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3 font-mono text-xs">
                          <span className="flex items-center gap-2 text-[#13232f]">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                            {item.id}
                          </span>
                          <span>
                            <span className={deltaClass}>{deltaText}</span> · {item.cells}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#13232f]/10">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(1, item.share).toFixed(2)}%`, background: color }} />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>

              <h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#0f7f78]">Social Heat</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MetricCard label="Alliances" value={socialMetrics.alliance_links} />
                <MetricCard label="Rivalries" value={socialMetrics.rivalry_links} />
                <MetricCard label="Max Tension" value={socialMetrics.max_tension} />
                <MetricCard label="Avg Trust" value={socialMetrics.avg_trust} />
                <MetricCard label="Avg Debt" value={socialMetrics.avg_debt} />
              </div>
            </article>

            <section className="grid gap-4 lg:grid-cols-2">
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

          <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#13232f]">Persona Notes</h2>
            </div>
            <ul className="space-y-2 lg:max-h-[320px] lg:overflow-y-auto lg:pr-1">
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
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
