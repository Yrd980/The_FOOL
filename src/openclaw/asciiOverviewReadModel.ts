import type {
  OrchestratorEventPage,
  OrchestratorSnapshotResponse,
  OrchestratorStageTemplate,
} from "./orchestratorQueryClient";
import type {
  GatewayEventEnvelope,
  GatewayScoreSummarySnapshot,
  GatewaySubmissionSnapshot,
  GatewayTimerSnapshot,
} from "./gateway/types";
import {
  DEFAULT_TEAM_TRAIL_LIMIT,
  formatClockLabel,
  isRecord,
  readNumber,
  readString,
  readStringArray,
  unique,
} from "./asciiOverviewSupport";

export interface DescribedEvent {
  type: string;
  sequence: number;
  timestamp: number;
  timestampLabel: string;
  actorId: string | null;
  summary: string;
  teamIds: string[];
  entityIds: string[];
  roomIds: string[];
  stageIds: string[];
  submissionId: string | null;
  scoreValue: number | null;
}

export interface BuildOpenClawAsciiReadModelArgs {
  snapshotResponse: OrchestratorSnapshotResponse;
  eventsPage: OrchestratorEventPage;
  replayPage?: OrchestratorEventPage;
  eventLimit?: number;
  now?: number;
}

export interface RunOutcomeSummary {
  settled: boolean;
  settlementMode: string | null;
  winningTargetType: string | null;
  winningTargetId: string | null;
  winnerLabel: string | null;
  note: string | null;
  endedAt: number | null;
}

export interface ActCheckpointSummary {
  stageId: string;
  title: string;
  status: "pending" | "active" | "done";
  summary: string;
}

export interface FullRunSummary {
  talkCount: number;
  broadcastCount: number;
  reactionCount: number;
  betCount: number;
  voteCount: number;
  submissionCount: number;
  lockedSubmissionCount: number;
  scoreCount: number;
  awardCount: number;
  settlementCount: number;
}

export interface CloseoutCapsuleSummary {
  lines: string[];
}

export interface OpenClawAsciiOverviewReadModel {
  activityRun: OrchestratorSnapshotResponse["snapshot"]["activityRun"];
  actCheckpoints: ActCheckpointSummary[];
  awards: NonNullable<OrchestratorSnapshotResponse["snapshot"]["awards"]>;
  closeoutCapsule: CloseoutCapsuleSummary;
  currentStageTemplate?: OrchestratorStageTemplate;
  entityRoomMap: Map<string, string>;
  entityTeamMap: Map<string, string>;
  fullRunSummary: FullRunSummary;
  healthTimestamp: number | null | undefined;
  historyEvents: DescribedEvent[];
  latestMemberActivityById: Map<string, DescribedEvent>;
  latestTargetedEntityActivityById: Map<string, DescribedEvent>;
  latestTeamActivityById: Map<string, DescribedEvent>;
  lastSequence: number;
  now: number;
  pendingObligations: string[];
  recentEventCount: number;
  replayEventCount: number;
  resolvedEventLimit: number;
  runOutcome: RunOutcomeSummary;
  scoreSummary: GatewayScoreSummarySnapshot[];
  social: OrchestratorSnapshotResponse["snapshot"]["social"];
  socialEvents: DescribedEvent[];
  stageHistory: string[];
  stageTemplates: OrchestratorStageTemplate[];
  submissions: GatewaySubmissionSnapshot[];
  teamTrailById: Map<string, DescribedEvent[]>;
  timers: GatewayTimerSnapshot[];
  world: OrchestratorSnapshotResponse["snapshot"]["world"];
}

const findCurrentStageTemplate = (
  snapshotResponse: OrchestratorSnapshotResponse,
): OrchestratorStageTemplate | undefined =>
  snapshotResponse.stageTemplates?.find(
    (entry) => entry.id === snapshotResponse.snapshot.activityRun?.currentStageId,
  );

