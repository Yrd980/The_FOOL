import { buildOrchestratorEventsUrl, buildOrchestratorReplayUrl, buildOrchestratorScoresUrl, buildOrchestratorSnapshotUrl } from "../../control/transport";
import type { OrchestratorEventPage, OrchestratorSnapshotResponse, OrchestratorScoresResponse } from "../../orchestratorQueryClient";
import { buildLiveVisualModel, type ActDetail, type LiveVisualModel, type VisualAuthorityState } from "../readModel";

const TOKEN_STORAGE_KEY = "molt-claw-live-view-token";
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root.");
}

let authorityState: VisualAuthorityState | null = null;
let lastSequence = 0;
let pollHandle: number | null = null;
let activeToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? "";
const liveBaseUrl = window.location.origin;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const fetchJson = async <T>(url: string, token: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
};

const connectView = () => {
  app.innerHTML = `
    <main class="connect-shell">
      <div class="connect-poster">
        <p class="eyebrow">THE FOOL LIVE</p>
        <h1>Authority-backed broadcast view</h1>
        <p class="lede">综艺直播导播台、实时榜单、事件字幕流。只读消费 authority 查询，不接管 runtime。</p>
        <form id="connect-form" class="connect-form">
          <label for="token">Orchestrator Token</label>
          <input id="token" name="token" type="password" autocomplete="off" placeholder="paste OPENCLAW_ORCHESTRATOR_TOKEN" value="${escapeHtml(activeToken)}" />
          <button type="submit">Enter Live Room</button>
        </form>
        <p class="connect-note">查询范围固定为 snapshot / events / replay / scores，token 只保存在当前 session。</p>
        <div id="connect-error" class="connect-error"></div>
      </div>
    </main>
  `;

  const form = document.querySelector<HTMLFormElement>("#connect-form");
  const tokenInput = document.querySelector<HTMLInputElement>("#token");
  const errorNode = document.querySelector<HTMLDivElement>("#connect-error");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = tokenInput?.value.trim() ?? "";
    if (!token) {
      if (errorNode) {
        errorNode.textContent = "Token is required.";
      }
      return;
    }
    try {
      if (errorNode) {
        errorNode.textContent = "";
      }
      activeToken = token;
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      await bootstrapAuthorityState(token);
      startPolling();
    } catch (error) {
      if (errorNode) {
        errorNode.textContent = formatError(error);
      }
    }
  });
};

const bootstrapAuthorityState = async (token: string) => {
  const [snapshotResponse, replayPage, eventsPage, scoresPage] = await Promise.all([
    fetchJson<OrchestratorSnapshotResponse>(buildOrchestratorSnapshotUrl({ baseUrl: liveBaseUrl }), token),
    fetchJson<OrchestratorEventPage>(buildOrchestratorReplayUrl({ baseUrl: liveBaseUrl, query: { limit: 200 } }), token),
    fetchJson<OrchestratorEventPage>(buildOrchestratorEventsUrl({ baseUrl: liveBaseUrl, query: { limit: 40 } }), token),
    fetchJson<OrchestratorScoresResponse>(buildOrchestratorScoresUrl({ baseUrl: liveBaseUrl, query: { limit: 60 } }), token),
  ]);

  authorityState = {
    snapshotResponse,
    replayPage,
    eventsPage,
    scoresPage,
  };
  lastSequence = Math.max(
    snapshotResponse.snapshot.lastSequence ?? 0,
    eventsPage.lastSequence,
    replayPage.lastSequence,
  );
  renderLiveView(buildLiveVisualModel(authorityState));
};

