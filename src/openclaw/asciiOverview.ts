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

interface DescribedEvent {
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

const ASCII_IDLE_LABEL = "idle";
const DEFAULT_TEAM_TRAIL_LIMIT = 3;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (
  record: Record<string, unknown> | undefined,
  ...keys: string[]
): string | null => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];

const readNumber = (
  record: Record<string, unknown> | undefined,
  ...keys: string[]
): number | null => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
};

const formatClockLabel = (timestamp: number | null | undefined): string => {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "unknown";
  }

  const date = new Date(timestamp);
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":");
};

const formatDateTimeLabel = (timestamp: number | null | undefined): string => {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "unknown";
  }

  const date = new Date(timestamp);
  const day = [
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `${day} ${formatClockLabel(timestamp)}`;
};

const formatDurationLabel = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.round(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
    ].join(":");
  }

  return [
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
};

const formatTeamLabel = (teamId: string): string => {
  const match = teamId.match(/^team-(\d+)$/);
  return match ? `Team ${match[1]}` : teamId;
};

const formatEntityLabel = (entityId: string): string => {
  const match = entityId.match(/^contestant-(\d+)$/);
  return match ? `contestant-${match[1]}` : entityId;
};

const formatStageLabel = (
  stageId: string | null,
  stageTemplate?: OrchestratorStageTemplate,
): string => {
  if (!stageId) {
    return "pending";
  }

  if (stageTemplate?.allowedActions?.length) {
    return `${stageId} [${stageTemplate.allowedActions.join(", ")}]`;
  }

  return stageId;
};

const formatStageTitle = (stageTemplate: OrchestratorStageTemplate): string =>
  stageTemplate.name ? `${stageTemplate.id} (${stageTemplate.name})` : stageTemplate.id;

const unique = <T>(items: T[]): T[] => [...new Set(items)];

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

const renderSection = (
  lines: string[],
  title: string,
  content: string[],
): void => {
  lines.push("");
  lines.push(title);
  lines.push("-".repeat(title.length));
  if (content.length === 0) {
    lines.push("(none)");
    return;
  }
  lines.push(...content);
};

const renderStageLadder = ({
  stageTemplates,
  currentStageId,
  stageHistory,
}: {
  stageTemplates: OrchestratorStageTemplate[];
  currentStageId: string | null;
  stageHistory: string[];
}): string[] => {
  if (stageTemplates.length === 0) {
    return ["(no authoritative stage templates yet)"];
  }

  const currentIndex = stageTemplates.findIndex((entry) => entry.id === currentStageId);
  const visited = new Set(stageHistory);

  const lines = stageTemplates.map((stageTemplate, index) => {
    const marker =
      stageTemplate.id === currentStageId
        ? "[>]"
        : currentIndex >= 0
          ? index < currentIndex
            ? "[x]"
            : "[ ]"
          : visited.has(stageTemplate.id)
            ? "[x]"
            : "[ ]";
    const suffix =
      stageTemplate.id === currentStageId && stageTemplate.allowedActions?.length
        ? ` actions=${stageTemplate.allowedActions.join(",")}`
        : "";
    return `${marker} ${formatStageTitle(stageTemplate)}${suffix}`;
  });

  if (stageHistory.length > 0) {
    lines.push(
      `history  : ${stageHistory.join(" -> ")}`,
    );
  }

  return lines;
};

