import {
  extractActivityScoreAnnotations,
} from "../activityRuntime";
import type {
  GatewayAuditRecordSummary,
  GatewayAuditSummary,
  GatewayAuthoritativeQueryStatus,
  GatewayAwardSummary,
  GatewayBackendHealthSummary,
  GatewayDomainEventSummary,
  GatewayScoreEntrySummary,
  GatewayScoreSummaryEntry,
  GatewaySubmissionSummary,
} from "../../types";
import type {
  OrchestratorAuditResponse,
  OrchestratorEventPage,
  OrchestratorScoresResponse,
  OrchestratorSnapshotResponse,
} from "../orchestratorQueryClient";
import type {
  GatewayActivityRunSnapshot,
  GatewayEventEnvelope,
  GatewayHealthSnapshot,
  GatewayHelloPayload,
  GatewayScoreSnapshot,
  GatewayScoreSummarySnapshot,
  GatewaySessionEntry,
  GatewaySkillSnapshot,
  GatewaySnapshotEnvelope,
  GatewaySubmissionSnapshot,
  GatewayTimerSnapshot,
  GatewayWorldSnapshot,
} from "../gateway/types";

export const AUTH_FAIL_MESSAGE =
  "Gateway authentication failed. Check VITE_OPENCLAW_TOKEN.";

export const normalizeTimestamp = (ts: number): number => (ts < 1e12 ? ts * 1000 : ts);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const stateMeta = {
  speaking: { label: "Speaking", tone: "critical" as const },
  "raised-hand": { label: "Raised Hand", tone: "active" as const },
  listening: { label: "Listening", tone: "warm" as const },
  muted: { label: "Muted", tone: "idle" as const },
};

export interface OrchestrationState {
  snapshotId: string | null;
  activityRun: GatewayActivityRunSnapshot | null;
  world: GatewayWorldSnapshot | null;
  timers: GatewayTimerSnapshot[];
  skills: GatewaySkillSnapshot[];
  submissions: GatewaySubmissionSnapshot[];
  scores: GatewayScoreSnapshot[];
  scoreSummary: GatewayScoreSummarySnapshot[];
  health: GatewayHealthSnapshot | null;
  awards: GatewayAwardSummary[];
  domainEvents: GatewayDomainEventSummary[];
  lastSequence: number | null;
}

export const EMPTY_ORCHESTRATION_STATE: OrchestrationState = {
  snapshotId: null,
  activityRun: null,
  world: null,
  timers: [],
  skills: [],
  submissions: [],
  scores: [],
  scoreSummary: [],
  health: null,
  awards: [],
  domainEvents: [],
  lastSequence: null,
};

export interface GatewayFeatureState {
  methods: string[];
  events: string[];
}

export const EMPTY_GATEWAY_FEATURES: GatewayFeatureState = {
  methods: [],
  events: [],
};

export const AUTHORITATIVE_QUERY_CHECK_ORDER = [
  "snapshot",
  "scores",
  "events",
  "replay",
  "audit",
] as const;

export type AuthoritativeQueryCheckKey =
  (typeof AUTHORITATIVE_QUERY_CHECK_ORDER)[number];

export type AuthoritativeQueryCheckState = {
  status: "idle" | "ok" | "error";
  error: string | null;
  lastSuccessfulAt: number | null;
};

export const buildEmptyAuthoritativeQueryChecks = (): Record<
  AuthoritativeQueryCheckKey,
  AuthoritativeQueryCheckState
> => ({
  snapshot: { status: "idle", error: null, lastSuccessfulAt: null },
  scores: { status: "idle", error: null, lastSuccessfulAt: null },
  events: { status: "idle", error: null, lastSuccessfulAt: null },
  replay: { status: "idle", error: null, lastSuccessfulAt: null },
  audit: { status: "idle", error: null, lastSuccessfulAt: null },
});

export const AUTHORITATIVE_QUERY_CHECK_LABELS: Record<
  AuthoritativeQueryCheckKey,
  string
> = {
  snapshot: "Snapshot",
  scores: "Scores",
  events: "Events",
  replay: "Replay",
  audit: "Audit",
};

export interface AuthoritativeQueryState {
  configured: boolean;
  baseUrl: string | null;
  source: GatewayAuthoritativeQueryStatus["source"];
  note: string | null;
  snapshot: OrchestratorSnapshotResponse | null;
  scores: OrchestratorScoresResponse | null;
  events: OrchestratorEventPage | null;
  replay: OrchestratorEventPage | null;
  audit: OrchestratorAuditResponse | null;
  loading: boolean;
  error: string | null;
  lastSuccessfulAt: number | null;
  checks: Record<AuthoritativeQueryCheckKey, AuthoritativeQueryCheckState>;
}

export const EMPTY_AUTHORITATIVE_QUERY_STATE: AuthoritativeQueryState = {
  configured: false,
  baseUrl: null,
  source: "unavailable",
  note: null,
  snapshot: null,
  scores: null,
  events: null,
  replay: null,
  audit: null,
  loading: false,
  error: null,
  lastSuccessfulAt: null,
  checks: buildEmptyAuthoritativeQueryChecks(),
};

export const deriveContestantState = (
  session: GatewaySessionEntry,
): "speaking" | "raised-hand" | "listening" | "muted" => {
  const idleMs = Date.now() - normalizeTimestamp(session.updatedAt);

  if (session.abortedLastRun) {
    return idleMs < 90_000 ? "raised-hand" : "muted";
  }

  if (idleMs < 45_000) return "speaking";
  if (idleMs < 90_000) return "raised-hand";
  if (idleMs < 300_000) return "listening";
  return "muted";
};

export const formatUpdatedLabel = (updatedAt: number): string => {
  const deltaMs = Date.now() - normalizeTimestamp(updatedAt);
  if (deltaMs < 60_000) {
    return `${Math.max(1, Math.round(deltaMs / 1000))}s ago`;
  }
  if (deltaMs < 3_600_000) {
    return `${Math.round(deltaMs / 60_000)}m ago`;
  }
  return `${Math.round(deltaMs / 3_600_000)}h ago`;
};

