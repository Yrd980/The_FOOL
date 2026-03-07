import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MemoryEvent = {
  round: number;
  type: string;
  by: string;
  target?: string;
  note?: string;
};

type ReplayRound = {
  round: number;
  public_messages: Array<{ agent_id: string; message: string }>;
  private_messages: Array<{ from: string; to: string; content: string }>;
  persona_notes: Array<{ agent_id: string; note: string; proactive_score: number }>;
  round_metrics: {
    expanded: number;
    attacked: number;
    treaties_signed: number;
    public_messages: number;
    private_messages: number;
  };
  social_metrics: {
    alliance_links: number;
    rivalry_links: number;
    max_tension: number;
    avg_trust: number;
    avg_debt: number;
  };
  social_snapshot: Array<{
    agent_id: string;
    name: string;
    color: string;
    archetype: string;
    last_round_summary?: string;
    emotion: {
      anger: number;
      fear: number;
      confidence: number;
      satisfaction: number;
    };
    strongest_bonds: SocialRelation[];
    hottest_rivalries: SocialRelation[];
  }>;
  highlights: MemoryEvent[];
  errors: Array<{ round: number; agent_id: string; type: string; detail: string }>;
};

type SocialRelation = {
  target_id: string;
  target_name: string;
  trust: number;
  affinity: number;
  debt: number;
  tension: number;
  recent_shared_events: string[];
};

type ReplayData = {
  config: {
    width: number;
    height: number;
    rounds: number;
    agent_count: number;
    max_concurrent_agents: number;
    dry_run: boolean;
    model: string;
    profile_path?: string;
  };
  ranking: Array<{
    agent_id: string;
    name: string;
    territory_cells: number;
    final_score: number;
  }>;
  final_highlights: MemoryEvent[];
  replay: ReplayRound[];
};

type ReplayListItem = {
  name: string;
  mtime: string;
  bytes: number;
};

type Frame = {
  round: number;
  board: Array<Array<string | null>>;
  territory: Map<string, number>;
  source: ReplayRound;
};

type AgentDirectoryItem = {
  id: string;
  name: string;
  archetype?: string;
  color?: string | null;
};

type HydratedReplay = ReplayData & {
  colorMap: Map<string, string>;
  agentDirectory: AgentDirectoryItem[];
};