const renderRooms = ({
  rooms,
  teams,
  entities,
}: NonNullable<OrchestratorSnapshotResponse["snapshot"]["world"]>): string[] => {
  if (rooms.length === 0) {
    return ["(no authoritative rooms yet)"];
  }

  const teamLabelsByRoom = new Map<string, string[]>();
  for (const team of teams) {
    if (!team.roomId) {
      continue;
    }
    const labels = teamLabelsByRoom.get(team.roomId) ?? [];
    labels.push(formatTeamLabel(team.id));
    teamLabelsByRoom.set(team.roomId, labels);
  }

  const entityLabelsByRoom = new Map<string, string[]>();
  for (const entity of entities) {
    const roomId = entity.roomId ?? "unplaced";
    const labels = entityLabelsByRoom.get(roomId) ?? [];
    labels.push(formatEntityLabel(entity.id));
    entityLabelsByRoom.set(roomId, labels);
  }

  return rooms.flatMap((room) => {
    const teamsInRoom = unique(teamLabelsByRoom.get(room.id) ?? []).sort();
    const entitiesInRoom = unique(entityLabelsByRoom.get(room.id) ?? []).sort();
    const occupants = entitiesInRoom.length > 0 ? entitiesInRoom.join(", ") : "empty";
    const label = room.label?.trim() || room.id;
    const summary = [
      teamsInRoom.length > 0 ? `teams=${teamsInRoom.join(", ")}` : null,
      `occupants=${entitiesInRoom.length}`,
    ]
      .filter((value): value is string => value !== null)
      .join(" ");

    return [
      `|-- ${room.id} (${label}) ${summary}`,
      `|   \`-- ${occupants}`,
    ];
  });
};

const buildMemberLine = ({
  entityId,
  roomId,
  directAction,
  teamAction,
  isLast,
}: {
  entityId: string;
  roomId: string;
  directAction: DescribedEvent | undefined;
  teamAction: DescribedEvent | undefined;
  isLast: boolean;
}): string => {
  const branch = isLast ? "`--" : "|--";
  const action = directAction ?? teamAction;
  const actionLabel = action
    ? `${action.summary} @ ${action.timestampLabel}`
    : ASCII_IDLE_LABEL;

  return `|   ${branch} ${formatEntityLabel(entityId)} [${roomId}] last: ${actionLabel}`;
};

const renderTeams = ({
  teams,
  entityRoomMap,
  historyEvents,
}: {
  teams: NonNullable<OrchestratorSnapshotResponse["snapshot"]["world"]>["teams"];
  entityRoomMap: Map<string, string>;
  historyEvents: DescribedEvent[];
}): string[] => {
  if (teams.length === 0) {
    return ["(no authoritative teams yet)"];
  }

  return [...teams]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((team) => {
      const roomId = team.roomId ?? "unplaced";
      const teamEvents = historyEvents.filter((entry) => entry.teamIds.includes(team.id));
      const teamTrail = teamEvents.slice(0, DEFAULT_TEAM_TRAIL_LIMIT);
      const lines = [`|-- ${formatTeamLabel(team.id)} @ ${roomId}`];

      if (team.memberIds.length === 0) {
        lines.push("|   `-- no members");
      } else {
        team.memberIds.forEach((memberId, index) => {
          const directAction = historyEvents.find(
            (entry) => entry.actorId === memberId || entry.entityIds.includes(memberId),
          );
          lines.push(
            buildMemberLine({
              entityId: memberId,
              roomId: entityRoomMap.get(memberId) ?? "unplaced",
              directAction,
              teamAction: teamEvents[0],
              isLast: index === team.memberIds.length - 1,
            }),
          );
        });
      }

      lines.push(
        `|   trail: ${teamTrail.length > 0 ? teamTrail.map((entry) => `${entry.summary} @ ${entry.timestampLabel}`).join(" | ") : ASCII_IDLE_LABEL}`,
      );
      return lines;
    });
};

const renderUnassigned = ({
  entities,
  entityTeamMap,
  historyEvents,
}: {
  entities: NonNullable<OrchestratorSnapshotResponse["snapshot"]["world"]>["entities"];
  entityTeamMap: Map<string, string>;
  historyEvents: DescribedEvent[];
}): string[] => {
  const unassignedEntities = [...entities]
    .filter((entity) => !entityTeamMap.has(entity.id))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (unassignedEntities.length === 0) {
    return ["(none)"];
  }

  return unassignedEntities.map((entity, index) => {
    const directAction = historyEvents.find((entry) => entry.entityIds.includes(entity.id));
    return `${index === unassignedEntities.length - 1 ? "`--" : "|--"} ${formatEntityLabel(entity.id)} [${entity.roomId ?? "unplaced"}] last: ${directAction ? `${directAction.summary} @ ${directAction.timestampLabel}` : ASCII_IDLE_LABEL}`;
  });
};