const describeEvent = (event: GatewayEventEnvelope): DescribedEvent => {
  const payload = isRecord(event.payload) ? event.payload : {};
  const actorId =
    typeof event.actorId === "string" && event.actorId.trim().length > 0
      ? event.actorId.trim()
      : null;
  const sequence = event.sequence ?? 0;
  const timestamp = event.timestamp;
  const timestampLabel = formatClockLabel(timestamp);

  if (event.type === "activity.started") {
    const stageId = readString(payload, "stageId");
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: stageId ? `activity started -> ${stageId}` : "activity started",
      teamIds: [],
      entityIds: [],
      roomIds: [],
      stageIds: stageId ? [stageId] : [],
      submissionId: null,
      scoreValue: null,
    };
  }

  if (event.type === "stage.changed") {
    const toStageId = readString(payload, "toStageId", "currentStageId", "stageId");
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: toStageId ? `stage -> ${toStageId}` : "stage changed",
      teamIds: [],
      entityIds: [],
      roomIds: [],
      stageIds: toStageId ? [toStageId] : [],
      submissionId: null,
      scoreValue: null,
    };
  }

  if (event.type.startsWith("submission.")) {
    const rawSubmission = isRecord(payload.submission) ? payload.submission : payload;
    const submissionId = readString(rawSubmission, "id", "submissionId") ?? "submission";
    const teamId = readString(rawSubmission, "teamId");
    const version = readNumber(rawSubmission, "version");
    const stageId = readString(rawSubmission, "stageId");
    const action =
      event.type === "submission.opened"
        ? `open ${submissionId}`
        : event.type === "submission.locked"
          ? `lock ${submissionId}`
          : version !== null
            ? `submit ${submissionId} v${version}`
            : `submit ${submissionId}`;

    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: action,
      teamIds: teamId ? [teamId] : [],
      entityIds: [],
      roomIds: [],
      stageIds: stageId ? [stageId] : [],
      submissionId,
      scoreValue: null,
    };
  }

  if (event.type === "judge.score_submitted") {
    const rawScore = isRecord(payload.judgeScore) ? payload.judgeScore : payload;
    const submissionId =
      readString(rawScore, "submissionId", "targetId") ??
      readString(payload, "submissionId", "targetId") ??
      "submission";
    const score = readNumber(rawScore, "score") ?? readNumber(payload, "score");
    const teamId = readString(rawScore, "teamId") ?? readString(payload, "teamId");
    const stageId = readString(rawScore, "stageId") ?? readString(payload, "stageId");

    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary:
        score === null
          ? `score ${submissionId}`
          : `score ${submissionId} = ${score}/10`,
      teamIds: teamId ? [teamId] : [],
      entityIds: [],
      roomIds: [],
      stageIds: stageId ? [stageId] : [],
      submissionId,
      scoreValue: score,
    };
  }

  if (event.type === "entity.moved") {
    const entityId = readString(payload, "entityId") ?? event.entityId ?? null;
    const toRoomId = readString(payload, "toRoomId", "roomId") ?? "unknown-room";
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: entityId ? `move ${entityId} -> ${toRoomId}` : `move -> ${toRoomId}`,
      teamIds: [],
      entityIds: entityId ? [entityId] : [],
      roomIds: [toRoomId],
      stageIds: [],
      submissionId: null,
      scoreValue: null,
    };
  }

  if (event.type === "team.assigned") {
    const rawTeam = isRecord(payload.team) ? payload.team : payload;
    const teamId = readString(rawTeam, "id", "teamId") ?? "team";
    const roomId = readString(rawTeam, "roomId");
    const memberIds = readStringArray(rawTeam.memberIds);
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: roomId ? `assign ${teamId} -> ${roomId}` : `assign ${teamId}`,
      teamIds: [teamId],
      entityIds: memberIds,
      roomIds: roomId ? [roomId] : [],
      stageIds: [],
      submissionId: null,
      scoreValue: null,
    };
  }

  if (event.type === "draw.submitted") {
    const entityId = readString(payload, "entityId") ?? event.entityId ?? null;
    const stageId = readString(payload, "stageId");
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: entityId ? `draw ${entityId}` : "draw",
      teamIds: [],
      entityIds: entityId ? [entityId] : [],
      roomIds: [],
      stageIds: stageId ? [stageId] : [],
      submissionId: null,
      scoreValue: null,
    };
  }

  if (event.type === "award.granted") {
    const rawAward = isRecord(payload.award) ? payload.award : payload;
    const label = readString(rawAward, "label") ?? "award";
    const entityId = readString(rawAward, "entityId");
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: entityId ? `award ${label} -> ${entityId}` : `award ${label}`,
      teamIds: [],
      entityIds: entityId ? [entityId] : [],
      roomIds: [],
      stageIds: [],
      submissionId: null,
      scoreValue: null,
    };
  }

  if (event.type === "agent.talked") {
    const message = readString(payload, "message") ?? "(empty)";
    const roomId = readString(payload, "roomId");
    const stageId = readString(payload, "stageId");
    const targetEntityId = readString(payload, "targetEntityId");
    const audienceScope = readString(payload, "audienceScope");
    const scopeLabel =
      targetEntityId
        ? ` -> ${targetEntityId}`
        : roomId
          ? ` @ ${roomId}`
          : audienceScope
            ? ` [${audienceScope}]`
            : "";
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: `talk${scopeLabel}: ${message}`,
      teamIds: [],
      entityIds: targetEntityId ? [targetEntityId] : actorId ? [actorId] : [],
      roomIds: roomId ? [roomId] : [],
      stageIds: stageId ? [stageId] : [],
      submissionId: null,
      scoreValue: null,
    };
  }

  if (event.type === "broadcast.sent") {
    const message = readString(payload, "message") ?? "(empty)";
    const roomId = readString(payload, "roomId");
    const teamId = readString(payload, "teamId");
    const stageId = readString(payload, "stageId");
    const audienceScope = readString(payload, "audienceScope") ?? "global";
    const targetLabel = teamId
      ? `team ${teamId}`
      : roomId
        ? `room ${roomId}`
        : audienceScope;
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: `broadcast ${targetLabel}: ${message}`,
      teamIds: teamId ? [teamId] : [],
      entityIds: [],
      roomIds: roomId ? [roomId] : [],
      stageIds: stageId ? [stageId] : [],
      submissionId: null,
      scoreValue: null,
    };
  }

  if (event.type === "reaction.added") {
    const reaction = readString(payload, "reaction") ?? "reaction";
    const roomId = readString(payload, "roomId");
    const targetEntityId = readString(payload, "targetEntityId");
    const targetTeamId = readString(payload, "targetTeamId");
    const stageId = readString(payload, "stageId");
    const note = readString(payload, "note");
    const targetLabel = targetEntityId
      ? ` -> ${targetEntityId}`
      : targetTeamId
        ? ` -> ${targetTeamId}`
        : roomId
          ? ` @ ${roomId}`
          : "";
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: `react ${reaction}${targetLabel}${note ? `: ${note}` : ""}`,
      teamIds: targetTeamId ? [targetTeamId] : [],
      entityIds: targetEntityId ? [targetEntityId] : [],
      roomIds: roomId ? [roomId] : [],
      stageIds: stageId ? [stageId] : [],
      submissionId: null,
      scoreValue: null,
    };
  }

  if (event.type === "bet.placed") {
    const targetType = readString(payload, "targetType") ?? "target";
    const targetId = readString(payload, "targetId") ?? "unknown";
    const roomId = readString(payload, "roomId");
    const stageId = readString(payload, "stageId");
    const amount = readNumber(payload, "amount");
    const odds = readNumber(payload, "odds");
    const stance = readString(payload, "stance");
    const note = readString(payload, "note");
    const betBits = [
      amount === null ? null : `amount=${amount}`,
      odds === null ? null : `odds=${odds}`,
      stance ? `stance=${stance}` : null,
      note ? `note=${note}` : null,
    ]
      .filter((entry): entry is string => entry !== null)
      .join(" ");
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: `bet ${targetType}:${targetId}${betBits ? ` ${betBits}` : ""}`,
      teamIds: targetType === "team" ? [targetId] : [],
      entityIds: targetType === "entity" ? [targetId] : [],
      roomIds: roomId ? [roomId] : [],
      stageIds: stageId ? [stageId] : [],
      submissionId: targetType === "submission" ? targetId : null,
      scoreValue: null,
    };
  }

  if (event.type === "vote.cast") {
    const targetType = readString(payload, "targetType") ?? "target";
    const targetId = readString(payload, "targetId") ?? "unknown";
    const roomId = readString(payload, "roomId");
    const stageId = readString(payload, "stageId");
    const value = readNumber(payload, "value");
    const note = readString(payload, "note");
    const voteBits = [
      value === null ? null : `value=${value}`,
      note ? `note=${note}` : null,
    ]
      .filter((entry): entry is string => entry !== null)
      .join(" ");
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: `vote ${targetType}:${targetId}${voteBits ? ` ${voteBits}` : ""}`,
      teamIds: targetType === "team" ? [targetId] : [],
      entityIds: targetType === "entity" ? [targetId] : [],
      roomIds: roomId ? [roomId] : [],
      stageIds: stageId ? [stageId] : [],
      submissionId: targetType === "submission" ? targetId : null,
      scoreValue: value,
    };
  }

  if (event.type === "activity.finished") {
    const settlementMode = readString(payload, "settlementMode");
    const winningTargetType = readString(payload, "winningTargetType");
    const winningTargetId = readString(payload, "winningTargetId");
    const note = readString(payload, "note");
    const winnerLabel =
      winningTargetType && winningTargetId
        ? ` -> ${winningTargetType}:${winningTargetId}`
        : settlementMode
          ? ` [${settlementMode}]`
          : "";
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: `activity finished${winnerLabel}${note ? ` (${note})` : ""}`,
      teamIds:
        winningTargetType === "team" && winningTargetId ? [winningTargetId] : [],
      entityIds:
        winningTargetType === "entity" && winningTargetId
          ? [winningTargetId]
          : [],
      roomIds: [],
      stageIds: [],
      submissionId:
        winningTargetType === "submission" ? winningTargetId ?? null : null,
      scoreValue: null,
    };
  }

  if (event.type.startsWith("timer.")) {
    const rawTimer = isRecord(payload.timer) ? payload.timer : payload;
    const stageId = readString(rawTimer, "stageId") ?? readString(payload, "stageId");
    return {
      type: event.type,
      sequence,
      timestamp,
      timestampLabel,
      actorId,
      summary: stageId ? `${event.type} ${stageId}` : event.type,
      teamIds: [],
      entityIds: [],
      roomIds: [],
      stageIds: stageId ? [stageId] : [],
      submissionId: null,
      scoreValue: null,
    };
  }

  return {
    type: event.type,
    sequence,
    timestamp,
    timestampLabel,
    actorId,
    summary: event.type,
    teamIds: [],
    entityIds: [],
    roomIds: [],
    stageIds: [],
    submissionId: null,
    scoreValue: null,
  };
};