export const formatClockLabel = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
};

export const formatRemainingLabel = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const formatAverageScoreLabel = (score: number): string =>
  Number.isFinite(score) ? score.toFixed(1) : "0.0";

export const formatFreshnessLabel = (
  timestamp: number | null,
  emptyLabel: string,
): string => {
  if (!timestamp) {
    return emptyLabel;
  }

  const deltaMs = Date.now() - timestamp;
  const ageLabel = formatUpdatedLabel(timestamp);

  if (deltaMs < 15_000) {
    return `Fresh · ${ageLabel}`;
  }

  if (deltaMs < 60_000) {
    return `Aging · ${ageLabel}`;
  }

  return `Stale · ${ageLabel}`;
};

export const formatQueryFreshness = (lastSuccessfulAt: number | null): string =>
  formatFreshnessLabel(lastSuccessfulAt, "No query sync yet");

export const formatHealthFreshness = (timestamp: number | null): string =>
  formatFreshnessLabel(timestamp, "No snapshot.health yet");

export const formatGatewayWarning = (warning: string): string => {
  const trimmed = warning.trim();
  if (trimmed === "missing scope: operator.read") {
    return "Gateway denied direct `status` reads for this token-only websocket operator session (`missing scope: operator.read`). Director view is falling back to hello snapshot / health. For full status RPC access, use a paired device-aware operator client.";
  }

  return trimmed;
};

export const readString = (
  record: Record<string, unknown>,
  ...keys: string[]
): string | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

export const readNumber = (
  record: Record<string, unknown>,
  ...keys: string[]
): number | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
};

export const readBoolean = (
  record: Record<string, unknown>,
  ...keys: string[]
): boolean | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
};

export const readRole = (
  record: Record<string, unknown>,
  ...keys: string[]
): GatewaySubmissionSummary["latestActorRole"] => {
  const value = readString(record, ...keys);
  if (
    value === "agent" ||
    value === "host" ||
    value === "judge" ||
    value === "viewer" ||
    value === "admin"
  ) {
    return value;
  }
  return null;
};

export const buildEventProvenance = (event: GatewayEventEnvelope) => ({
  commandId: event.commandId ?? null,
  idempotencyKey: event.idempotencyKey ?? null,
  actorId: event.actorId ?? null,
  actorRole: event.actorRole ?? null,
});

export const extractSubmissionVersions = (
  value: unknown,
): GatewaySubmissionSnapshot["versions"] => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const versions: NonNullable<GatewaySubmissionSnapshot["versions"]> = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const version = readNumber(entry, "version");
    const updatedAt = readNumber(entry, "updatedAt");
    const data = isRecord(entry.data) ? entry.data : null;

    if (version === null || updatedAt === null || !data) {
      continue;
    }

    versions.push({
      version,
      updatedAt,
      actorId: readString(entry, "actorId") ?? undefined,
      actorRole: readRole(entry, "actorRole") ?? undefined,
      data,
    });
  }

  return versions.length > 0 ? versions : undefined;
};

export const readScoreAnnotations = (
  record: Record<string, unknown>,
  activityPackageId?: string | null,
): GatewayScoreSnapshot["annotations"] => {
  const nextAnnotations = extractActivityScoreAnnotations(
    record,
    activityPackageId,
  );

  return Object.keys(nextAnnotations).length > 0 ? nextAnnotations : undefined;
};

export const extractScoreUpdate = (
  event: GatewayEventEnvelope,
  activityPackageId?: string | null,
): GatewayScoreSnapshot | null => {
  const payload = isRecord(event.payload) ? event.payload : {};
  const judgeScore = isRecord(payload.judgeScore) ? payload.judgeScore : payload;
  const id = readString(judgeScore, "id");
  const targetTypeValue = readString(judgeScore, "targetType");
  const targetId =
    readString(judgeScore, "targetId", "submissionId") ??
    readString(payload, "targetId", "submissionId");
  const score = readNumber(judgeScore, "score");
  const submittedAt =
    readNumber(judgeScore, "submittedAt", "timestamp") ?? event.timestamp;

  if (
    !id ||
    !targetId ||
    score === null ||
    (targetTypeValue !== "team" && targetTypeValue !== "submission")
  ) {
    return null;
  }

  return {
    id,
    activityRunId:
      readString(judgeScore, "activityRunId") ??
      event.activityRunId ??
      undefined,
    stageId:
      readString(judgeScore, "stageId") ??
      stageIdFromPayload(payload) ??
      undefined,
    judgeId:
      readString(judgeScore, "judgeId") ??
      event.actorId ??
      undefined,
    judgeRole:
      readRole(judgeScore, "judgeRole") ??
      event.actorRole ??
      undefined,
    targetType: targetTypeValue,
    targetId,
    submissionId:
      readString(judgeScore, "submissionId") ??
      (targetTypeValue === "submission" ? targetId : undefined),
    teamId: readString(judgeScore, "teamId") ?? undefined,
    score,
    reason: readString(judgeScore, "reason") ?? "",
    annotations: readScoreAnnotations(judgeScore, activityPackageId),
    submittedAt,
  };
};

export const buildScoreSummarySnapshots = (
  scores: GatewayScoreSnapshot[],
): GatewayScoreSummarySnapshot[] => {
  const summaryByTarget = new Map<string, GatewayScoreSummarySnapshot>();

  for (const score of scores) {
    const key = `${score.targetType}:${score.targetId}`;
    const existing = summaryByTarget.get(key);
    if (!existing) {
      summaryByTarget.set(key, {
        targetType: score.targetType,
        targetId: score.targetId,
        teamId: score.teamId,
        submissionId: score.submissionId,
        judgeCount: 1,
        totalScore: score.score,
        averageScore: score.score,
        lastSubmittedAt: score.submittedAt,
      });
      continue;
    }

    const judgeCount = existing.judgeCount + 1;
    const totalScore = existing.totalScore + score.score;
    summaryByTarget.set(key, {
      ...existing,
      judgeCount,
      totalScore,
      averageScore: totalScore / judgeCount,
      lastSubmittedAt: Math.max(existing.lastSubmittedAt, score.submittedAt),
    });
  }

  return [...summaryByTarget.values()].sort(
    (left, right) => right.averageScore - left.averageScore,
  );
};

