const canvas = document.getElementById("battleCanvas");
const ctx = canvas.getContext("2d");
const replaySelect = document.getElementById("replaySelect");
const reloadBtn = document.getElementById("reloadBtn");
const roundChip = document.getElementById("roundChip");
const subtitle = document.getElementById("subtitle");
const watchState = document.getElementById("watchState");
const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const roundRange = document.getElementById("roundRange");
const speedRange = document.getElementById("speedRange");
const followLatestToggle = document.getElementById("followLatestToggle");
const loopToggle = document.getElementById("loopToggle");
const publicList = document.getElementById("publicList");
const privateList = document.getElementById("privateList");
const personaList = document.getElementById("personaList");
const metricsGrid = document.getElementById("metricsGrid");
const rankingList = document.getElementById("rankingList");

const REPLAY_POLL_MS = 7000;

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

let replays = [];
let currentReplay = null;
let currentReplayName = "";
let frames = [];
let roundIndex = 0;
let timer = null;
let replayPollTimer = null;
let listLoading = false;

function parseCoord(target) {
  if (typeof target !== "string") return null;
  const match = target.match(/^(\d+),(\d+)$/);
  if (!match) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}

function stableColorMap(replay) {
  const ids = new Set();
  for (const row of replay.ranking || []) ids.add(row.agent_id);
  for (const round of replay.replay || []) {
    for (const msg of round.public_messages || []) ids.add(msg.agent_id);
    for (const note of round.persona_notes || []) ids.add(note.agent_id);
    for (const event of round.highlights || []) if (event.by) ids.add(event.by);
  }
  const ordered = [...ids].sort((a, b) => a.localeCompare(b));
  const map = new Map();
  ordered.forEach((id, idx) => map.set(id, palette[idx % palette.length]));
  return map;
}

function buildFrames(replay) {
  const { width, height } = replay.config;
  const board = Array.from({ length: height }, () => Array(width).fill(null));
  const out = [];

  for (const round of replay.replay) {
    for (const event of round.highlights || []) {
      if (event.type === "expanded" || event.type === "attacked") {
        const p = parseCoord(event.target);
        if (!p) continue;
        if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) continue;
        board[p.y][p.x] = event.by;
      }
    }

    const territory = new Map();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const owner = board[y][x];
        if (!owner) continue;
        territory.set(owner, (territory.get(owner) || 0) + 1);
      }
    }

    out.push({
      round: round.round,
      board: board.map((row) => [...row]),
      territory,
      source: round
    });
  }

  return out;
}

function drawFrame(frame) {
  if (!currentReplay || !frame) return;
  const { width, height } = currentReplay.config;
  const cellW = canvas.width / width;
  const cellH = canvas.height / height;
  const colorMap = currentReplay.colorMap;

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const owner = frame.board[y][x];
      if (!owner) continue;
      ctx.fillStyle = colorMap.get(owner) || "#999";
      ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW), Math.ceil(cellH));
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += Math.max(1, Math.round(width / 16))) {
    const px = x * cellW;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.stroke();
  }
}

function renderMetrics(round, frame) {
  const m = round.round_metrics || {
    expanded: 0,
    attacked: 0,
    treaties_signed: 0,
    public_messages: 0,
    private_messages: 0
  };

  metricsGrid.innerHTML = [
    ["Expanded", m.expanded],
    ["Attacked", m.attacked],
    ["Treaties", m.treaties_signed],
    ["Public Msg", m.public_messages],
    ["Private Msg", m.private_messages],
    ["Occupied", [...frame.territory.values()].reduce((a, b) => a + b, 0)]
  ]
    .map(([k, v]) => `<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`)
    .join("");
}

function renderMessages(round) {
  publicList.innerHTML =
    (round.public_messages || [])
      .map((m) => `<li class="message"><div class="meta">${m.agent_id}</div><div>${m.message}</div></li>`)
      .join("") || `<li class="message">暂无公开发言</li>`;

  privateList.innerHTML =
    (round.private_messages || [])
      .map((m) => `<li class="message"><div class="meta">${m.from} -> ${m.to}</div><div>${m.content}</div></li>`)
      .join("") || `<li class="message">暂无私聊</li>`;

  personaList.innerHTML =
    (round.persona_notes || [])
      .map(
        (p) =>
          `<li class="persona"><div class="meta">${p.agent_id}</div><div>${p.note}</div><div class="score">active ${p.proactive_score}</div></li>`
      )
      .join("") || `<li class="persona">暂无人格注释</li>`;
}

function renderRanking(frame, prevFrame) {
  if (!currentReplay) return;
  const totalCells = currentReplay.config.width * currentReplay.config.height;
  const ids = new Set(currentReplay.ranking.map((item) => item.agent_id));
  for (const [id] of frame.territory) ids.add(id);

  const items = [...ids]
    .map((id) => {
      const cells = frame.territory.get(id) || 0;
      const prev = prevFrame ? prevFrame.territory.get(id) || 0 : cells;
      const delta = cells - prev;
      const score = currentReplay.ranking.find((x) => x.agent_id === id)?.final_score || 0;
      return {
        id,
        cells,
        delta,
        score,
        share: totalCells > 0 ? (cells / totalCells) * 100 : 0
      };
    })
    .sort((a, b) => b.cells - a.cells || b.score - a.score)
    .slice(0, Math.min(12, currentReplay.config.agent_count || 12));

  rankingList.innerHTML = items
    .map((item) => {
      const color = currentReplay.colorMap.get(item.id) || "#999";
      const deltaClass = item.delta > 0 ? "up" : item.delta < 0 ? "down" : "";
      const deltaText = item.delta > 0 ? `+${item.delta}` : item.delta < 0 ? `${item.delta}` : "0";
      return `<li>
        <div class="rank-headline">
          <span class="rank-agent"><span class="rank-dot" style="background:${color}"></span>${item.id}</span>
          <span><span class="rank-delta ${deltaClass}">${deltaText}</span> · ${item.cells}</span>
        </div>
        <div class="rank-bar"><div class="rank-fill" style="width:${Math.max(1, item.share).toFixed(2)}%;background:${color};"></div></div>
      </li>`;
    })
    .join("");
}

