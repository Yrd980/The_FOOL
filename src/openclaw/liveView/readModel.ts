import type {
  OrchestratorEventPage,
  OrchestratorSnapshotResponse,
  OrchestratorScoresResponse,
  OrchestratorStageTemplate,
} from "../orchestratorQueryClient";
import type {
  GatewayEventEnvelope,
  GatewayScoreSummarySnapshot,
} from "../gateway/types";

type StageId =
  | "act-1-intro"
  | "act-2-preference"
  | "act-3-assignment"
  | "act-4-discussion"
  | "act-5-submission"
  | "act-6-human-review"
  | "act-7-ai-judging"
  | "act-8-awards"
  | "act-9-co-creation"
  | "act-10-open-mic";

export interface VisualAuthorityState {
  snapshotResponse: OrchestratorSnapshotResponse;
  replayPage: OrchestratorEventPage;
  eventsPage: OrchestratorEventPage;
  scoresPage: OrchestratorScoresResponse;
}

export interface VisualEventItem {
  id: string;
  sequence: number;
  stageId: string | null;
  actorId: string | null;
  actorRole: string | null;
  timeLabel: string;
  summary: string;
  mood: "neutral" | "accent" | "success" | "warning";
  raw: GatewayEventEnvelope;
}

export interface RundownItem {
  stageId: string;
  title: string;
  status: "done" | "active" | "pending";
  summary: string;
}

export interface ScoreboardRow {
  rank: number;
  teamId: string;
  submissionId: string | null;
  averageScore: number;
  totalScore: number;
  judgeCount: number;
  lastSubmittedAt: number;
}

export interface TeamArenaEntry {
  teamId: string;
  roomId: string;
  members: Array<{
    entityId: string;
    roomId: string;
    latest: string | null;
  }>;
  recent: string[];
}

export interface ActDetailIntro {
  kind: "act-1-intro";
  contestants: Array<{
    entityId: string;
    latestLine: string | null;
    latestReaction: string | null;
    latestVote: string | null;
  }>;
  viewerPulse: string[];
}

export interface ActDetailPreference {
  kind: "act-2-preference";
  lines: Array<{
    actorId: string;
    message: string;
    timeLabel: string;
  }>;
}

export interface ActDetailAssignment {
  kind: "act-3-assignment";
  teams: Array<{
    teamId: string;
    roomId: string;
    members: string[];
  }>;
  revealLines: string[];
}

export interface ActDetailDiscussion {
  kind: "act-4-discussion";
  rooms: Array<{
    roomId: string;
    occupants: string[];
    latestLines: string[];
  }>;
  timerLabel: string | null;
}

export interface ActDetailSubmission {
  kind: "act-5-submission";
  submissions: Array<{
    teamId: string;
    submissionId: string;
    state: "locked" | "open";
    updatedLabel: string;
    fields: Array<{ key: string; value: string }>;
  }>;
  allLocked: boolean;
}

export interface ActDetailReview {
  kind: "act-6-human-review";
  quoteLines: string[];
  pulseLines: string[];
}

export interface ActDetailJudging {
  kind: "act-7-ai-judging";
  submissions: Array<{
    teamId: string;
    submissionId: string;
    judges: Array<{
      judgeId: string;
      score: number;
      reason: string;
      favorite: string | null;
      mostAbsurd: string | null;
    }>;
    averageScore: number;
  }>;
}

export interface ActDetailAwards {
  kind: "act-8-awards";
  awards: Array<{
    label: string;
    entityId: string | null;
    reason: string | null;
  }>;
  leaderLabel: string | null;
  leaderMode: "winner" | "current leader";
}

export interface ActDetailCreation {
  kind: "act-9-co-creation";
  poems: Array<{
    submissionId: string;
    authorId: string | null;
    poem: string;
    mood: string | null;
  }>;
  pixels: Array<{
    entityId: string;
    x: number;
    y: number;
    color: string;
  }>;
}

export interface ActDetailOpenMic {
  kind: "act-10-open-mic";
  lines: string[];
  finishLines: string[];
}