const renderTimers = (timers: GatewayTimerSnapshot[]): string[] => {
  if (timers.length === 0) {
    return ["(no authoritative timers yet)"];
  }

  return [...timers]
    .sort((left, right) => (left.stageId ?? left.id).localeCompare(right.stageId ?? right.id))
    .map(
      (timer) =>
        `|-- ${timer.id} stage=${timer.stageId ?? "unknown"} state=${timer.state} remaining=${formatDurationLabel(timer.remainingMs)}`,
    );
};

const renderSubmissions = (
  submissions: GatewaySubmissionSnapshot[],
): string[] => {
  if (submissions.length === 0) {
    return ["(no authoritative submissions yet)"];
  }

  return [...submissions]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((submission) => {
      const state = submission.locked ? "locked" : "open";
      const version = submission.version ?? submission.versions?.at(-1)?.version ?? 0;
      return [
        `|-- ${submission.id} [${submission.schemaId}] team=${submission.teamId ?? "n/a"} stage=${submission.stageId ?? "n/a"} state=${state} version=v${version}`,
        `|   opened=${formatClockLabel(submission.openedAt)} updated=${formatClockLabel(submission.updatedAt)} locked=${formatClockLabel(submission.lockedAt)}`,
      ];
    });
};

const renderScoreSummary = (
  scoreSummary: GatewayScoreSummarySnapshot[],
): string[] => {
  if (scoreSummary.length === 0) {
    return ["(no authoritative scores yet)"];
  }

  return [...scoreSummary]
    .sort((left, right) => {
      if (right.averageScore !== left.averageScore) {
        return right.averageScore - left.averageScore;
      }
      return left.targetId.localeCompare(right.targetId);
    })
    .map(
      (summary) =>
        `|-- ${summary.submissionId ?? summary.targetId} team=${summary.teamId ?? "n/a"} judges=${summary.judgeCount} avg=${summary.averageScore.toFixed(2)} total=${summary.totalScore} last=${formatClockLabel(summary.lastSubmittedAt)}`,
    );
};

const renderAwards = (
  awards: NonNullable<OrchestratorSnapshotResponse["snapshot"]["awards"]>,
): string[] => {
  if (awards.length === 0) {
    return ["(no authoritative awards yet)"];
  }

  return awards.map(
    (award) =>
      `|-- ${award.awardId ?? "award"} label=${award.label ?? "award"} entity=${award.entityId ?? "n/a"} at=${formatClockLabel(award.grantedAt)} reason=${award.reason ?? "n/a"}`,
  );
};