function updateWatchState(extra = "") {
  const follow = followLatestToggle.checked ? "ON" : "OFF";
  const loop = loopToggle.checked ? "ON" : "OFF";
  const text = `跟随最新:${follow} | 循环:${loop} | 轮询:${Math.round(REPLAY_POLL_MS / 1000)}s`;
  watchState.textContent = extra ? `${text} | ${extra}` : text;
}

function renderRound(index) {
  if (!currentReplay || frames.length === 0) return;
  roundIndex = Math.max(0, Math.min(index, frames.length - 1));
  const frame = frames[roundIndex];
  const prevFrame = roundIndex > 0 ? frames[roundIndex - 1] : frame;
  const round = frame.source;

  drawFrame(frame);
  renderMetrics(round, frame);
  renderMessages(round);
  renderRanking(frame, prevFrame);

  roundChip.textContent = `Round ${round.round} / ${frames.length}`;
  roundRange.value = String(roundIndex);
}

function stopPlayback() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  playBtn.textContent = "播放";
}

function startPlayback() {
  stopPlayback();
  playBtn.textContent = "暂停";
  timer = setInterval(() => {
    if (!currentReplay) return;

    if (roundIndex >= frames.length - 1) {
      if (!loopToggle.checked) {
        stopPlayback();
        return;
      }

      renderRound(0);
      if (followLatestToggle.checked) {
        loadReplayList({ autoSwitchLatest: true, preserveSelection: true, silent: true }).catch(() => {});
      }
      return;
    }

    renderRound(roundIndex + 1);
  }, Number(speedRange.value));
}

function startReplayPolling() {
  if (replayPollTimer) clearInterval(replayPollTimer);
  replayPollTimer = setInterval(() => {
    if (!followLatestToggle.checked) return;
    loadReplayList({ autoSwitchLatest: true, preserveSelection: true, silent: true }).catch(() => {});
  }, REPLAY_POLL_MS);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function loadReplay(name, { autoPlay = true, hint = "" } = {}) {
  const data = await fetchJSON(`/api/replay/${encodeURIComponent(name)}`);
  currentReplayName = name;
  currentReplay = {
    ...data,
    colorMap: stableColorMap(data)
  };

  frames = buildFrames(data);
  roundRange.max = String(Math.max(0, frames.length - 1));
  renderRound(0);

  const ts = name || "latest";
  subtitle.textContent = `${ts} · ${data.config.width}x${data.config.height} · ${data.config.agent_count} twins`;
  updateWatchState(hint);

  if (autoPlay) {
    startPlayback();
  }
}

async function loadReplayList({ autoSwitchLatest = true, preserveSelection = true, silent = false } = {}) {
  if (listLoading) return;
  listLoading = true;
  try {
    const data = await fetchJSON("/api/replays");
    const incoming = data.replays || [];
    const previousReplay = currentReplayName;

    replays = incoming;
    replaySelect.innerHTML = replays
      .map((entry) => `<option value="${entry.name}">${entry.name} · ${entry.mtime}</option>`)
      .join("");

    if (replays.length === 0) {
      subtitle.textContent = "output 目录没有 replay 文件，先运行一局模拟。";
      updateWatchState();
      return;
    }

    let target = null;
    const newest = replays[0].name;

    if (followLatestToggle.checked && autoSwitchLatest) {
      target = newest;
    } else if (preserveSelection && previousReplay && replays.some((item) => item.name === previousReplay)) {
      target = previousReplay;
    } else {
      target = newest;
    }

    replaySelect.value = target;

    if (!currentReplay || target !== previousReplay) {
      const switchedByLatest = !!previousReplay && target === newest && target !== previousReplay && followLatestToggle.checked;
      await loadReplay(target, {
        autoPlay: true,
        hint: switchedByLatest ? "检测到新 replay，已自动切换" : silent ? "" : ""
      });
      return;
    }

    updateWatchState();
  } finally {
    listLoading = false;
  }
}

replaySelect.addEventListener("change", async () => {
  stopPlayback();
  await loadReplay(replaySelect.value, { autoPlay: true });
});

reloadBtn.addEventListener("click", async () => {
  await loadReplayList({ autoSwitchLatest: followLatestToggle.checked, preserveSelection: true, silent: false });
});

playBtn.addEventListener("click", () => {
  if (timer) {
    stopPlayback();
  } else {
    startPlayback();
  }
});

prevBtn.addEventListener("click", () => {
  stopPlayback();
  renderRound(roundIndex - 1);
});

nextBtn.addEventListener("click", () => {
  stopPlayback();
  renderRound(roundIndex + 1);
});

roundRange.addEventListener("input", () => {
  stopPlayback();
  renderRound(Number(roundRange.value));
});

speedRange.addEventListener("input", () => {
  if (timer) {
    startPlayback();
  }
});

followLatestToggle.addEventListener("change", async () => {
  updateWatchState();
  if (followLatestToggle.checked) {
    await loadReplayList({ autoSwitchLatest: true, preserveSelection: true, silent: true });
  }
});

loopToggle.addEventListener("change", () => {
  updateWatchState();
});

updateWatchState();
startReplayPolling();

loadReplayList({ autoSwitchLatest: true, preserveSelection: true, silent: false }).catch((error) => {
  subtitle.textContent = `加载失败: ${error.message}`;
  updateWatchState("加载失败");
});