export type ActDetail =
  | ActDetailIntro
  | ActDetailPreference
  | ActDetailAssignment
  | ActDetailDiscussion
  | ActDetailSubmission
  | ActDetailReview
  | ActDetailJudging
  | ActDetailAwards
  | ActDetailCreation
  | ActDetailOpenMic;

export interface LiveVisualModel {
  runId: string;
  status: string;
  currentStageId: string | null;
  currentStageTitle: string;
  currentStageAccent: string;
  winnerTeamId: string | null;
  finishNote: string | null;
  stageLabel: string;
  stageClockLabel: string;
  heroLines: string[];
  ticker: string[];
  rundown: RundownItem[];
  eventTimeline: VisualEventItem[];
  scoreboard: ScoreboardRow[];
  teamArena: TeamArenaEntry[];
  socialHeat: {
    audienceHeat: string[];
    betHeat: string[];
    reactionTotals: string[];
    voteSummary: string[];
    settlements: string[];
  };
  actDetail: ActDetail;
}

const STAGE_ACCENTS: Record<string, string> = {
  "act-1-intro": "intro",
  "act-2-preference": "preference",
  "act-3-assignment": "assignment",
  "act-4-discussion": "discussion",
  "act-5-submission": "submission",
  "act-6-human-review": "review",
  "act-7-ai-judging": "judging",
  "act-8-awards": "awards",
  "act-9-co-creation": "creation",
  "act-10-open-mic": "openmic",
};

const SOCIAL_PULSE_TYPES = new Set(["reaction.added", "bet.placed", "vote.cast"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (record: Record<string, unknown>, ...keys: string[]): string | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const readNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const formatTime = (timestamp?: number): string => {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return "--:--:--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
};

const formatStageTitle = (stage: OrchestratorStageTemplate | undefined, fallbackId: string | null): string =>
  stage?.name?.trim() || fallbackId || "Unknown Act";

const describeEvent = (event: GatewayEventEnvelope): VisualEventItem => {
  const payload = isRecord(event.payload) ? event.payload : {};
  const stageId = readString(payload, "stageId", "toStageId", "currentStageId");
  const timeLabel = formatTime(event.timestamp);

  if (event.type === "stage.changed") {
    const fromStageId = readString(payload, "fromStageId");
    const toStageId = readString(payload, "toStageId", "stageId");
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: `${fromStageId ?? "unknown"} -> ${toStageId ?? "unknown"}`,
      mood: "accent",
      raw: event,
    };
  }

  if (event.type === "agent.talked" || event.type === "broadcast.sent") {
    const message = readString(payload, "message") ?? "(empty)";
    const roomId = readString(payload, "roomId");
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: roomId ? `${message} @ ${roomId}` : message,
      mood: event.type === "broadcast.sent" ? "accent" : "neutral",
      raw: event,
    };
  }

  if (event.type === "reaction.added") {
    const reaction = readString(payload, "reaction") ?? "reaction";
    const target = readString(payload, "targetEntityId", "targetTeamId", "roomId") ?? "stage";
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: `${reaction} -> ${target}`,
      mood: "accent",
      raw: event,
    };
  }

  if (event.type === "bet.placed") {
    const target = readString(payload, "targetId") ?? "unknown";
    const amount = readNumber(payload, "amount");
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: `bet ${amount ?? 0} on ${target}`,
      mood: "warning",
      raw: event,
    };
  }

  if (event.type === "vote.cast") {
    const target = readString(payload, "targetId") ?? "unknown";
    const value = readNumber(payload, "value");
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: `vote ${value ?? 0} for ${target}`,
      mood: "accent",
      raw: event,
    };
  }

  if (event.type.startsWith("submission.")) {
    const submission = isRecord(payload.submission) ? payload.submission : payload;
    const submissionId = readString(submission, "id", "submissionId") ?? "submission";
    const teamId = readString(submission, "teamId");
    const state =
      event.type === "submission.locked"
        ? "locked"
        : event.type === "submission.opened"
          ? "opened"
          : "updated";
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: teamId ? `${state} ${submissionId} for ${teamId}` : `${state} ${submissionId}`,
      mood: event.type === "submission.locked" ? "success" : "neutral",
      raw: event,
    };
  }

  if (event.type === "judge.score_submitted") {
    const score = isRecord(payload.judgeScore) ? payload.judgeScore : payload;
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: `${readString(score, "submissionId", "targetId") ?? "submission"} = ${readNumber(score, "score") ?? 0}/10`,
      mood: "success",
      raw: event,
    };
  }

  if (event.type === "award.granted") {
    const award = isRecord(payload.award) ? payload.award : payload;
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: `${readString(award, "label") ?? "award"} -> ${readString(award, "entityId") ?? "n/a"}`,
      mood: "success",
      raw: event,
    };
  }

  if (event.type === "entity.moved") {
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: `${readString(payload, "entityId") ?? "entity"} -> ${readString(payload, "toRoomId") ?? "room"}`,
      mood: "neutral",
      raw: event,
    };
  }

  if (event.type === "draw.submitted") {
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: `draw from ${readString(payload, "entityId") ?? event.actorId ?? "artist"}`,
      mood: "accent",
      raw: event,
    };
  }

  if (event.type === "activity.finished") {
    return {
      id: event.id,
      sequence: event.sequence ?? 0,
      stageId,
      actorId: event.actorId ?? null,
      actorRole: event.actorRole ?? null,
      timeLabel,
      summary: `finished -> ${readString(payload, "winningTargetId") ?? "no-winner"}`,
      mood: "success",
      raw: event,
    };
  }

  return {
    id: event.id,
    sequence: event.sequence ?? 0,
    stageId,
    actorId: event.actorId ?? null,
    actorRole: event.actorRole ?? null,
    timeLabel,
    summary: event.type,
    mood: "neutral",
    raw: event,
  };
};