const renderSocialSnapshot = (
  social: OrchestratorSnapshotResponse["snapshot"]["social"] | undefined,
): string[] => {
  if (!social) {
    return ["(no authoritative social snapshot yet)"];
  }

  const lines: string[] = [];
  const pushBucket = (title: string, content: string[]) => {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(title);
    lines.push(...content);
  };

  pushBucket(
    "audience_heat",
    social.audienceHeat.length > 0
      ? [...social.audienceHeat]
          .sort((left, right) => {
            if (right.value !== left.value) {
              return right.value - left.value;
            }
            return `${left.scope}:${left.targetId}`.localeCompare(
              `${right.scope}:${right.targetId}`,
            );
          })
          .map(
            (entry) =>
              `|-- ${entry.scope}:${entry.targetId} value=${entry.value} last=${formatClockLabel(entry.lastUpdatedAt)}`,
          )
      : ["(none)"],
  );

  pushBucket(
    "bet_heat",
    social.betHeat.length > 0
      ? [...social.betHeat]
          .sort((left, right) => {
            if (right.value !== left.value) {
              return right.value - left.value;
            }
            return `${left.scope}:${left.targetId}`.localeCompare(
              `${right.scope}:${right.targetId}`,
            );
          })
          .map(
            (entry) =>
              `|-- ${entry.scope}:${entry.targetId} value=${entry.value} last=${formatClockLabel(entry.lastUpdatedAt)}`,
          )
      : ["(none)"],
  );

  pushBucket(
    "reaction_totals",
    social.reactionTotals.length > 0
      ? [...social.reactionTotals]
          .sort((left, right) => {
            if (right.total !== left.total) {
              return right.total - left.total;
            }
            return `${left.scope}:${left.targetId}`.localeCompare(
              `${right.scope}:${right.targetId}`,
            );
          })
          .map((entry) => {
            const reactions = Object.entries(entry.reactions)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([reaction, total]) => `${reaction}=${total}`)
              .join(" ");
            return `|-- ${entry.scope}:${entry.targetId} total=${entry.total}${reactions ? ` ${reactions}` : ""} last=${formatClockLabel(entry.lastUpdatedAt)}`;
          })
      : ["(none)"],
  );

  pushBucket(
    "bet_summary",
    social.betSummary.length > 0
      ? [...social.betSummary]
          .sort((left, right) => {
            if (right.totalAmount !== left.totalAmount) {
              return right.totalAmount - left.totalAmount;
            }
            return `${left.targetType}:${left.targetId}`.localeCompare(
              `${right.targetType}:${right.targetId}`,
            );
          })
          .map(
            (entry) =>
              `|-- ${entry.targetType}:${entry.targetId} count=${entry.count} total=${entry.totalAmount} last=${formatClockLabel(entry.lastPlacedAt)}`,
          )
      : ["(none)"],
  );

  pushBucket(
    "vote_summary",
    social.voteSummary.length > 0
      ? [...social.voteSummary]
          .sort((left, right) => {
            if (right.totalValue !== left.totalValue) {
              return right.totalValue - left.totalValue;
            }
            return `${left.targetType}:${left.targetId}`.localeCompare(
              `${right.targetType}:${right.targetId}`,
            );
          })
          .map(
            (entry) =>
              `|-- ${entry.targetType}:${entry.targetId} count=${entry.count} total=${entry.totalValue} avg=${entry.averageValue.toFixed(2)} last=${formatClockLabel(entry.lastSubmittedAt)}`,
          )
      : ["(none)"],
  );

  pushBucket(
    "bet_settlements",
    social.betSettlements.length > 0
      ? [...social.betSettlements]
          .sort((left, right) => right.settledAt - left.settledAt)
          .map((entry) => {
            const payout =
              typeof entry.payout === "number" && Number.isFinite(entry.payout)
                ? ` payout=${entry.payout}`
                : "";
            return `|-- ${entry.actorId} ${entry.targetType}:${entry.targetId} -> ${entry.result}${payout} at=${formatClockLabel(entry.settledAt)}`;
          })
      : ["(none)"],
  );

  return lines;
};

const renderRecentEvents = ({
  events,
  eventLimit,
}: {
  events: DescribedEvent[];
  eventLimit: number;
}): string[] => {
  if (events.length === 0) {
    return ["(no events)"];
  }

  return events.slice(0, eventLimit).map((entry) => {
    const actorLabel = entry.actorId ?? "system";
    return `#${String(entry.sequence).padStart(4, "0")} ${entry.timestampLabel} ${actorLabel} :: ${entry.summary}`;
  });
};

const SOCIAL_EVENT_TYPES = new Set([
  "agent.talked",
  "broadcast.sent",
  "reaction.added",
  "bet.placed",
  "vote.cast",
]);

const renderSocialFeed = ({
  events,
  eventLimit,
}: {
  events: DescribedEvent[];
  eventLimit: number;
}): string[] => {
  const socialEvents = events.filter((entry) => SOCIAL_EVENT_TYPES.has(entry.type));
  if (socialEvents.length === 0) {
    return ["(no authoritative social events yet)"];
  }

  return socialEvents.slice(0, eventLimit).map((entry) => {
    const actorLabel = entry.actorId ?? "system";
    return `#${String(entry.sequence).padStart(4, "0")} ${entry.timestampLabel} ${actorLabel} :: ${entry.summary}`;
  });
};