export const normalizeHelloFeatures = (
  hello: GatewayHelloPayload,
): GatewayFeatureState => ({
  methods: Array.isArray(hello.features?.methods)
    ? hello.features.methods.filter(
        (method): method is string => typeof method === "string" && method.trim().length > 0,
      )
    : [],
  events: Array.isArray(hello.features?.events)
    ? hello.features.events.filter(
        (event): event is string => typeof event === "string" && event.trim().length > 0,
      )
    : [],
});

export const stageIdFromPayload = (payload: Record<string, unknown>): string | null => {
  const directStageId = readString(payload, "stageId", "currentStageId", "toStageId", "targetStageId");
  if (directStageId) {
    return directStageId;
  }

  const timer = payload.timer;
  if (isRecord(timer)) {
    const timerStageId = readString(timer, "stageId");
    if (timerStageId) {
      return timerStageId;
    }
  }

  const submission = payload.submission;
  if (isRecord(submission)) {
    const submissionStageId = readString(submission, "stageId");
    if (submissionStageId) {
      return submissionStageId;
    }
  }

  return null;
};

export const resolveEventActivityPackageId = ({
  payload,
  previous,
}: {
  payload: Record<string, unknown>;
  previous: OrchestrationState;
}): string | null => {
  const activityRun = isRecord(payload.activityRun) ? payload.activityRun : null;
  const explicitTemplateId =
    readString(payload, "templateId") ??
    (activityRun ? readString(activityRun, "templateId") : null);

  if (explicitTemplateId) {
    return explicitTemplateId;
  }

  return (
    previous.activityRun?.templateId ?? null
  );
};

export const upsertById = <T extends { id: string }>(items: T[], nextItem: T): T[] => {
  const nextItems = items.filter((item) => item.id !== nextItem.id);
  return [nextItem, ...nextItems];
};

export const buildActivityRunFromSnapshot = (
  snapshot: GatewaySnapshotEnvelope,
  previous: GatewayActivityRunSnapshot | null,
): GatewayActivityRunSnapshot | null => {
  if (snapshot.activityRun) {
    return snapshot.activityRun;
  }

  return previous;
};

export const extractTimerUpdate = (
  event: GatewayEventEnvelope,
): GatewayTimerSnapshot | null => {
  const payload = isRecord(event.payload) ? event.payload : {};
  const timer = isRecord(payload.timer) ? payload.timer : payload;
  const id =
    readString(timer, "id", "timerId") ??
    readString(payload, "timerId") ??
    (event.type.startsWith("timer.") ? `${event.type}-${event.timestamp}` : null);
  const remainingMs =
    readNumber(timer, "remainingMs") ??
    readNumber(payload, "remainingMs") ??
    (event.type === "timer.ended" ? 0 : null);

  if (!id || remainingMs === null) {
    return null;
  }

  return {
    id,
    stageId: readString(timer, "stageId") ?? stageIdFromPayload(payload) ?? undefined,
    remainingMs,
    state:
      readString(timer, "state") ??
      readString(payload, "state") ??
      (event.type === "timer.started"
        ? "running"
        : event.type === "timer.paused"
          ? "paused"
          : event.type === "timer.ended"
            ? "ended"
            : "idle"),
  };
};

export const extractSubmissionUpdate = (
  event: GatewayEventEnvelope,
): GatewaySubmissionSnapshot | null => {
  const payload = isRecord(event.payload) ? event.payload : {};
  const submission = isRecord(payload.submission) ? payload.submission : payload;
  const id =
    readString(submission, "id", "submissionId") ??
    readString(payload, "submissionId");
  const schemaId =
    readString(submission, "schemaId") ??
    readString(payload, "schemaId") ??
    "unknown-schema";
  const locked =
    readBoolean(submission, "locked") ??
    readBoolean(payload, "locked") ??
    (event.type === "submission.locked");

  if (!id) {
    return null;
  }

  return {
    id,
    activityRunId:
      readString(submission, "activityRunId") ??
      event.activityRunId ??
      undefined,
    submitterId:
      readString(submission, "submitterId") ??
      readString(payload, "submitterId") ??
      undefined,
    schemaId,
    data: isRecord(submission.data) ? submission.data : undefined,
    version: readNumber(submission, "version") ?? undefined,
    versions: extractSubmissionVersions(submission.versions),
    locked,
    teamId: readString(submission, "teamId") ?? readString(payload, "teamId") ?? undefined,
    stageId: readString(submission, "stageId") ?? stageIdFromPayload(payload) ?? undefined,
    openedAt: readNumber(submission, "openedAt") ?? undefined,
    updatedAt:
      readNumber(submission, "updatedAt") ??
      readNumber(payload, "updatedAt") ??
      event.timestamp,
    lockedAt: readNumber(submission, "lockedAt") ?? undefined,
  };
};

export const extractAwardUpdate = (
  event: GatewayEventEnvelope,
): GatewayAwardSummary | null => {
  const payload = isRecord(event.payload) ? event.payload : {};
  const award = isRecord(payload.award) ? payload.award : payload;
  const label = readString(award, "label", "awardLabel");
  const entityId = readString(award, "entityId", "subjectId", "winnerId");

  if (!label || !entityId) {
    return null;
  }

  return {
    id:
      readString(award, "awardId", "id") ??
      `${label}-${entityId}-${event.timestamp}`,
    label,
    entityId,
    reason: readString(award, "reason", "summary"),
    grantedAt:
      readNumber(award, "grantedAt", "timestamp") ?? event.timestamp,
    grantedLabel: formatClockLabel(event.timestamp),
  };
};

export const summarizePayload = (payload: Record<string, unknown>): string => {
  const keys = [
    "reason",
    "summary",
    "message",
    "status",
    "schemaId",
    "teamId",
    "entityId",
  ];

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "平台已推送新的编排事件。";
};