const startPolling = () => {
  if (pollHandle !== null) {
    window.clearInterval(pollHandle);
  }
  pollHandle = window.setInterval(async () => {
    if (!authorityState || !activeToken) {
      return;
    }
    try {
      const previousStageId = authorityState.snapshotResponse.snapshot.activityRun?.currentStageId ?? null;
      const [snapshotResponse, eventDelta, scoresPage] = await Promise.all([
        fetchJson<OrchestratorSnapshotResponse>(buildOrchestratorSnapshotUrl({ baseUrl: liveBaseUrl }), activeToken),
        fetchJson<OrchestratorEventPage>(buildOrchestratorEventsUrl({ baseUrl: liveBaseUrl, query: { afterSequence: lastSequence, limit: 40 } }), activeToken),
        fetchJson<OrchestratorScoresResponse>(buildOrchestratorScoresUrl({ baseUrl: liveBaseUrl, query: { limit: 60 } }), activeToken),
      ]);

      let replayPage = authorityState.replayPage;
      const nextStageId = snapshotResponse.snapshot.activityRun?.currentStageId ?? null;
      const deltaEvents = eventDelta.events ?? [];
      if (deltaEvents.length > 0) {
        replayPage = {
          ...replayPage,
          lastSequence: eventDelta.lastSequence,
          events: [...replayPage.events, ...deltaEvents].slice(-240),
          hasMore: replayPage.hasMore,
          fromSequence: replayPage.fromSequence,
          toSequence: deltaEvents.at(-1)?.sequence ?? replayPage.toSequence,
          activityRunId: replayPage.activityRunId,
          ok: true,
        };
      }
      if (previousStageId !== nextStageId) {
        replayPage = await fetchJson<OrchestratorEventPage>(buildOrchestratorReplayUrl({ baseUrl: liveBaseUrl, query: { limit: 200 } }), activeToken);
      }

      authorityState = {
        snapshotResponse,
        replayPage,
        eventsPage:
          deltaEvents.length > 0
            ? {
                ...authorityState.eventsPage,
                lastSequence: eventDelta.lastSequence,
                events: [...authorityState.eventsPage.events, ...deltaEvents].slice(-40),
                hasMore: eventDelta.hasMore,
                toSequence: eventDelta.toSequence,
                fromSequence: eventDelta.fromSequence,
                activityRunId: eventDelta.activityRunId,
                ok: true,
              }
            : authorityState.eventsPage,
        scoresPage,
      };

      lastSequence = Math.max(lastSequence, snapshotResponse.snapshot.lastSequence ?? 0, eventDelta.lastSequence);
      renderLiveView(buildLiveVisualModel(authorityState));
    } catch (error) {
      const note = document.querySelector<HTMLElement>("[data-live-note]");
      if (note) {
        note.textContent = formatError(error);
      }
    }
  }, 1500);
};