const getStageEvents = (events: VisualEventItem[], stageId: string): VisualEventItem[] =>
  events.filter((event) => event.stageId === stageId);

const getWinner = (events: GatewayEventEnvelope[]): { winnerTeamId: string | null; finishNote: string | null } => {
  const finish = [...events].reverse().find((event) => event.type === "activity.finished");
  if (!finish || !isRecord(finish.payload)) {
    return { winnerTeamId: null, finishNote: null };
  }
  return {
    winnerTeamId: readString(finish.payload, "winningTargetId"),
    finishNote: readString(finish.payload, "note"),
  };
};

const buildRundown = (
  stageTemplates: OrchestratorStageTemplate[],
  currentStageId: string | null,
  replayEvents: VisualEventItem[],
): RundownItem[] => {
  const stageHistory = replayEvents
    .filter((event) => event.raw.type === "stage.changed")
    .map((event) => event.stageId)
    .filter((value): value is string => typeof value === "string");
  const visited = new Set(stageHistory);
  const currentIndex = stageTemplates.findIndex((entry) => entry.id === currentStageId);
  return stageTemplates.map((stage, index) => {
    const stageEvents = getStageEvents(replayEvents, stage.id);
    const status =
      stage.id === currentStageId
        ? "active"
        : currentIndex >= 0
          ? index < currentIndex
            ? "done"
            : "pending"
          : visited.has(stage.id)
            ? "done"
            : "pending";
    return {
      stageId: stage.id,
      title: formatStageTitle(stage, stage.id),
      status,
      summary:
        stageEvents.length > 0
          ? stageEvents.slice(-2).map((entry) => entry.summary).join(" / ")
          : stage.allowedActions?.join(", ") ?? "no recent authority events",
    };
  });
};

const buildScoreboard = (scoreSummary: GatewayScoreSummarySnapshot[]): ScoreboardRow[] =>
  [...scoreSummary]
    .sort((left, right) => {
      if (right.averageScore !== left.averageScore) {
        return right.averageScore - left.averageScore;
      }
      return (left.teamId ?? left.targetId).localeCompare(right.teamId ?? right.targetId);
    })
    .map((entry, index) => ({
      rank: index + 1,
      teamId: entry.teamId ?? entry.targetId,
      submissionId: entry.submissionId ?? null,
      averageScore: entry.averageScore,
      totalScore: entry.totalScore,
      judgeCount: entry.judgeCount,
      lastSubmittedAt: entry.lastSubmittedAt,
    }));