export const readEventRoomId = (
  event: GatewayEventEnvelope,
  payload: Record<string, unknown>,
): string | null =>
  readString(payload, "toRoomId", "roomId") ??
  (typeof event.roomId === "string" && event.roomId.trim().length > 0
    ? event.roomId
    : null);

export const buildDomainEventSummary = (
  event: GatewayEventEnvelope,
): GatewayDomainEventSummary => {
  const payload = isRecord(event.payload) ? event.payload : {};
  const stageId = stageIdFromPayload(payload);
  const timestampLabel = formatClockLabel(event.timestamp);
  const provenance = buildEventProvenance(event);
  const baseRoomId = readEventRoomId(event, payload);

  if (event.type === "stage.changed") {
    const nextStageId = readString(payload, "toStageId", "currentStageId", "stageId");
    return {
      id: event.id,
      sequence: event.sequence ?? null,
      type: event.type,
      title: "Stage Changed",
      detail: nextStageId
        ? `平台已切到 ${nextStageId}。`
        : "平台已推送新的 stage 切换。",
      timestamp: event.timestamp,
      timestampLabel,
      stageId: nextStageId ?? stageId,
      roomId: null,
      teamId: null,
      submissionId: null,
      entityId: null,
      tone: "critical",
      provenance,
    };
  }

  if (event.type.startsWith("timer.")) {
    const timer = extractTimerUpdate(event);
    return {
      id: event.id,
      sequence: event.sequence ?? null,
      type: event.type,
      title:
        event.type === "timer.started"
          ? "Timer Started"
          : event.type === "timer.paused"
            ? "Timer Paused"
            : "Timer Ended",
      detail: timer
        ? `${timer.stageId ?? "current-stage"} 剩余 ${formatRemainingLabel(timer.remainingMs)}。`
        : "阶段计时状态发生变化。",
      timestamp: event.timestamp,
      timestampLabel,
      stageId: timer?.stageId ?? stageId,
      roomId: baseRoomId,
      teamId: null,
      submissionId: null,
      entityId: null,
      tone: event.type === "timer.ended" ? "active" : "warm",
      provenance,
    };
  }

  if (event.type.startsWith("submission.")) {
    const submission = extractSubmissionUpdate(event);
    return {
      id: event.id,
      sequence: event.sequence ?? null,
      type: event.type,
      title:
        event.type === "submission.locked"
          ? "Submission Locked"
          : event.type === "submission.updated"
            ? "Submission Updated"
            : "Submission Opened",
      detail: submission
        ? `${submission.id} / ${submission.schemaId}${submission.locked ? " 已锁定" : " 可继续更新"}.`
        : "提交窗口状态发生变化。",
      timestamp: event.timestamp,
      timestampLabel,
      stageId: submission?.stageId ?? stageId,
      roomId: baseRoomId,
      teamId: submission?.teamId ?? null,
      submissionId: submission?.id ?? null,
      entityId: null,
      tone: event.type === "submission.locked" ? "active" : "warm",
      provenance,
    };
  }

  if (event.type === "judge.score_submitted") {
    const judgeScore = isRecord(payload.judgeScore) ? payload.judgeScore : payload;
    const submissionId =
      readString(judgeScore, "submissionId", "targetId") ??
      readString(payload, "submissionId", "targetId");
    const judgeId = readString(judgeScore, "judgeId") ?? event.actorId;
    const score = readNumber(judgeScore, "score") ?? readNumber(payload, "score");
    return {
      id: event.id,
      sequence: event.sequence ?? null,
      type: event.type,
      title: "Judge Score Submitted",
      detail:
        score !== null
          ? `${judgeId ?? "judge"} 对 ${submissionId ?? "submission"} 提交了 ${score}/10。`
          : summarizePayload(payload),
      timestamp: event.timestamp,
      timestampLabel,
      stageId,
      roomId: baseRoomId,
      teamId: readString(judgeScore, "teamId") ?? readString(payload, "teamId"),
      submissionId,
      entityId: null,
      tone: "warm",
      provenance,
    };
  }

  if (event.type === "award.granted") {
    const award = extractAwardUpdate(event);
    return {
      id: event.id,
      sequence: event.sequence ?? null,
      type: event.type,
      title: award ? `Award Granted · ${award.label}` : "Award Granted",
      detail: award
        ? `${award.entityId} 获得 ${award.label}。`
        : "新的奖项结果已经落地。",
      timestamp: event.timestamp,
      timestampLabel,
      stageId,
      roomId: baseRoomId,
      teamId: null,
      submissionId: null,
      entityId: award?.entityId ?? null,
      tone: "critical",
      provenance,
    };
  }

  if (event.type === "draw.submitted") {
    const entityId = readString(payload, "entityId") ?? event.entityId ?? null;
    return {
      id: event.id,
      sequence: event.sequence ?? null,
      type: event.type,
      title: "Draw Submitted",
      detail: entityId
        ? `${entityId} 刚把新的共创笔触写进平台事件流。`
        : summarizePayload(payload),
      timestamp: event.timestamp,
      timestampLabel,
      stageId,
      roomId: baseRoomId,
      teamId: null,
      submissionId: null,
      entityId,
      tone: "warm",
      provenance,
    };
  }

  if (event.type === "entity.moved") {
    const entityId = readString(payload, "entityId") ?? event.entityId ?? null;
    const toRoomId = readString(payload, "toRoomId", "roomId");
    return {
      id: event.id,
      sequence: event.sequence ?? null,
      type: event.type,
      title: "Entity Moved",
      detail:
        entityId && toRoomId
          ? `${entityId} 已被 authoritative runtime 移动到 ${toRoomId}。`
          : summarizePayload(payload),
      timestamp: event.timestamp,
      timestampLabel,
      stageId,
      roomId: toRoomId ?? baseRoomId,
      teamId: null,
      submissionId: null,
      entityId,
      tone: "active",
      provenance,
    };
  }

  if (event.type === "team.assigned") {
    const rawTeam = isRecord(payload.team) ? payload.team : payload;
    const teamId = readString(rawTeam, "id", "teamId");
    const roomId = readString(rawTeam, "roomId") ?? baseRoomId;
    return {
      id: event.id,
      sequence: event.sequence ?? null,
      type: event.type,
      title: "Team Assigned",
      detail:
        teamId && roomId
          ? `${teamId} 的权威分组与房间映射刚落到 ${roomId}。`
          : summarizePayload(payload),
      timestamp: event.timestamp,
      timestampLabel,
      stageId,
      roomId,
      teamId,
      submissionId: null,
      entityId: null,
      tone: "active",
      provenance,
    };
  }

  if (event.type === "activity.started" || event.type === "activity.finished") {
    return {
      id: event.id,
      sequence: event.sequence ?? null,
      type: event.type,
      title:
        event.type === "activity.started" ? "Activity Started" : "Activity Finished",
      detail: summarizePayload(payload),
      timestamp: event.timestamp,
      timestampLabel,
      stageId,
      roomId: baseRoomId,
      teamId: null,
      submissionId: null,
      entityId: null,
      tone: "critical",
      provenance,
    };
  }

  return {
    id: event.id,
    sequence: event.sequence ?? null,
    type: event.type,
    title: event.type,
    detail: summarizePayload(payload),
    timestamp: event.timestamp,
    timestampLabel,
    stageId,
    roomId: baseRoomId,
    teamId: null,
    submissionId: null,
    entityId: event.entityId ?? null,
    tone: "idle",
    provenance,
  };
};