const renderList = (items: string[], className = ""): string =>
  items.length > 0
    ? `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : '<p class="muted">No authority output yet.</p>';

const renderActDetail = (detail: ActDetail): string => {
  if (detail.kind === "act-1-intro") {
    return `
      <div class="act-grid intro-wall">
        ${detail.contestants.map((entry) => `
          <article class="spotlight-lane">
            <h4>${escapeHtml(entry.entityId)}</h4>
            <p>${escapeHtml(entry.latestLine ?? "awaiting intro line")}</p>
            <small>reaction: ${escapeHtml(entry.latestReaction ?? "quiet")}</small>
            <small>vote pulse: ${escapeHtml(entry.latestVote ?? "not yet")}</small>
          </article>`).join("")}
      </div>
      <div class="detail-foot">${renderList(detail.viewerPulse, "mini-list")}</div>
    `;
  }
  if (detail.kind === "act-2-preference") {
    return `<div class="relationship-board">${detail.lines.map((line) => `<article><span>${escapeHtml(line.actorId)}</span><p>${escapeHtml(line.message)}</p><small>${escapeHtml(line.timeLabel)}</small></article>`).join("")}</div>`;
  }
  if (detail.kind === "act-3-assignment") {
    return `
      <div class="reveal-board">
        ${detail.teams.map((team) => `<article><h4>${escapeHtml(team.teamId)}</h4><p>${escapeHtml(team.members.join(" / "))}</p><small>${escapeHtml(team.roomId)}</small></article>`).join("")}
      </div>
      <div class="detail-foot">${renderList(detail.revealLines, "mini-list")}</div>
    `;
  }
  if (detail.kind === "act-4-discussion") {
    return `
      <div class="discussion-split">
        ${detail.rooms.map((room) => `<article><h4>${escapeHtml(room.roomId)}</h4><p>${escapeHtml(room.occupants.join(" / ") || "no occupants")}</p>${renderList(room.latestLines, "mini-list")}</article>`).join("")}
      </div>
      <p class="detail-kicker">${escapeHtml(detail.timerLabel ?? "timer unavailable")}</p>
    `;
  }
  if (detail.kind === "act-5-submission") {
    return `
      <div class="submission-board">
        ${detail.submissions.map((submission) => `<article><h4>${escapeHtml(submission.teamId)}</h4><p>${escapeHtml(submission.submissionId)} / ${escapeHtml(submission.state)}</p><small>${escapeHtml(submission.updatedLabel)}</small><dl>${submission.fields.map((field) => `<div><dt>${escapeHtml(field.key)}</dt><dd>${escapeHtml(field.value)}</dd></div>`).join("")}</dl></article>`).join("")}
      </div>
      <p class="detail-kicker">${detail.allLocked ? "all required submissions locked" : "submission board still open"}</p>
    `;
  }
  if (detail.kind === "act-6-human-review") {
    return `
      <div class="review-stage">
        <section><h4>Commentary</h4>${renderList(detail.quoteLines, "mini-list")}</section>
        <section><h4>Pulse</h4>${renderList(detail.pulseLines, "mini-list")}</section>
      </div>
    `;
  }
  if (detail.kind === "act-7-ai-judging") {
    return `
      <div class="judge-desk">
        ${detail.submissions.map((submission) => `<article><h4>${escapeHtml(submission.teamId)} / avg ${submission.averageScore.toFixed(2)}</h4>${submission.judges.map((judge) => `<p><strong>${escapeHtml(judge.judgeId)}</strong> ${judge.score}/10 <span>${escapeHtml(judge.reason)}</span> <em>fav:${escapeHtml(judge.favorite ?? "-")} absurd:${escapeHtml(judge.mostAbsurd ?? "-")}</em></p>`).join("")}</article>`).join("")}
      </div>
    `;
  }
  if (detail.kind === "act-8-awards") {
    return `
      <div class="awards-stage">
        <section><h4>Official Awards</h4>${renderList(detail.awards.map((award) => `${award.label} -> ${award.entityId ?? "n/a"} / ${award.reason ?? "no reason"}`), "mini-list")}</section>
        <section><h4>${escapeHtml(detail.leaderMode)}</h4><p class="winner-mark">${escapeHtml(detail.leaderLabel ?? "pending")}</p></section>
      </div>
    `;
  }
  if (detail.kind === "act-9-co-creation") {
    return `
      <div class="creation-wall">
        <section class="pixel-grid">${detail.pixels.map((pixel) => `<span style="grid-column:${pixel.x + 1};grid-row:${pixel.y + 1};--pixel-color:${escapeHtml(pixel.color)}" title="${escapeHtml(pixel.entityId)}"></span>`).join("")}</section>
        <section class="poem-strip">${detail.poems.map((poem) => `<article><h4>${escapeHtml(poem.authorId ?? poem.submissionId)}</h4><p>${escapeHtml(poem.poem)}</p><small>${escapeHtml(poem.mood ?? "unknown mood")}</small></article>`).join("")}</section>
      </div>
    `;
  }
  return `
    <div class="openmic-stage">
      <section><h4>Open Mic</h4>${renderList(detail.lines, "mini-list")}</section>
      <section><h4>Closeout</h4>${renderList(detail.finishLines, "mini-list")}</section>
    </div>
  `;
};

const renderLiveView = (model: LiveVisualModel) => {
  document.body.dataset.stage = model.currentStageAccent;
  app.innerHTML = `
    <main class="live-shell">
      <section class="hero-stage">
        <div class="hero-copy">
          <p class="eyebrow">THE FOOL LIVE / AUTHORITY READ MODEL</p>
          <h1>${escapeHtml(model.currentStageTitle)}</h1>
          <p class="hero-meta">${escapeHtml(model.stageLabel)} · ${escapeHtml(model.stageClockLabel)}</p>
          <div class="hero-lines">${model.heroLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>
        </div>
        <div class="hero-monitor">
          <div><span>run</span><strong>${escapeHtml(model.runId)}</strong></div>
          <div><span>status</span><strong>${escapeHtml(model.status)}</strong></div>
          <div><span>winner</span><strong>${escapeHtml(model.winnerTeamId ?? "pending")}</strong></div>
          <div><span>note</span><strong data-live-note>${escapeHtml(model.finishNote ?? "steady state")}</strong></div>
        </div>
      </section>

      <section class="ticker-band">
        <div class="ticker-label">EVENT TICKER</div>
        <div class="ticker-track">${model.ticker.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}</div>
      </section>

      <section class="live-grid top-grid">
        <article class="rundown-panel">
          <header><h2>Ten-Act Rundown</h2></header>
          <ol class="rundown-list">
            ${model.rundown.map((item) => `<li data-status="${item.status}"><span>${escapeHtml(item.stageId)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.summary)}</p></li>`).join("")}
          </ol>
        </article>

        <article class="detail-panel">
          <header><h2>Current Act Detail</h2></header>
          ${renderActDetail(model.actDetail)}
        </article>
      </section>

      <section class="live-grid lower-grid">
        <article class="score-panel">
          <header><h2>Scoreboard</h2></header>
          <div class="score-list">
            ${model.scoreboard.map((row) => `<div class="score-row"><span>#${row.rank}</span><strong>${escapeHtml(row.teamId)}</strong><em>${row.averageScore.toFixed(2)}</em><small>${row.totalScore} pts / ${row.judgeCount} judges</small></div>`).join("")}
          </div>
        </article>

        <article class="arena-panel">
          <header><h2>Team Arena</h2></header>
          <div class="arena-list">
            ${model.teamArena.map((team) => `<section><h3>${escapeHtml(team.teamId)} <small>${escapeHtml(team.roomId)}</small></h3><ul>${team.members.map((member) => `<li><strong>${escapeHtml(member.entityId)}</strong><span>${escapeHtml(member.roomId)}</span><em>${escapeHtml(member.latest ?? "quiet")}</em></li>`).join("")}</ul><p>${escapeHtml(team.recent.join(" / ") || "no recent trail")}</p></section>`).join("")}
          </div>
        </article>

        <article class="social-panel">
          <header><h2>Social Heat</h2></header>
          <div class="social-columns">
            <section><h3>Audience</h3>${renderList(model.socialHeat.audienceHeat, "mini-list")}</section>
            <section><h3>Bet</h3>${renderList(model.socialHeat.betHeat, "mini-list")}</section>
            <section><h3>Reactions</h3>${renderList(model.socialHeat.reactionTotals, "mini-list")}</section>
            <section><h3>Votes</h3>${renderList(model.socialHeat.voteSummary, "mini-list")}</section>
            <section><h3>Settlements</h3>${renderList(model.socialHeat.settlements, "mini-list")}</section>
          </div>
        </article>
      </section>

      <section class="timeline-panel">
        <header><h2>Event Timeline</h2></header>
        <div class="timeline-list">
          ${model.eventTimeline.slice().reverse().map((event) => `<article data-mood="${event.mood}"><span>${escapeHtml(event.timeLabel)}</span><strong>${escapeHtml(event.stageId ?? "no-stage")}</strong><p>${escapeHtml(event.summary)}</p><small>${escapeHtml(event.actorId ?? "system")}</small></article>`).join("")}
        </div>
      </section>
    </main>
  `;
};

if (activeToken) {
  bootstrapAuthorityState(activeToken)
    .then(() => startPolling())
    .catch(() => connectView());
} else {
  connectView();
}