const buildTeamArena = (snapshotResponse: OrchestratorSnapshotResponse, replayEvents: VisualEventItem[]): TeamArenaEntry[] => {
  const world = snapshotResponse.snapshot.world;
  if (!world) {
    return [];
  }
  return world.teams.map((team) => ({
    teamId: team.id,
    roomId: team.roomId ?? "unplaced",
    members: team.memberIds.map((memberId) => {
      const entity = world.entities.find((entry) => entry.id === memberId);
      const latest = [...replayEvents]
        .reverse()
        .find((entry) => entry.raw.actorId === memberId || (entry.summary.includes(memberId)));
      return {
        entityId: memberId,
        roomId: entity?.roomId ?? "unplaced",
        latest: latest?.summary ?? null,
      };
    }),
    recent: replayEvents
      .filter((entry) => entry.summary.includes(team.id) || team.memberIds.some((memberId) => entry.summary.includes(memberId)))
      .slice(-3)
      .map((entry) => entry.summary),
  }));
};

const stringifyValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.join(" / ");
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (isRecord(value)) {
    return JSON.stringify(value);
  }
  return "n/a";
};

const buildActDetail = (state: VisualAuthorityState, replayEvents: VisualEventItem[], scoreboard: ScoreboardRow[], winnerTeamId: string | null): ActDetail => {
  const stageId = state.snapshotResponse.snapshot.activityRun?.currentStageId as StageId | null;
  const world = state.snapshotResponse.snapshot.world;
  const social = state.snapshotResponse.snapshot.social;
  const submissions = state.snapshotResponse.snapshot.submissions ?? [];
  const rawReplay = state.replayPage.events;

  if (stageId === "act-1-intro") {
    const introTalks = getStageEvents(replayEvents, stageId).filter((event) => event.raw.type === "agent.talked");
    const pulse = getStageEvents(replayEvents, stageId)
      .filter((event) => SOCIAL_PULSE_TYPES.has(event.raw.type))
      .slice(-6)
      .map((event) => event.summary);
    const contestants = (world?.entities ?? [])
      .filter((entity) => entity.id.startsWith("contestant-"))
      .map((entity) => ({
        entityId: entity.id,
        latestLine: [...introTalks].reverse().find((event) => event.raw.actorId === entity.id)?.summary ?? null,
        latestReaction:
          [...getStageEvents(replayEvents, stageId)]
            .reverse()
            .find((event) => event.raw.type === "reaction.added" && event.summary.includes(entity.id))
            ?.summary ?? null,
        latestVote:
          [...getStageEvents(replayEvents, stageId)]
            .reverse()
            .find((event) => event.raw.type === "vote.cast")
            ?.summary ?? null,
      }));
    return { kind: "act-1-intro", contestants, viewerPulse: pulse };
  }

  if (stageId === "act-2-preference") {
    return {
      kind: "act-2-preference",
      lines: getStageEvents(replayEvents, stageId)
        .filter((event) => event.raw.type === "agent.talked")
        .map((event) => ({
          actorId: event.actorId ?? "unknown",
          message: event.summary,
          timeLabel: event.timeLabel,
        })),
    };
  }

  if (stageId === "act-3-assignment") {
    return {
      kind: "act-3-assignment",
      teams: (world?.teams ?? []).map((team) => ({
        teamId: team.id,
        roomId: team.roomId ?? "unplaced",
        members: team.memberIds,
      })),
      revealLines: getStageEvents(replayEvents, stageId).slice(-6).map((event) => event.summary),
    };
  }

  if (stageId === "act-4-discussion") {
    const timer = (state.snapshotResponse.snapshot.timers ?? []).find((entry) => entry.stageId === stageId);
    return {
      kind: "act-4-discussion",
      rooms: (world?.rooms ?? [])
        .filter((room) => room.id.startsWith("team-room-"))
        .map((room) => ({
          roomId: room.id,
          occupants: (world?.entities ?? [])
            .filter((entity) => entity.roomId === room.id)
            .map((entity) => entity.id),
          latestLines: getStageEvents(replayEvents, stageId)
            .filter((event) => event.summary.includes(room.id))
            .slice(-3)
            .map((event) => event.summary),
        })),
      timerLabel: timer ? `${Math.max(0, Math.round(timer.remainingMs / 1000))}s remaining` : null,
    };
  }

  if (stageId === "act-5-submission") {
    const teamSubmissions = submissions.filter((entry) => entry.stageId === stageId && entry.teamId);
    return {
      kind: "act-5-submission",
      submissions: teamSubmissions.map((submission) => ({
        teamId: submission.teamId ?? "n/a",
        submissionId: submission.id,
        state: submission.locked ? "locked" : "open",
        updatedLabel: formatTime(submission.updatedAt),
        fields: Object.entries(submission.data ?? {}).map(([key, value]) => ({
          key,
          value: stringifyValue(value),
        })),
      })),
      allLocked: teamSubmissions.length > 0 && teamSubmissions.every((entry) => entry.locked),
    };
  }

  if (stageId === "act-6-human-review") {
    const stageEvents = getStageEvents(replayEvents, stageId);
    return {
      kind: "act-6-human-review",
      quoteLines: stageEvents
        .filter((event) => event.raw.type === "agent.talked" || event.raw.type === "broadcast.sent")
        .slice(-6)
        .map((event) => event.summary),
      pulseLines: stageEvents
        .filter((event) => SOCIAL_PULSE_TYPES.has(event.raw.type))
        .slice(-6)
        .map((event) => event.summary),
    };
  }

  if (stageId === "act-7-ai-judging") {
    const bySubmission = new Map<string, ActDetailJudging["submissions"][number]>();
    for (const score of state.scoresPage.scores) {
      const submissionId = score.submissionId ?? score.targetId;
      const existing = bySubmission.get(submissionId) ?? {
        teamId: score.teamId ?? "n/a",
        submissionId,
        judges: [],
        averageScore: 0,
      };
      existing.judges.push({
        judgeId: score.judgeId ?? "judge",
        score: score.score,
        reason: score.reason,
        favorite: score.annotations?.favorite ?? null,
        mostAbsurd: score.annotations?.mostAbsurd ?? null,
      });
      bySubmission.set(submissionId, existing);
    }
    for (const entry of bySubmission.values()) {
      entry.averageScore =
        entry.judges.reduce((sum, judge) => sum + judge.score, 0) /
        Math.max(1, entry.judges.length);
    }
    return {
      kind: "act-7-ai-judging",
      submissions: [...bySubmission.values()].sort((left, right) => right.averageScore - left.averageScore),
    };
  }

  if (stageId === "act-8-awards") {
    return {
      kind: "act-8-awards",
      awards: (state.snapshotResponse.snapshot.awards ?? []).map((award) => ({
        label: award.label ?? "award",
        entityId: award.entityId ?? null,
        reason: award.reason ?? null,
      })),
      leaderLabel: winnerTeamId ?? scoreboard[0]?.teamId ?? null,
      leaderMode:
        state.snapshotResponse.snapshot.activityRun?.status === "finished" || winnerTeamId
          ? "winner"
          : "current leader",
    };
  }

  if (stageId === "act-9-co-creation") {
    const poems = submissions
      .filter((entry) => entry.stageId === stageId && entry.schemaId === "personal-poem-v1")
      .map((entry) => ({
        submissionId: entry.id,
        authorId: entry.versions?.at(-1)?.actorId ?? null,
        poem: typeof entry.data?.poem === "string" ? entry.data.poem : "(no poem)",
        mood:
          typeof entry.data?.moodAtSubmission === "string"
            ? entry.data.moodAtSubmission
            : null,
      }));
    const pixels = rawReplay
      .filter((event) => event.type === "draw.submitted")
      .map((event) => {
        const payload = isRecord(event.payload) ? event.payload : {};
        const data = isRecord(payload.data) ? payload.data : {};
        return {
          entityId: readString(payload, "entityId") ?? event.actorId ?? "artist",
          x: readNumber(data, "x") ?? 0,
          y: readNumber(data, "y") ?? 0,
          color: readString(data, "color") ?? "silver",
        };
      });
    return { kind: "act-9-co-creation", poems, pixels };
  }

  const finishEvent = [...rawReplay].reverse().find((event) => event.type === "activity.finished");
  const finishPayload = finishEvent && isRecord(finishEvent.payload) ? finishEvent.payload : {};
  return {
    kind: "act-10-open-mic",
    lines: getStageEvents(replayEvents, "act-10-open-mic")
      .filter((event) => event.raw.type === "agent.talked" || event.raw.type === "broadcast.sent")
      .slice(-8)
      .map((event) => event.summary),
    finishLines: [
      winnerTeamId ? `winner: ${winnerTeamId}` : "winner pending",
      readString(finishPayload, "note") ?? "no finish note",
      ...(social?.betSettlements ?? []).map((entry) => `${entry.actorId} ${entry.result} ${entry.targetId}`),
    ],
  };
};