export const applySnapshot = (
  previous: OrchestrationState,
  snapshot: GatewaySnapshotEnvelope,
): OrchestrationState => {
  const awards =
    Array.isArray(snapshot.awards) && snapshot.awards.length > 0
      ? snapshot.awards
          .map((award) => {
            if (!award.label || !award.entityId) {
              return null;
            }
            const grantedAt = normalizeTimestamp(award.grantedAt ?? Date.now());
            return {
              id: award.awardId ?? `${award.label}-${award.entityId}-${grantedAt}`,
              label: award.label,
              entityId: award.entityId,
              reason: award.reason ?? null,
              grantedAt,
              grantedLabel: formatClockLabel(grantedAt),
            } satisfies GatewayAwardSummary;
          })
          .filter((award): award is GatewayAwardSummary => award !== null)
      : previous.awards;

  return {
    snapshotId:
      typeof snapshot.snapshotId === "string" ? snapshot.snapshotId : previous.snapshotId,
    activityRun: buildActivityRunFromSnapshot(snapshot, previous.activityRun),
    world: snapshot.world ?? previous.world,
    timers: Array.isArray(snapshot.timers) ? snapshot.timers : previous.timers,
    skills: Array.isArray(snapshot.skills) ? snapshot.skills : previous.skills,
    submissions: Array.isArray(snapshot.submissions)
      ? snapshot.submissions
      : previous.submissions,
    scores: Array.isArray(snapshot.scores) ? snapshot.scores : previous.scores,
    scoreSummary: Array.isArray(snapshot.scoreSummary)
      ? snapshot.scoreSummary
      : previous.scoreSummary,
    health: snapshot.health ?? previous.health,
    awards,
    domainEvents: previous.domainEvents,
    lastSequence:
      typeof snapshot.lastSequence === "number"
        ? snapshot.lastSequence
        : previous.lastSequence,
  };
};

export const applyOrchestrationEvent = (
  previous: OrchestrationState,
  event: GatewayEventEnvelope,
): OrchestrationState => {
  const payload = isRecord(event.payload) ? event.payload : {};
  const activityPackageId = resolveEventActivityPackageId({
    payload,
    previous,
  });
  const nextDomainEvent = buildDomainEventSummary(event);
  let nextState: OrchestrationState = {
    ...previous,
    domainEvents: [nextDomainEvent, ...previous.domainEvents]
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 12),
    lastSequence:
      typeof event.sequence === "number" ? event.sequence : previous.lastSequence,
  };

  if (event.type === "activity.started") {
    nextState = {
      ...nextState,
      activityRun: {
        id: readString(payload, "activityRunId", "id") ?? previous.activityRun?.id ?? "activity-run",
        templateId:
          activityPackageId,
        status: readString(payload, "status") ?? "running",
        currentStageId:
          readString(payload, "currentStageId", "stageId") ??
          previous.activityRun?.currentStageId ??
          null,
      },
    };
  }

  if (event.type === "stage.changed") {
    nextState = {
      ...nextState,
      activityRun: {
        id: previous.activityRun?.id ?? readString(payload, "activityRunId") ?? "activity-run",
        templateId:
          activityPackageId,
        status: previous.activityRun?.status ?? "running",
        currentStageId:
          readString(payload, "toStageId", "currentStageId", "stageId") ?? null,
      },
    };
  }

  if (event.type.startsWith("timer.")) {
    const timer = extractTimerUpdate(event);
    if (timer) {
      nextState = {
        ...nextState,
        timers: upsertById(nextState.timers, timer)
          .sort((left, right) => left.remainingMs - right.remainingMs)
          .slice(0, 8),
      };
    }
  }

  if (event.type.startsWith("submission.")) {
    const submission = extractSubmissionUpdate(event);
    if (submission) {
      nextState = {
        ...nextState,
        submissions: upsertById(nextState.submissions, submission).slice(0, 24),
      };
    }
  }

  if (event.type === "judge.score_submitted") {
    const score = extractScoreUpdate(event, activityPackageId);
    if (score) {
      const nextScores = upsertById(nextState.scores, score).sort(
        (left, right) => right.submittedAt - left.submittedAt,
      );
      nextState = {
        ...nextState,
        scores: nextScores.slice(0, 24),
        scoreSummary: buildScoreSummarySnapshots(nextScores),
      };
    }
  }

  if (event.type === "award.granted") {
    const award = extractAwardUpdate(event);
    if (award) {
      nextState = {
        ...nextState,
        awards: upsertById(nextState.awards, award).slice(0, 12),
      };
    }
  }

  return nextState;
};