const dedupeEventsBySequence = (
  events: GatewayEventEnvelope[],
): GatewayEventEnvelope[] => {
  const bySequence = new Map<number, GatewayEventEnvelope>();
  for (const event of events) {
    bySequence.set(event.sequence ?? 0, event);
  }
  return [...bySequence.values()];
};

const buildStageHistory = ({
  stageTemplates,
  currentStageId,
  replayEvents,
}: {
  stageTemplates: OrchestratorStageTemplate[];
  currentStageId: string | null;
  replayEvents: DescribedEvent[];
}): string[] => {
  const history: string[] = [];
  for (const event of [...replayEvents].sort((left, right) => left.sequence - right.sequence)) {
    for (const stageId of event.stageIds) {
      if (!stageId) {
        continue;
      }
      if (history.at(-1) !== stageId) {
        history.push(stageId);
      }
    }
  }

  if (currentStageId && history.at(-1) !== currentStageId) {
    history.push(currentStageId);
  }

  if (history.length > 0) {
    return history;
  }

  if (currentStageId) {
    return [currentStageId];
  }

  return stageTemplates[0] ? [stageTemplates[0].id] : [];
};

const SOCIAL_EVENT_TYPES = new Set([
  "agent.talked",
  "broadcast.sent",
  "reaction.added",
  "bet.placed",
  "vote.cast",
]);