const REPLAY_POLL_MS = 7000;
const DEFAULT_SPEED = 900;
const palette = [
  "#E63946",
  "#2A9D8F",
  "#F4A261",
  "#457B9D",
  "#E9C46A",
  "#1D3557",
  "#FF6B6B",
  "#4CC9F0",
  "#8D99AE",
  "#8338EC",
  "#FF9F1C",
  "#2EC4B6",
  "#E76F51",
  "#3A86FF",
  "#7A9E7E",
  "#F94144",
  "#43AA8B",
  "#577590",
  "#90BE6D",
  "#F3722C"
];

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function parseCoord(target: string | undefined): { x: number; y: number } | null {
  if (!target) return null;
  const match = target.match(/^(\d+),(\d+)$/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

function stableColorMap(replay: ReplayData): Map<string, string> {
  const ids = new Set<string>();
  for (const row of replay.ranking) ids.add(row.agent_id);
  for (const round of replay.replay) {
    for (const message of round.public_messages) ids.add(message.agent_id);
    for (const note of round.persona_notes) ids.add(note.agent_id);
    for (const social of round.social_snapshot) ids.add(social.agent_id);
    for (const event of round.highlights) if (event.by) ids.add(event.by);
  }
  const ordered = [...ids].sort((left, right) => left.localeCompare(right));
  return new Map(ordered.map((id, index) => [id, palette[index % palette.length]]));
}

function buildAgentDirectory(replay: ReplayData): AgentDirectoryItem[] {
  const directory = new Map<string, AgentDirectoryItem>();
  for (const row of replay.ranking) {
    directory.set(row.agent_id, { id: row.agent_id, name: row.name });
  }
  for (const round of replay.replay) {
    for (const social of round.social_snapshot) {
      directory.set(social.agent_id, {
        id: social.agent_id,
        name: social.name,
        archetype: social.archetype,
        color: social.color
      });
    }
  }
  return [...directory.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildFrames(replay: ReplayData): Frame[] {
  const board = Array.from({ length: replay.config.height }, () => Array<string | null>(replay.config.width).fill(null));
  const frames: Frame[] = [];

  for (const round of replay.replay) {
    for (const event of round.highlights) {
      if (event.type !== "expanded" && event.type !== "attacked") continue;
      const point = parseCoord(event.target);
      if (!point) continue;
      if (point.x < 0 || point.y < 0 || point.x >= replay.config.width || point.y >= replay.config.height) continue;
      board[point.y][point.x] = event.by;
    }

    const territory = new Map<string, number>();
    for (let y = 0; y < replay.config.height; y += 1) {
      for (let x = 0; x < replay.config.width; x += 1) {
        const owner = board[y][x];
        if (!owner) continue;
        territory.set(owner, (territory.get(owner) || 0) + 1);
      }
    }

    frames.push({
      round: round.round,
      board: board.map((row) => [...row]),
      territory,
      source: round
    });
  }

  return frames;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

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
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [followLatest, setFollowLatest] = useState(true);
  const [loop, setLoop] = useState(true);
  const [watchHint, setWatchHint] = useState("");
  const [selectedLensAgentId, setSelectedLensAgentId] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [errorText, setErrorText] = useState("");

  const frame = frames[roundIndex] ?? null;
  const previousFrame = roundIndex > 0 ? frames[roundIndex - 1] : frame;
  const currentRound = frame?.source ?? null;

  const loadReplay = useCallback(
    async (name: string, options?: { autoPlay?: boolean; hint?: string }) => {
      const data = await fetchJSON<ReplayData>(`/api/replay/${encodeURIComponent(name)}`);
      const hydrated: HydratedReplay = {
        ...data,
        colorMap: stableColorMap(data),
        agentDirectory: buildAgentDirectory(data)
      };

      setCurrentReplayName(name);
      setCurrentReplay(hydrated);
      setFrames(buildFrames(data));
      setRoundIndex(0);
      setErrorText("");
      setWatchHint(options?.hint ?? "");
      setSelectedLensAgentId((previous) => {
        if (previous && hydrated.agentDirectory.some((item) => item.id === previous)) return previous;
        return hydrated.ranking[0]?.agent_id ?? hydrated.agentDirectory[0]?.id ?? "";
      });

      if (options?.autoPlay ?? true) {
        setIsPlaying(true);
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
    if (!isPlaying || frames.length === 0) return undefined;
    const handle = window.setInterval(() => {
      setRoundIndex((current) => {
        if (current >= frames.length - 1) {
          if (!loop) {
            setIsPlaying(false);
            return current;
          }
          return 0;
        }
        return current + 1;
      });
    }, speed);
    return () => window.clearInterval(handle);
  }, [frames.length, isPlaying, loop, speed]);

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
        const owner = frame.board[y][x];
        if (!owner) continue;
        context.fillStyle = currentReplay.colorMap.get(owner) || "#999";
        context.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW), Math.ceil(cellH));
      }
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
  }, [currentReplay, frame]);

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

        <section className="grid gap-4 xl:grid-cols-[minmax(420px,1.55fr)_minmax(320px,1fr)]">
          <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[#13232f]">Battle Canvas</h2>
              <div className="rounded-full bg-[#13232f] px-3 py-1 font-mono text-xs text-[#f3f8fb]">
                Round {frame?.round ?? 0} / {frames.length}
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={768}
              height={768}
              aria-label="battle canvas"
              className="w-full rounded-2xl border border-[#c8bda5] bg-[#111] shadow-inner"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#5b6a71]">
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setRoundIndex((current) => Math.max(0, current - 1));
                }}
                className="rounded-xl border border-[#dbcfb4] bg-white/70 px-4 py-2 text-[#13232f] shadow-sm transition hover:-translate-y-0.5"
              >
                上一回合
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying((current) => !current)}
                className="rounded-xl bg-gradient-to-br from-[#db5b3f] to-[#ec7d56] px-5 py-2 text-white shadow-sm transition hover:-translate-y-0.5"
              >
                {isPlaying ? "暂停" : "播放"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setRoundIndex((current) => Math.min(frames.length - 1, current + 1));
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

            <input
              className="mt-3 w-full"
              type="range"
              min={0}
              max={Math.max(0, frames.length - 1)}
              value={roundIndex}
              onChange={(event) => {
                setIsPlaying(false);
                setRoundIndex(Number(event.target.value));
              }}
            />
          </article>

          <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[#13232f]">Round Pulse</h2>
              <span className="font-mono text-xs text-[#5b6a71]">social + territory</span>
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
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#13232f]">Public Voice</h2>
            </div>
            <ul className="space-y-2">
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
            <ul className="space-y-2">
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

          <article className="rounded-[22px] border border-[#dbcfb4] bg-[rgba(255,252,244,0.88)] p-4 shadow-[0_14px_30px_rgba(17,36,46,0.12)] backdrop-blur-md">
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
      </main>
    </div>
  );
}