export const summarizeSubmissionVersionActor = (
  submission: GatewaySubmissionSnapshot,
): { actorId: string | null; actorRole: GatewaySubmissionSummary["latestActorRole"] } => {
  const latestVersion = [...(submission.versions ?? [])].sort(
    (left, right) =>
      normalizeTimestamp(right.updatedAt) - normalizeTimestamp(left.updatedAt),
  )[0];

  return {
    actorId: latestVersion?.actorId ?? null,
    actorRole: latestVersion?.actorRole ?? null,
  };
};

export const buildSubmissionSummary = (
  submission: GatewaySubmissionSnapshot,
): GatewaySubmissionSummary => {
  const latestActor = summarizeSubmissionVersionActor(submission);

  return {
    id: submission.id,
    schemaId: submission.schemaId,
    locked: submission.locked,
    lockedLabel: submission.locked ? "Locked" : "Open",
    teamId: submission.teamId ?? null,
    stageId: submission.stageId ?? null,
    data: isRecord(submission.data) ? submission.data : null,
    version: typeof submission.version === "number" ? submission.version : null,
    versions: [...(submission.versions ?? [])]
      .map((version) => ({
        version: version.version,
        updatedAt: normalizeTimestamp(version.updatedAt),
        updatedLabel: formatUpdatedLabel(version.updatedAt),
        actorId: version.actorId ?? null,
        actorRole: version.actorRole ?? null,
        data: version.data,
      }))
      .sort((left, right) => right.version - left.version),
    openedAt:
      typeof submission.openedAt === "number"
        ? normalizeTimestamp(submission.openedAt)
        : null,
    updatedAt:
      typeof submission.updatedAt === "number"
        ? normalizeTimestamp(submission.updatedAt)
        : null,
    updatedLabel:
      typeof submission.updatedAt === "number"
        ? formatUpdatedLabel(submission.updatedAt)
        : null,
    lockedAt:
      typeof submission.lockedAt === "number"
        ? normalizeTimestamp(submission.lockedAt)
        : null,
    latestActorId: latestActor.actorId,
    latestActorRole: latestActor.actorRole,
  };
};

export const buildScoreEntrySummary = (
  score: GatewayScoreSnapshot,
): GatewayScoreEntrySummary => {
  const submittedAt = normalizeTimestamp(score.submittedAt);
  return {
    id: score.id,
    targetType: score.targetType,
    targetId: score.targetId,
    submissionId: score.submissionId ?? null,
    teamId: score.teamId ?? null,
    stageId: score.stageId ?? null,
    judgeId: score.judgeId ?? null,
    judgeRole: score.judgeRole ?? null,
    score: score.score,
    reason: score.reason,
    annotations: score.annotations ?? {},
    submittedAt,
    submittedLabel: formatClockLabel(submittedAt),
  };
};

export const buildScoreSummaryEntry = (
  summary: GatewayScoreSummarySnapshot,
): GatewayScoreSummaryEntry => {
  const lastSubmittedAt = normalizeTimestamp(summary.lastSubmittedAt);
  return {
    targetType: summary.targetType,
    targetId: summary.targetId,
    teamId: summary.teamId ?? null,
    submissionId: summary.submissionId ?? null,
    judgeCount: summary.judgeCount,
    totalScore: summary.totalScore,
    averageScore: summary.averageScore,
    averageLabel: formatAverageScoreLabel(summary.averageScore),
    lastSubmittedAt,
    lastSubmittedLabel: formatClockLabel(lastSubmittedAt),
  };
};

export const buildAuditRecordSummary = (
  record: OrchestratorAuditResponse["records"][number],
): GatewayAuditRecordSummary => {
  const handledAt = normalizeTimestamp(record.handledAt);
  const issuedAt = normalizeTimestamp(record.issuedAt);
  const statusLabel =
    record.status === "accepted"
      ? "Accepted"
      : record.status === "replayed"
        ? "Replayed"
        : record.status === "conflict"
          ? "Conflict"
          : "Rejected";
  const tone =
    record.status === "accepted"
      ? "warm"
      : record.status === "replayed"
        ? "active"
        : "critical";
  const emittedSequenceLabel =
    record.emittedSequences.length > 0
      ? `seq ${record.emittedSequences.join(", ")}`
      : "no emitted seq";
  const detail =
    record.status === "accepted"
      ? `${record.commandType} committed with ${emittedSequenceLabel}.`
      : record.status === "replayed"
        ? record.replayedFromIdempotency
          ? `${record.commandType} replayed from ${record.replayedFromIdempotency}.`
          : `${record.commandType} replayed a prior receipt.`
        : record.error?.message
          ? `${record.commandType} failed: ${record.error.message}`
          : `${record.commandType} was rejected by the authoritative backend.`;

  return {
    id: record.auditId,
    commandId: record.commandId,
    sourceCommandId: record.sourceCommandId,
    commandType: record.commandType,
    status: record.status,
    accepted: record.accepted,
    replayed: record.replayed,
    replayedFromIdempotency: record.replayedFromIdempotency ?? null,
    actorId: record.actorId,
    actorRole: record.actorRole,
    idempotencyKey: record.idempotencyKey ?? null,
    handledAt,
    handledLabel: formatClockLabel(handledAt),
    issuedAt,
    issuedLabel: formatClockLabel(issuedAt),
    emittedSequences: record.emittedSequences,
    emittedSequenceLabel,
    errorCode: record.error?.code ?? null,
    errorMessage: record.error?.message ?? null,
    statusLabel,
    title: `${statusLabel} · ${record.commandType}`,
    detail,
    tone,
  };
};