export const buildLiveVisualModel = (state: VisualAuthorityState): LiveVisualModel => {
  const stageTemplates = state.snapshotResponse.stageTemplates ?? [];
  const replayEvents = state.replayPage.events.map(describeEvent);
  const recentEvents = state.eventsPage.events.map(describeEvent);
  const currentStageId = state.snapshotResponse.snapshot.activityRun?.currentStageId ?? null;
  const currentStage = stageTemplates.find((stage) => stage.id === currentStageId);
  const { winnerTeamId, finishNote } = getWinner(state.replayPage.events);
  const scoreboard = buildScoreboard(state.scoresPage.scoreSummary ?? state.snapshotResponse.snapshot.scoreSummary ?? []);
  const social = state.snapshotResponse.snapshot.social;

  return {
    runId: state.snapshotResponse.snapshot.activityRun?.id ?? "unknown-run",
    status: state.snapshotResponse.snapshot.activityRun?.status ?? "unknown",
    currentStageId,
    currentStageTitle: formatStageTitle(currentStage, currentStageId),
    currentStageAccent: STAGE_ACCENTS[currentStageId ?? ""] ?? "intro",
    winnerTeamId,
    finishNote,
    stageLabel: currentStageId ?? "no-stage",
    stageClockLabel:
      state.snapshotResponse.snapshot.activityRun?.endedAt
        ? `closed @ ${formatTime(state.snapshotResponse.snapshot.activityRun.endedAt)}`
        : `live @ ${formatTime(Date.now())}`,
    heroLines: [
      `status: ${state.snapshotResponse.snapshot.activityRun?.status ?? "unknown"}`,
      winnerTeamId ? `winner: ${winnerTeamId}` : "winner: pending",
      finishNote ? `finish note: ${finishNote}` : "authority loop still open",
    ],
    ticker: recentEvents.slice(-8).reverse().map((event) => `${event.timeLabel}  ${event.summary}`),
    rundown: buildRundown(stageTemplates, currentStageId, replayEvents),
    eventTimeline: replayEvents.slice(-40),
    scoreboard,
    teamArena: buildTeamArena(state.snapshotResponse, replayEvents),
    socialHeat: {
      audienceHeat: (social?.audienceHeat ?? []).slice(0, 5).map((entry) => `${entry.scope} ${entry.targetId} / ${entry.value}`),
      betHeat: (social?.betHeat ?? []).slice(0, 5).map((entry) => `${entry.scope} ${entry.targetId} / ${entry.value}`),
      reactionTotals: (social?.reactionTotals ?? []).slice(0, 5).map((entry) => `${entry.targetId} / ${entry.total}`),
      voteSummary: (social?.voteSummary ?? []).slice(0, 5).map((entry) => `${entry.targetId} / ${entry.totalValue}`),
      settlements: (social?.betSettlements ?? []).slice(0, 5).map((entry) => `${entry.actorId} ${entry.result} ${entry.targetId}`),
    },
    actDetail: buildActDetail(state, replayEvents, scoreboard, winnerTeamId),
  };
};