const buildLatestMemberActivityById = (
  historyEvents: DescribedEvent[],
): Map<string, DescribedEvent> => {
  const latestById = new Map<string, DescribedEvent>();

  for (const entry of historyEvents) {
    const ids = unique([
      ...(entry.actorId ? [entry.actorId] : []),
      ...entry.entityIds,
    ]);
    for (const id of ids) {
      if (!latestById.has(id)) {
        latestById.set(id, entry);
      }
    }
  }

  return latestById;
};

const buildLatestTargetedEntityActivityById = (
  historyEvents: DescribedEvent[],
): Map<string, DescribedEvent> => {
  const latestById = new Map<string, DescribedEvent>();

  for (const entry of historyEvents) {
    for (const entityId of unique(entry.entityIds)) {
      if (!latestById.has(entityId)) {
        latestById.set(entityId, entry);
      }
    }
  }

  return latestById;
};

const buildTeamActivityIndex = (historyEvents: DescribedEvent[]): {
  latestTeamActivityById: Map<string, DescribedEvent>;
  teamTrailById: Map<string, DescribedEvent[]>;
} => {
  const latestTeamActivityById = new Map<string, DescribedEvent>();
  const teamTrailById = new Map<string, DescribedEvent[]>();

  for (const entry of historyEvents) {
    for (const teamId of unique(entry.teamIds)) {
      if (!latestTeamActivityById.has(teamId)) {
        latestTeamActivityById.set(teamId, entry);
      }

      const trail = teamTrailById.get(teamId) ?? [];
      if (trail.length < DEFAULT_TEAM_TRAIL_LIMIT) {
        trail.push(entry);
        teamTrailById.set(teamId, trail);
      }
    }
  }

  return { latestTeamActivityById, teamTrailById };
};