export const buildQueryCheckSummary = ({
  key,
  check,
}: {
  key: AuthoritativeQueryCheckKey;
  check: AuthoritativeQueryCheckState;
}): GatewayAuthoritativeQueryStatus["checks"][number] => {
  if (check.status === "ok") {
    return {
      key,
      label: AUTHORITATIVE_QUERY_CHECK_LABELS[key],
      status: "ok",
      detail: check.lastSuccessfulAt
        ? `Readable · ${formatUpdatedLabel(check.lastSuccessfulAt)}`
        : "Readable",
      tone: "warm",
      lastSuccessfulAt: check.lastSuccessfulAt,
      lastSuccessfulLabel: check.lastSuccessfulAt
        ? formatUpdatedLabel(check.lastSuccessfulAt)
        : null,
    };
  }

  if (check.status === "error") {
    const cachedDetail = check.lastSuccessfulAt
      ? `Last ok ${formatUpdatedLabel(check.lastSuccessfulAt)}`
      : "No successful read yet";
    return {
      key,
      label: AUTHORITATIVE_QUERY_CHECK_LABELS[key],
      status: "error",
      detail: check.error ? `${cachedDetail} · ${check.error}` : cachedDetail,
      tone: check.lastSuccessfulAt ? "active" : "critical",
      lastSuccessfulAt: check.lastSuccessfulAt,
      lastSuccessfulLabel: check.lastSuccessfulAt
        ? formatUpdatedLabel(check.lastSuccessfulAt)
        : null,
    };
  }

  return {
    key,
    label: AUTHORITATIVE_QUERY_CHECK_LABELS[key],
    status: "idle",
    detail: "Waiting for first sync",
    tone: "idle",
    lastSuccessfulAt: null,
    lastSuccessfulLabel: null,
  };
};

export const buildAuditSummary = ({
  records,
  auditCheck,
}: {
  records: GatewayAuditRecordSummary[];
  auditCheck: AuthoritativeQueryCheckState;
}): GatewayAuditSummary => {
  const acceptedCount = records.filter((record) => record.status === "accepted").length;
  const replayedCount = records.filter((record) => record.status === "replayed").length;
  const rejectedCount = records.filter((record) => record.status === "rejected").length;
  const conflictCount = records.filter((record) => record.status === "conflict").length;
  const latestRecord = records[0] ?? null;

  if (auditCheck.status === "error" && records.length === 0) {
    return {
      status: "error",
      label: "Audit query failed",
      detail: auditCheck.error ?? "Authoritative audit is currently unreadable.",
      tone: "critical",
      error: auditCheck.error,
      recordCount: 0,
      acceptedCount: 0,
      replayedCount: 0,
      rejectedCount: 0,
      conflictCount: 0,
      latestHandledAt: null,
      latestHandledLabel: null,
      latestRecord: null,
    };
  }

  if (records.length === 0) {
    return {
      status: "missing",
      label: "No receipt evidence yet",
      detail:
        auditCheck.status === "ok"
          ? "Audit endpoint is readable, but no recent operator receipts have been recorded yet."
          : "Audit evidence will appear here after the first authoritative command is handled.",
      tone: "idle",
      error: auditCheck.error,
      recordCount: 0,
      acceptedCount: 0,
      replayedCount: 0,
      rejectedCount: 0,
      conflictCount: 0,
      latestHandledAt: null,
      latestHandledLabel: null,
      latestRecord: null,
    };
  }

  if (rejectedCount > 0 || conflictCount > 0) {
    return {
      status: "warning",
      label: `${rejectedCount + conflictCount} rejected/conflict receipts`,
      detail: latestRecord
        ? `${latestRecord.statusLabel} ${latestRecord.commandType} at ${latestRecord.handledLabel}.`
        : "Recent audit contains rejected or conflict receipts.",
      tone: "active",
      error: auditCheck.error,
      recordCount: records.length,
      acceptedCount,
      replayedCount,
      rejectedCount,
      conflictCount,
      latestHandledAt: latestRecord?.handledAt ?? null,
      latestHandledLabel: latestRecord?.handledLabel ?? null,
      latestRecord,
    };
  }

  if (auditCheck.status === "error") {
    return {
      status: "warning",
      label: "Audit cache is stale",
      detail: auditCheck.error ?? "Audit is temporarily unreadable; showing the last successful receipts.",
      tone: "active",
      error: auditCheck.error,
      recordCount: records.length,
      acceptedCount,
      replayedCount,
      rejectedCount,
      conflictCount,
      latestHandledAt: latestRecord?.handledAt ?? null,
      latestHandledLabel: latestRecord?.handledLabel ?? null,
      latestRecord,
    };
  }

  return {
    status: "healthy",
    label: "Audit receipts readable",
    detail: latestRecord
      ? `${acceptedCount} accepted / ${replayedCount} replayed · latest ${latestRecord.commandType} at ${latestRecord.handledLabel}.`
      : "Recent authoritative receipts are readable.",
    tone: "warm",
    error: null,
    recordCount: records.length,
    acceptedCount,
    replayedCount,
    rejectedCount,
    conflictCount,
    latestHandledAt: latestRecord?.handledAt ?? null,
    latestHandledLabel: latestRecord?.handledLabel ?? null,
    latestRecord,
  };
};

