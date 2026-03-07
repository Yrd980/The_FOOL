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
const socialMetricsGrid = document.getElementById("socialMetricsGrid");
const agentLensSelect = document.getElementById("agentLensSelect");
const agentLensCard = document.getElementById("agentLensCard");
const bondList = document.getElementById("bondList");
const rivalList = document.getElementById("rivalList");

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
let selectedLensAgentId = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function signed(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return value > 0 ? `+${value}` : `${value}`;
}

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
    for (const social of round.social_snapshot || []) ids.add(social.agent_id);
    for (const event of round.highlights || []) if (event.by) ids.add(event.by);
  }
  const ordered = [...ids].sort((a, b) => a.localeCompare(b));
  const map = new Map();
  ordered.forEach((id, idx) => map.set(id, palette[idx % palette.length]));
  return map;
}

function buildAgentDirectory(replay) {
  const directory = new Map();

  for (const row of replay.ranking || []) {
    directory.set(row.agent_id, { id: row.agent_id, name: row.name || row.agent_id });
  }

  for (const round of replay.replay || []) {
    for (const social of round.social_snapshot || []) {
      directory.set(social.agent_id, {
        id: social.agent_id,
        name: social.name || social.agent_id,
        archetype: social.archetype || "",
        color: social.color || null
      });
    }
  }

  return [...directory.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildFrames(replay) {
  const { width, height } = replay.config;
  const board = Array.from({ length: height }, () => Array(width).fill(null));
  const out = [];

  for (const round of replay.replay) {
    for (const event of round.highlights || []) {
      if (event.type === "expanded" || event.type === "attacked") {
        const point = parseCoord(event.target);
        if (!point) continue;
        if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) continue;
        board[point.y][point.x] = event.by;
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

function metricCard(label, value) {
  return `<div class="metric"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(value)}</div></div>`;
}

function renderMetrics(round, frame) {
  const m = round.round_metrics || {
    expanded: 0,
    attacked: 0,
    treaties_signed: 0,
    public_messages: 0,
    private_messages: 0
  };
  const social = round.social_metrics || {
    alliance_links: 0,
    rivalry_links: 0,
    max_tension: 0,
    avg_trust: 0,
    avg_debt: 0
  };

  metricsGrid.innerHTML = [
    ["Expanded", m.expanded],
    ["Attacked", m.attacked],
    ["Treaties", m.treaties_signed],
    ["Public Msg", m.public_messages],
    ["Private Msg", m.private_messages],
    ["Occupied", [...frame.territory.values()].reduce((sum, value) => sum + value, 0)]
  ]
    .map(([label, value]) => metricCard(label, value))
    .join("");

  socialMetricsGrid.innerHTML = [
    ["Alliances", social.alliance_links],
    ["Rivalries", social.rivalry_links],
    ["Max Tension", social.max_tension],
    ["Avg Trust", social.avg_trust],
    ["Avg Debt", social.avg_debt]
  ]
    .map(([label, value]) => metricCard(label, value))
    .join("");
}

function renderMessages(round) {
  publicList.innerHTML =
    (round.public_messages || [])
      .map(
        (message) =>
          `<li class="message"><div class="meta">${escapeHtml(message.agent_id)}</div><div>${escapeHtml(message.message)}</div></li>`
      )
      .join("") || `<li class="message">暂无公开发言</li>`;

  privateList.innerHTML =
    (round.private_messages || [])
      .map(
        (message) =>
          `<li class="message"><div class="meta">${escapeHtml(message.from)} -> ${escapeHtml(message.to)}</div><div>${escapeHtml(message.content)}</div></li>`
      )
      .join("") || `<li class="message">暂无私聊</li>`;

  personaList.innerHTML =
    (round.persona_notes || [])
      .map(
        (note) =>
          `<li class="persona"><div class="meta">${escapeHtml(note.agent_id)}</div><div>${escapeHtml(note.note)}</div><div class="score">active ${escapeHtml(note.proactive_score)}</div></li>`
      )
      .join("") || `<li class="persona">暂无人格注释</li>`;
}

function syncLensSelect(round) {
  if (!currentReplay) return;
  const entries = currentReplay.agentDirectory || [];
  agentLensSelect.innerHTML = entries
    .map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}${entry.archetype ? ` · ${escapeHtml(entry.archetype)}` : ""}</option>`)
    .join("");

  const ids = new Set((round.social_snapshot || []).map((item) => item.agent_id));
  if (!selectedLensAgentId || !ids.has(selectedLensAgentId)) {
    selectedLensAgentId = round.social_snapshot?.[0]?.agent_id || currentReplay.ranking?.[0]?.agent_id || entries[0]?.id || "";
  }
  agentLensSelect.value = selectedLensAgentId;
}

function renderRelationList(element, items, emptyText, kind) {
  element.innerHTML =
    (items || [])
      .map((item) => {
        const color = currentReplay?.colorMap?.get(item.target_id) || "#999";
        const events = (item.recent_shared_events || []).slice(0, 2).join(" · ");
        return `<li class="relation-item" data-target-id="${escapeHtml(item.target_id)}">
          <div class="headline"><span class="rank-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(item.target_name)}</div>
          <div class="meta"><span>${escapeHtml(item.target_id)}</span><span>${kind === "bond" ? "bond" : "heat"} ${escapeHtml(item.tension)}</span></div>
          <div class="stats">
            <span class="good">trust ${escapeHtml(signed(item.trust))}</span>
            <span class="good">aff ${escapeHtml(signed(item.affinity))}</span>
            <span class="warn">debt ${escapeHtml(signed(item.debt))}</span>
          </div>
          <div class="events">${escapeHtml(events || "暂无共享事件")}</div>
        </li>`;
      })
      .join("") || `<li class="relation-item">${escapeHtml(emptyText)}</li>`;
}

function bindRelationClicks() {
  for (const element of [...bondList.querySelectorAll("[data-target-id]"), ...rivalList.querySelectorAll("[data-target-id]")]) {
    element.addEventListener("click", () => {
      selectedLensAgentId = element.dataset.targetId || selectedLensAgentId;
      renderRound(roundIndex);
    });
  }
}

function renderLens(round, frame) {
  if (!currentReplay) return;
  syncLensSelect(round);

  const snapshot = (round.social_snapshot || []).find((item) => item.agent_id === selectedLensAgentId) || round.social_snapshot?.[0];
  if (!snapshot) {
    agentLensCard.innerHTML = `<p class="lens-summary">当前 replay 不包含社交快照。</p>`;
    bondList.innerHTML = `<li class="relation-item">暂无关系数据</li>`;
    rivalList.innerHTML = `<li class="relation-item">暂无关系数据</li>`;
    return;
  }

  const color = currentReplay.colorMap.get(snapshot.agent_id) || snapshot.color || "#999";
  const territory = frame.territory.get(snapshot.agent_id) || 0;

  agentLensCard.innerHTML = `
    <h3><span class="rank-dot" style="background:${escapeHtml(color)}"></span> ${escapeHtml(snapshot.name)}</h3>
    <div class="lens-meta">
      <span>${escapeHtml(snapshot.agent_id)}</span>
      <span>${escapeHtml(snapshot.archetype)}</span>
      <span>cells ${escapeHtml(territory)}</span>
    </div>
    <p class="lens-summary">${escapeHtml(snapshot.last_round_summary || "这一回合还没有形成足够明确的人际摘要。")}</p>
    <div class="emotion-strip">
      <div class="emotion-chip"><span class="k">anger</span><span class="v">${escapeHtml(snapshot.emotion.anger)}</span></div>
      <div class="emotion-chip"><span class="k">fear</span><span class="v">${escapeHtml(snapshot.emotion.fear)}</span></div>
      <div class="emotion-chip"><span class="k">confidence</span><span class="v">${escapeHtml(snapshot.emotion.confidence)}</span></div>
      <div class="emotion-chip"><span class="k">satisfaction</span><span class="v">${escapeHtml(snapshot.emotion.satisfaction)}</span></div>
    </div>
  `;

  renderRelationList(bondList, snapshot.strongest_bonds, "暂无明显盟友", "bond");
  renderRelationList(rivalList, snapshot.hottest_rivalries, "暂无明显宿敌", "rival");
  bindRelationClicks();
}

function bindRankingClicks() {
  for (const element of rankingList.querySelectorAll("[data-agent-id]")) {
    element.addEventListener("click", () => {
      selectedLensAgentId = element.dataset.agentId || selectedLensAgentId;
      renderRound(roundIndex);
    });
  }
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

  rankingList.innerHTML = items
    .map((item) => {
      const color = currentReplay.colorMap.get(item.id) || "#999";
      const deltaClass = item.delta > 0 ? "up" : item.delta < 0 ? "down" : "";
      const deltaText = item.delta > 0 ? `+${item.delta}` : item.delta < 0 ? `${item.delta}` : "0";
      const activeClass = item.id === selectedLensAgentId ? "active" : "";
      return `<li class="${activeClass}" data-agent-id="${escapeHtml(item.id)}">
        <div class="rank-headline">
          <span class="rank-agent"><span class="rank-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(item.id)}</span>
          <span><span class="rank-delta ${deltaClass}">${escapeHtml(deltaText)}</span> · ${escapeHtml(item.cells)}</span>
        </div>
        <div class="rank-bar"><div class="rank-fill" style="width:${Math.max(1, item.share).toFixed(2)}%;background:${escapeHtml(color)};"></div></div>
      </li>`;
    })
    .join("");

  bindRankingClicks();
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
  renderLens(round, frame);
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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function loadReplay(name, { autoPlay = true, hint = "" } = {}) {
  const data = await fetchJSON(`/api/replay/${encodeURIComponent(name)}`);
  currentReplayName = name;
  currentReplay = {
    ...data,
    colorMap: stableColorMap(data),
    agentDirectory: buildAgentDirectory(data)
  };

  if (!selectedLensAgentId || !currentReplay.agentDirectory.some((item) => item.id === selectedLensAgentId)) {
    selectedLensAgentId = currentReplay.ranking?.[0]?.agent_id || currentReplay.agentDirectory[0]?.id || "";
  }

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
      .map((entry) => `<option value="${escapeHtml(entry.name)}">${escapeHtml(entry.name)} · ${escapeHtml(entry.mtime)}</option>`)
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

agentLensSelect.addEventListener("change", () => {
  selectedLensAgentId = agentLensSelect.value;
  renderRound(roundIndex);
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