const isContestantId = (value: string | null): value is string =>
  typeof value === "string" && /^contestant-\d+$/.test(value);

const isLaterStageReached = (
  stageTemplates: OrchestratorStageTemplate[],
  currentStageId: string | null,
  targetStageId: string,
): boolean => {
  const currentIndex = stageTemplates.findIndex((entry) => entry.id === currentStageId);
  const targetIndex = stageTemplates.findIndex((entry) => entry.id === targetStageId);
  return currentIndex >= 0 && targetIndex >= 0 && currentIndex > targetIndex;
};

const summarizeRunOutcome = (
  activityRun: OrchestratorSnapshotResponse["snapshot"]["activityRun"],
  historyEvents: DescribedEvent[],
): RunOutcomeSummary => {
  const finishedEvent = [...historyEvents].find((entry) => entry.type === "activity.finished");
  const match = finishedEvent?.summary.match(/activity finished(?: -> ([^:]+):([^\s(]+))?/);
  const winningTargetType = match?.[1] ?? null;
  const winningTargetId = match?.[2] ?? null;
  const winnerLabel =
    winningTargetType && winningTargetId ? `${winningTargetType}:${winningTargetId}` : null;
  const noteMatch = finishedEvent?.summary.match(/\((.+)\)$/);

  return {
    settled: activityRun?.status === "finished" || finishedEvent !== undefined,
    settlementMode:
      finishedEvent?.summary.includes("[push]") ? "push" : winnerLabel ? "winner" : null,
    winningTargetType,
    winningTargetId,
    winnerLabel,
    note: noteMatch?.[1] ?? null,
    endedAt:
      typeof activityRun?.endedAt === "number"
        ? activityRun.endedAt
        : (finishedEvent?.timestamp ?? null),
  };
};

const buildFullRunSummary = ({
  historyEvents,
  submissions,
  awards,
  scoreSummary,
  social,
}: {
  historyEvents: DescribedEvent[];
  submissions: GatewaySubmissionSnapshot[];
  awards: NonNullable<OrchestratorSnapshotResponse["snapshot"]["awards"]>;
  scoreSummary: GatewayScoreSummarySnapshot[];
  social: OrchestratorSnapshotResponse["snapshot"]["social"];
}): FullRunSummary => ({
  talkCount: historyEvents.filter((entry) => entry.type === "agent.talked").length,
  broadcastCount: historyEvents.filter((entry) => entry.type === "broadcast.sent").length,
  reactionCount: historyEvents.filter((entry) => entry.type === "reaction.added").length,
  betCount: historyEvents.filter((entry) => entry.type === "bet.placed").length,
  voteCount: historyEvents.filter((entry) => entry.type === "vote.cast").length,
  submissionCount: submissions.length,
  lockedSubmissionCount: submissions.filter((entry) => entry.locked).length,
  scoreCount: scoreSummary.reduce((total, entry) => total + entry.judgeCount, 0),
  awardCount: awards.length,
  settlementCount: social?.betSettlements?.length ?? 0,
});

const buildCloseoutCapsule = ({
  runOutcome,
  scoreSummary,
  awards,
  social,
}: {
  runOutcome: RunOutcomeSummary;
  scoreSummary: GatewayScoreSummarySnapshot[];
  awards: NonNullable<OrchestratorSnapshotResponse["snapshot"]["awards"]>;
  social: OrchestratorSnapshotResponse["snapshot"]["social"];
}): CloseoutCapsuleSummary => {
  const podium = [...scoreSummary]
    .sort((left, right) => {
      if (right.averageScore !== left.averageScore) {
        return right.averageScore - left.averageScore;
      }
      return (right.lastSubmittedAt ?? 0) - (left.lastSubmittedAt ?? 0);
    })
    .slice(0, 3)
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.teamId ?? entry.targetId} avg=${entry.averageScore.toFixed(2)} judges=${entry.judgeCount}`,
    );
  const mostAbsurd = awards.find((entry) => entry.awardId === "most-absurd");
  const lines = [
    `winner=${runOutcome.winnerLabel ?? "pending"} settlement=${runOutcome.settlementMode ?? "pending"}`,
    runOutcome.note ? `finish_note=${runOutcome.note}` : null,
    mostAbsurd
      ? `most_absurd=${mostAbsurd.entityId ?? "n/a"} reason=${mostAbsurd.reason ?? "n/a"}`
      : null,
    podium.length > 0 ? `podium=${podium.join(" | ")}` : null,
    typeof social?.betSettlements?.length === "number"
      ? `bet_settlements=${social.betSettlements.length}`
      : null,
  ].filter((entry): entry is string => entry !== null);
  return { lines };
};

const buildActCheckpoints = ({
  activityRun,
  stageTemplates,
  stageHistory,
  historyEvents,
  submissions,
  scoreSummary,
  awards,
}: {
  activityRun: OrchestratorSnapshotResponse["snapshot"]["activityRun"];
  stageTemplates: OrchestratorStageTemplate[];
  stageHistory: string[];
  historyEvents: DescribedEvent[];
  submissions: GatewaySubmissionSnapshot[];
  scoreSummary: GatewayScoreSummarySnapshot[];
  awards: NonNullable<OrchestratorSnapshotResponse["snapshot"]["awards"]>;
}): ActCheckpointSummary[] => {
  const currentStageId = activityRun?.currentStageId ?? null;
  const captainIds = ["contestant-01", "contestant-03", "contestant-05"];
  const contestantTalkCountByStage = (stageId: string) =>
    new Set(
      historyEvents
        .filter(
          (entry) =>
            entry.type === "agent.talked" &&
            entry.stageIds.includes(stageId) &&
            isContestantId(entry.actorId),
        )
        .map((entry) => entry.actorId),
    ).size;

  const moveCountByRoom = (roomIdPrefix: string) =>
    historyEvents.filter(
      (entry) =>
        entry.type === "entity.moved" &&
        entry.summary.includes(`-> ${roomIdPrefix}`),
    ).length;

  return stageTemplates.map((stageTemplate) => {
    const status: ActCheckpointSummary["status"] =
      currentStageId === stageTemplate.id
        ? "active"
        : stageHistory.includes(stageTemplate.id) && currentStageId !== stageTemplate.id
          ? "done"
          : isLaterStageReached(stageTemplates, currentStageId, stageTemplate.id)
            ? "done"
            : "pending";

    let summary = "no authoritative checkpoint yet";
    switch (stageTemplate.id) {
      case "act-1-intro":
        summary = `intros=${contestantTalkCountByStage(stageTemplate.id)}/6 viewer_pulse=${historyEvents.filter((entry) => entry.stageIds.includes(stageTemplate.id) && SOCIAL_EVENT_TYPES.has(entry.type)).length}`;
        break;
      case "act-2-preference":
        summary = `preferences=${contestantTalkCountByStage(stageTemplate.id)}/6`;
        break;
      case "act-3-assignment":
        summary = `host_broadcast=${historyEvents.some((entry) => entry.type === "broadcast.sent" && entry.stageIds.includes(stageTemplate.id)) ? "yes" : "no"} captain_ack=${new Set(historyEvents.filter((entry) => entry.type === "agent.talked" && entry.stageIds.includes(stageTemplate.id) && entry.actorId && captainIds.includes(entry.actorId)).map((entry) => entry.actorId)).size}/3`;
        break;
      case "act-4-discussion":
        summary = `moves=${moveCountByRoom("team-room-")} talks=${contestantTalkCountByStage(stageTemplate.id)}/6 timer=${historyEvents.some((entry) => entry.type === "timer.started" && entry.stageIds.includes(stageTemplate.id)) ? "started" : "idle"}`;
        break;
      case "act-5-submission":
        summary = `opened=${historyEvents.filter((entry) => entry.type === "submission.opened" && entry.stageIds.includes(stageTemplate.id)).length}/3 locked=${submissions.filter((entry) => entry.stageId === stageTemplate.id && entry.locked).length}/3`;
        break;
      case "act-6-human-review":
        summary = `review_social=${historyEvents.filter((entry) => entry.stageIds.includes(stageTemplate.id) && (entry.type === "agent.talked" || entry.type === "reaction.added" || entry.type === "bet.placed" || entry.type === "vote.cast")).length}`;
        break;
      case "act-7-ai-judging":
        summary = `judge_scores=${scoreSummary.reduce((total, entry) => total + entry.judgeCount, 0)} submissions=${scoreSummary.length} judge_coverage=3`;
        break;
      case "act-8-awards":
        summary = `awards=${awards.length} audience_votes=${historyEvents.filter((entry) => entry.type === "vote.cast" && entry.stageIds.includes(stageTemplate.id)).length}`;
        break;
      case "act-9-co-creation":
        summary = `quiet_moves=${moveCountByRoom("quiet-orbit")} poem_submits=${submissions.filter((entry) => entry.stageId === stageTemplate.id).length} draws=${historyEvents.filter((entry) => entry.type === "draw.submitted" && entry.stageIds.includes(stageTemplate.id)).length}`;
        break;
      case "act-10-open-mic":
        summary = `closing_talks=${contestantTalkCountByStage(stageTemplate.id)}/6 finished=${historyEvents.some((entry) => entry.type === "activity.finished") ? "yes" : "no"}`;
        break;
      default:
        break;
    }

    return {
      stageId: stageTemplate.id,
      title: stageTemplate.name ?? stageTemplate.id,
      status,
      summary,
    };
  });
};

const buildPendingObligations = ({
  activityRun,
  historyEvents,
  submissions,
  scoreSummary,
  runOutcome,
}: {
  activityRun: OrchestratorSnapshotResponse["snapshot"]["activityRun"];
  historyEvents: DescribedEvent[];
  submissions: GatewaySubmissionSnapshot[];
  scoreSummary: GatewayScoreSummarySnapshot[];
  runOutcome: RunOutcomeSummary;
}): string[] => {
  if (runOutcome.settled) {
    return ["closeout complete; no pending authoritative obligations"];
  }

  const currentStageId = activityRun?.currentStageId ?? null;
  const contestantIds = ["contestant-01", "contestant-02", "contestant-03", "contestant-04", "contestant-05", "contestant-06"];
  const captainIds = ["contestant-01", "contestant-03", "contestant-05"];
  const obligations: string[] = [];
  const stageTalkers = new Set(
    historyEvents
      .filter((entry) => entry.type === "agent.talked" && entry.stageIds.includes(currentStageId ?? ""))
      .map((entry) => entry.actorId)
      .filter((entry): entry is string => typeof entry === "string"),
  );

  if (currentStageId === "act-1-intro") {
    obligations.push(
      ...contestantIds
        .filter((id) => !stageTalkers.has(id))
        .map((id) => `${id} intro talk missing`),
    );
  } else if (currentStageId === "act-2-preference") {
    obligations.push(
      ...contestantIds
        .filter((id) => !stageTalkers.has(id))
        .map((id) => `${id} preference talk missing`),
    );
  } else if (currentStageId === "act-3-assignment") {
    if (
      !historyEvents.some(
        (entry) => entry.type === "broadcast.sent" && entry.stageIds.includes("act-3-assignment"),
      )
    ) {
      obligations.push("host assignment broadcast missing");
    }
    obligations.push(
      ...captainIds
        .filter((id) => !stageTalkers.has(id))
        .map((id) => `${id} team acknowledgement missing`),
    );
  } else if (currentStageId === "act-4-discussion") {
    obligations.push(
      ...contestantIds
        .filter((id) => !stageTalkers.has(id))
        .map((id) => `${id} discussion talk missing`),
    );
  } else if (currentStageId === "act-5-submission") {
    obligations.push(
      ...["submission-1", "submission-2", "submission-3"]
        .filter((submissionId) => !submissions.some((entry) => entry.id === submissionId && entry.locked))
        .map((submissionId) => `${submissionId} still unlocked`),
    );
  } else if (currentStageId === "act-7-ai-judging") {
    obligations.push(
      ...["submission-1", "submission-2", "submission-3"]
        .filter(
          (submissionId) =>
            (scoreSummary.find((entry) => entry.submissionId === submissionId)?.judgeCount ?? 0) < 3,
        )
        .map((submissionId) => {
          const judgeCount =
            scoreSummary.find((entry) => entry.submissionId === submissionId)?.judgeCount ?? 0;
          return `${submissionId} judge coverage incomplete (${judgeCount}/3)`;
        }),
    );
  } else if (currentStageId === "act-10-open-mic") {
    obligations.push(
      ...contestantIds
        .filter((id) => !stageTalkers.has(id))
        .map((id) => `${id} closing talk missing`),
    );
    if (!historyEvents.some((entry) => entry.type === "activity.finished")) {
      obligations.push("finish_activity missing");
    }
  }

  return obligations.length > 0 ? obligations : ["no blocking authoritative obligations visible"];
};

export const buildOpenClawAsciiReadModel = ({
  snapshotResponse,
  eventsPage,
  replayPage,
  eventLimit,
  now = Date.now(),
}: BuildOpenClawAsciiReadModelArgs): OpenClawAsciiOverviewReadModel => {
  const activityRun = snapshotResponse.snapshot.activityRun;
  const world = snapshotResponse.snapshot.world;
  const stageTemplates = snapshotResponse.stageTemplates ?? [];
  const currentStageTemplate = findCurrentStageTemplate(snapshotResponse);
  const recentEvents = [...eventsPage.events].sort(
    (left, right) => (right.sequence ?? 0) - (left.sequence ?? 0),
  );
  const historyEvents = dedupeEventsBySequence([
    ...(replayPage?.events ?? []),
    ...recentEvents,
  ])
    .sort((left, right) => (right.sequence ?? 0) - (left.sequence ?? 0))
    .map(describeEvent);
  const replayHistoryEvents = dedupeEventsBySequence(replayPage?.events ?? [])
    .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0))
    .map(describeEvent);
  const stageHistory = buildStageHistory({
    stageTemplates,
    currentStageId: activityRun?.currentStageId ?? null,
    replayEvents: replayHistoryEvents,
  });

  const entityRoomMap = new Map(
    (world?.entities ?? []).map((entity) => [entity.id, entity.roomId ?? "unplaced"]),
  );
  const entityTeamMap = new Map<string, string>();
  for (const team of world?.teams ?? []) {
    for (const memberId of team.memberIds) {
      entityTeamMap.set(memberId, team.id);
    }
  }

  const { latestTeamActivityById, teamTrailById } = buildTeamActivityIndex(historyEvents);
  const resolvedEventLimit = Math.max(
    1,
    eventLimit ?? eventsPage.events.length ?? 1,
  );
  const runOutcome = summarizeRunOutcome(activityRun, historyEvents);
  const fullRunSummary = buildFullRunSummary({
    historyEvents,
    submissions: snapshotResponse.snapshot.submissions ?? [],
    awards: snapshotResponse.snapshot.awards ?? [],
    scoreSummary: snapshotResponse.snapshot.scoreSummary ?? [],
    social: snapshotResponse.snapshot.social,
  });
  const actCheckpoints = buildActCheckpoints({
    activityRun,
    stageTemplates,
    stageHistory,
    historyEvents,
    submissions: snapshotResponse.snapshot.submissions ?? [],
    scoreSummary: snapshotResponse.snapshot.scoreSummary ?? [],
    awards: snapshotResponse.snapshot.awards ?? [],
  });
  const pendingObligations = buildPendingObligations({
    activityRun,
    historyEvents,
    submissions: snapshotResponse.snapshot.submissions ?? [],
    scoreSummary: snapshotResponse.snapshot.scoreSummary ?? [],
    runOutcome,
  });
  const closeoutCapsule = buildCloseoutCapsule({
    runOutcome,
    scoreSummary: snapshotResponse.snapshot.scoreSummary ?? [],
    awards: snapshotResponse.snapshot.awards ?? [],
    social: snapshotResponse.snapshot.social,
  });

  return {
    activityRun,
    actCheckpoints,
    awards: snapshotResponse.snapshot.awards ?? [],
    closeoutCapsule,
    currentStageTemplate,
    entityRoomMap,
    entityTeamMap,
    fullRunSummary,
    healthTimestamp: snapshotResponse.snapshot.health?.ts,
    historyEvents,
    latestMemberActivityById: buildLatestMemberActivityById(historyEvents),
    latestTargetedEntityActivityById:
      buildLatestTargetedEntityActivityById(historyEvents),
    latestTeamActivityById,
    lastSequence: snapshotResponse.snapshot.lastSequence ?? 0,
    now,
    pendingObligations,
    recentEventCount: recentEvents.length,
    replayEventCount: replayPage?.events.length ?? 0,
    resolvedEventLimit,
    runOutcome,
    scoreSummary: snapshotResponse.snapshot.scoreSummary ?? [],
    social: snapshotResponse.snapshot.social,
    socialEvents: historyEvents.filter((entry) => SOCIAL_EVENT_TYPES.has(entry.type)),
    stageHistory,
    stageTemplates,
    submissions: snapshotResponse.snapshot.submissions ?? [],
    teamTrailById,
    timers: snapshotResponse.snapshot.timers ?? [],
    world,
  };
};