export const buildBackendHealthSummary = ({
  health,
  hasAuthoritativeHealth,
  orchestratorQuery,
  auditSummary,
}: {
  health: GatewayHealthSnapshot | null;
  hasAuthoritativeHealth: boolean;
  orchestratorQuery: GatewayAuthoritativeQueryStatus;
  auditSummary: GatewayAuditSummary;
}): GatewayBackendHealthSummary => {
  const snapshotGeneratedAt =
    typeof health?.ts === "number" ? normalizeTimestamp(health.ts) : null;
  const healthAgents = Array.isArray(health?.agents)
    ? health.agents.filter(
        (agent): agent is NonNullable<GatewayHealthSnapshot["agents"]>[number] =>
          isRecord(agent),
      )
    : [];
  const agentCount = healthAgents.filter(
    (agent) => typeof agent.agentId === "string" && agent.agentId.trim().length > 0,
  ).length;
  const recentAgentIds = healthAgents
    .map((agent) => (typeof agent.agentId === "string" ? agent.agentId.trim() : ""))
    .filter((agentId) => agentId.length > 0)
    .slice(0, 4);
  const recentSessionCount = healthAgents.reduce(
    (total, agent) =>
      total +
      (Array.isArray(agent.sessions?.recent) ? agent.sessions.recent.length : 0),
    0,
  );

  const queryEvidence = {
    id: "authoritative-query",
    title: "Authoritative query",
    detail:
      orchestratorQuery.reason ??
      `${orchestratorQuery.statusLabel} · ${orchestratorQuery.freshnessLabel}.`,
    status:
      orchestratorQuery.status === "available"
        ? "ok"
        : orchestratorQuery.status === "degraded"
          ? "warning"
          : orchestratorQuery.status === "disabled"
            ? "missing"
            : "error",
    tone: orchestratorQuery.tone,
    timestamp: orchestratorQuery.lastSuccessfulAt,
    timestampLabel: orchestratorQuery.lastSuccessfulLabel,
  } as const;

  const snapshotEvidence = snapshotGeneratedAt
    ? {
        id: "snapshot-health",
        title: "snapshot.health",
        detail: `${agentCount} agents / ${recentSessionCount} recent sessions via ${hasAuthoritativeHealth ? "authoritative query snapshot" : "gateway snapshot"}.`,
        status:
          Date.now() - snapshotGeneratedAt > 60_000 ? ("warning" as const) : ("ok" as const),
        tone:
          Date.now() - snapshotGeneratedAt > 60_000
            ? ("active" as const)
            : ("warm" as const),
        timestamp: snapshotGeneratedAt,
        timestampLabel: formatClockLabel(snapshotGeneratedAt),
      }
    : {
        id: "snapshot-health",
        title: "snapshot.health",
        detail:
          orchestratorQuery.available || orchestratorQuery.status === "degraded"
            ? "Snapshot is readable, but no health payload is exposed yet."
            : "No snapshot.health evidence is available yet.",
        status:
          orchestratorQuery.available || orchestratorQuery.status === "degraded"
            ? ("warning" as const)
            : ("missing" as const),
        tone:
          orchestratorQuery.available || orchestratorQuery.status === "degraded"
            ? ("active" as const)
            : ("idle" as const),
        timestamp: null,
        timestampLabel: null,
      };

  const auditEvidence = {
    id: "audit-trail",
    title: "Audit trail",
    detail: auditSummary.detail,
    status:
      auditSummary.status === "healthy"
        ? "ok"
        : auditSummary.status === "missing"
          ? "missing"
          : auditSummary.status === "error"
            ? "error"
            : "warning",
    tone: auditSummary.tone,
    timestamp: auditSummary.latestHandledAt,
    timestampLabel: auditSummary.latestHandledLabel,
  } as const;

  const evidence = [queryEvidence, snapshotEvidence, auditEvidence];
  const hasError = evidence.some((item) => item.status === "error");
  const hasWarning = evidence.some((item) => item.status === "warning");
  const hasSignal = evidence.some((item) => item.status === "ok");

  if (hasError) {
    return {
      status: "error",
      label: "Backend evidence is degraded",
      detail:
        orchestratorQuery.reason ??
        "At least one backend evidence surface is currently failing.",
      tone: "critical",
      source: hasAuthoritativeHealth
        ? "authoritative-query-snapshot"
        : health
          ? "gateway-snapshot"
          : "unavailable",
      snapshotGeneratedAt,
      snapshotGeneratedLabel: snapshotGeneratedAt
        ? formatClockLabel(snapshotGeneratedAt)
        : null,
      freshnessLabel: formatHealthFreshness(snapshotGeneratedAt),
      agentCount,
      recentAgentIds,
      evidence,
    };
  }

  if (hasWarning) {
    return {
      status: "warning",
      label: "Backend evidence has warnings",
      detail:
        snapshotEvidence.status === "warning"
          ? snapshotEvidence.detail
          : auditSummary.detail,
      tone: "active",
      source: hasAuthoritativeHealth
        ? "authoritative-query-snapshot"
        : health
          ? "gateway-snapshot"
          : "unavailable",
      snapshotGeneratedAt,
      snapshotGeneratedLabel: snapshotGeneratedAt
        ? formatClockLabel(snapshotGeneratedAt)
        : null,
      freshnessLabel: formatHealthFreshness(snapshotGeneratedAt),
      agentCount,
      recentAgentIds,
      evidence,
    };
  }

  if (hasSignal) {
    return {
      status: "healthy",
      label: "Backend evidence is readable",
      detail:
        snapshotGeneratedAt && recentAgentIds.length > 0
          ? `${formatHealthFreshness(snapshotGeneratedAt)} · ${recentAgentIds.join(", ")} visible in snapshot.health.`
          : "Authoritative backend evidence is flowing.",
      tone: "warm",
      source: hasAuthoritativeHealth
        ? "authoritative-query-snapshot"
        : health
          ? "gateway-snapshot"
          : "unavailable",
      snapshotGeneratedAt,
      snapshotGeneratedLabel: snapshotGeneratedAt
        ? formatClockLabel(snapshotGeneratedAt)
        : null,
      freshnessLabel: formatHealthFreshness(snapshotGeneratedAt),
      agentCount,
      recentAgentIds,
      evidence,
    };
  }

  return {
    status: "missing",
    label: "Backend evidence is not available yet",
    detail: "No authoritative query, audit, or snapshot.health evidence has been observed yet.",
    tone: "idle",
    source: "unavailable",
    snapshotGeneratedAt: null,
    snapshotGeneratedLabel: null,
    freshnessLabel: formatHealthFreshness(null),
    agentCount: 0,
    recentAgentIds: [],
    evidence,
  };
};

export const resolveCurrentSubmission = (
  submissions: GatewaySubmissionSummary[],
  currentStageId: string | null,
): GatewaySubmissionSummary | null =>
  [...submissions]
    .sort((left, right) => {
      const rightStageMatch = Number(
        Boolean(currentStageId && right.stageId === currentStageId),
      );
      const leftStageMatch = Number(
        Boolean(currentStageId && left.stageId === currentStageId),
      );

      if (rightStageMatch !== leftStageMatch) {
        return rightStageMatch - leftStageMatch;
      }

      return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
    })[0] ?? null;