export const buildOpenClawAsciiOverview = ({
  snapshotResponse,
  eventsPage,
  replayPage,
  eventLimit,
  now = Date.now(),
}: {
  snapshotResponse: OrchestratorSnapshotResponse;
  eventsPage: OrchestratorEventPage;
  replayPage?: OrchestratorEventPage;
  eventLimit?: number;
  now?: number;
}): string => {
  const activityRun = snapshotResponse.snapshot.activityRun;
  const world = snapshotResponse.snapshot.world;
  const stageTemplates = snapshotResponse.stageTemplates ?? [];
  const stageTemplate = findCurrentStageTemplate(snapshotResponse);
  const recentEvents = [...eventsPage.events]
    .sort((left, right) => (right.sequence ?? 0) - (left.sequence ?? 0));
  const mergedHistoryEvents = dedupeEventsBySequence([
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

  const resolvedEventLimit = Math.max(
    1,
    eventLimit ?? eventsPage.events.length ?? 1,
  );
  const lines = [
    "THE FOOL AUTHORITATIVE ASCII WATCH",
    "==================================",
    `run      : ${activityRun?.id ?? "unknown-run"}`,
    `template : ${activityRun?.templateId ?? "unknown-template"}`,
    `status   : ${activityRun?.status ?? "unknown"}`,
    `stage    : ${formatStageLabel(activityRun?.currentStageId ?? null, stageTemplate)}`,
    ...(typeof activityRun?.endedAt === "number" && Number.isFinite(activityRun.endedAt)
      ? [`ended    : ${formatDateTimeLabel(activityRun.endedAt)}`]
      : []),
    `sequence : ${snapshotResponse.snapshot.lastSequence ?? 0}`,
    `health   : ${formatDateTimeLabel(snapshotResponse.snapshot.health?.ts)}`,
    `updated  : ${formatDateTimeLabel(now)}`,
    `events   : showing ${Math.min(resolvedEventLimit, recentEvents.length)} of ${recentEvents.length} recent authoritative events`,
    `replay   : ${replayPage?.events.length ?? 0} historical authoritative events loaded`,
  ];

  renderSection(
    lines,
    "STAGE LADDER",
    renderStageLadder({
      stageTemplates,
      currentStageId: activityRun?.currentStageId ?? null,
      stageHistory,
    }),
  );

  renderSection(
    lines,
    "ROOMS",
    world
      ? renderRooms(world)
      : ["(authority world unavailable)"],
  );

  renderSection(
    lines,
    "TEAMS",
    world
      ? renderTeams({
          teams: world.teams,
          entityRoomMap,
          historyEvents: mergedHistoryEvents,
        })
      : ["(authority world unavailable)"],
  );

  renderSection(
    lines,
    "UNASSIGNED",
    world
      ? renderUnassigned({
          entities: world.entities,
          entityTeamMap,
          historyEvents: mergedHistoryEvents,
        })
      : ["(authority world unavailable)"],
  );

  renderSection(lines, "TIMERS", renderTimers(snapshotResponse.snapshot.timers ?? []));
  renderSection(
    lines,
    "SUBMISSIONS",
    renderSubmissions(snapshotResponse.snapshot.submissions ?? []),
  );
  renderSection(
    lines,
    "SCOREBOARD",
    renderScoreSummary(snapshotResponse.snapshot.scoreSummary ?? []),
  );
  renderSection(lines, "AWARDS", renderAwards(snapshotResponse.snapshot.awards ?? []));
  renderSection(
    lines,
    "SOCIAL SNAPSHOT",
    renderSocialSnapshot(snapshotResponse.snapshot.social),
  );
  renderSection(
    lines,
    "LIVE SOCIAL",
    renderSocialFeed({
      events: mergedHistoryEvents,
      eventLimit: resolvedEventLimit,
    }),
  );
  renderSection(
    lines,
    "RECENT AUTHORITATIVE EVENTS",
    renderRecentEvents({
      events: mergedHistoryEvents,
      eventLimit: resolvedEventLimit,
    }),
  );

  return lines.join("\n");
};
