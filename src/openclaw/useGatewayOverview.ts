import { useEffect, useMemo, useState } from "react";
import type {
  GatewayActivity,
  GatewayActivityRunSummary,
  GatewayAwardSummary,
  GatewayContestantSummary,
  GatewayDomainEventSummary,
  GatewayOverview,
  GatewayStateCount,
  GatewaySubmissionSummary,
  GatewayTimerSummary,
  GatewaySessionSummary,
} from "../types";
import {
  DEFAULT_GATEWAY_ROOM_IDS,
  getRoomLabel,
  normalizeControlDispatchMethod,
  resolveSessionRoomId,
  summarizeGatewayOrchestrationContract,
} from "./control";
import { OpenClawGatewayClient } from "./gateway/OpenClawGatewayClient";
import type {
  ConnectionState,
  GatewayActivityRunSnapshot,
  GatewayConfig,
  GatewayEventEnvelope,
  GatewayHelloPayload,
  GatewayMessage,
  GatewaySessionEntry,
  GatewaySnapshotEnvelope,
  GatewaySubmissionSnapshot,
  GatewayTimerSnapshot,
} from "./gateway/types";

const AUTH_FAIL_MESSAGE =
  "Gateway authentication failed. Check VITE_OPENCLAW_TOKEN.";

const normalizeTimestamp = (ts: number): number => (ts < 1e12 ? ts * 1000 : ts);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stateMeta = {
  speaking: { label: "Speaking", tone: "critical" as const },
  "raised-hand": { label: "Raised Hand", tone: "active" as const },
  listening: { label: "Listening", tone: "warm" as const },
  muted: { label: "Muted", tone: "idle" as const },
};

interface OrchestrationState {
  snapshotId: string | null;
  activityRun: GatewayActivityRunSnapshot | null;
  timers: GatewayTimerSnapshot[];
  submissions: GatewaySubmissionSnapshot[];
  awards: GatewayAwardSummary[];
  domainEvents: GatewayDomainEventSummary[];
  lastSequence: number | null;
}

const EMPTY_ORCHESTRATION_STATE: OrchestrationState = {
  snapshotId: null,
  activityRun: null,
  timers: [],
  submissions: [],
  awards: [],
  domainEvents: [],
  lastSequence: null,
};

interface GatewayFeatureState {
  methods: string[];
  events: string[];
}

const EMPTY_GATEWAY_FEATURES: GatewayFeatureState = {
  methods: [],
  events: [],
};

const deriveContestantState = (
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

const formatUpdatedLabel = (updatedAt: number): string => {
  const deltaMs = Date.now() - normalizeTimestamp(updatedAt);
  if (deltaMs < 60_000) {
    return `${Math.max(1, Math.round(deltaMs / 1000))}s ago`;
  }
  if (deltaMs < 3_600_000) {
    return `${Math.round(deltaMs / 60_000)}m ago`;
  }
  return `${Math.round(deltaMs / 3_600_000)}h ago`;
};

const formatClockLabel = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
};

const formatRemainingLabel = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const formatGatewayWarning = (warning: string): string => {
  const trimmed = warning.trim();
  if (trimmed === "missing scope: operator.read") {
    return "Gateway denied direct `status` reads for this token-only websocket operator session (`missing scope: operator.read`). Director view is falling back to hello snapshot / health. For full status RPC access, use a paired device-aware operator client.";
  }

  return trimmed;
};

const readString = (
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

const readNumber = (
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

const readBoolean = (
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

const normalizeHelloFeatures = (
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

const stageIdFromPayload = (payload: Record<string, unknown>): string | null => {
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

const upsertById = <T extends { id: string }>(items: T[], nextItem: T): T[] => {
  const nextItems = items.filter((item) => item.id !== nextItem.id);
  return [nextItem, ...nextItems];
};

const buildActivityRunFromSnapshot = (
  snapshot: GatewaySnapshotEnvelope,
  previous: GatewayActivityRunSnapshot | null,
): GatewayActivityRunSnapshot | null => {
  if (snapshot.activityRun) {
    return snapshot.activityRun;
  }

  return previous;
};

const extractTimerUpdate = (
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

const extractSubmissionUpdate = (
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
    schemaId,
    locked,
    teamId: readString(submission, "teamId") ?? readString(payload, "teamId") ?? undefined,
    stageId: readString(submission, "stageId") ?? stageIdFromPayload(payload) ?? undefined,
    updatedAt:
      readNumber(submission, "updatedAt") ??
      readNumber(payload, "updatedAt") ??
      event.timestamp,
  };
};

const extractAwardUpdate = (
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

const summarizePayload = (payload: Record<string, unknown>): string => {
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

const buildDomainEventSummary = (
  event: GatewayEventEnvelope,
): GatewayDomainEventSummary => {
  const payload = isRecord(event.payload) ? event.payload : {};
  const stageId = stageIdFromPayload(payload);
  const timestampLabel = formatClockLabel(event.timestamp);

  if (event.type === "stage.changed") {
    const nextStageId = readString(payload, "toStageId", "currentStageId", "stageId");
    return {
      id: event.id,
      type: event.type,
      title: "Stage Changed",
      detail: nextStageId
        ? `平台已切到 ${nextStageId}。`
        : "平台已推送新的 stage 切换。",
      timestamp: event.timestamp,
      timestampLabel,
      stageId: nextStageId ?? stageId,
      tone: "critical",
    };
  }

  if (event.type.startsWith("timer.")) {
    const timer = extractTimerUpdate(event);
    return {
      id: event.id,
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
      tone: event.type === "timer.ended" ? "active" : "warm",
    };
  }

  if (event.type.startsWith("submission.")) {
    const submission = extractSubmissionUpdate(event);
    return {
      id: event.id,
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
      tone: event.type === "submission.locked" ? "active" : "warm",
    };
  }

  if (event.type === "judge.score_submitted") {
    return {
      id: event.id,
      type: event.type,
      title: "Judge Score Submitted",
      detail: summarizePayload(payload),
      timestamp: event.timestamp,
      timestampLabel,
      stageId,
      tone: "warm",
    };
  }

  if (event.type === "award.granted") {
    const award = extractAwardUpdate(event);
    return {
      id: event.id,
      type: event.type,
      title: award ? `Award Granted · ${award.label}` : "Award Granted",
      detail: award
        ? `${award.entityId} 获得 ${award.label}。`
        : "新的奖项结果已经落地。",
      timestamp: event.timestamp,
      timestampLabel,
      stageId,
      tone: "critical",
    };
  }

  if (event.type === "activity.started" || event.type === "activity.finished") {
    return {
      id: event.id,
      type: event.type,
      title:
        event.type === "activity.started" ? "Activity Started" : "Activity Finished",
      detail: summarizePayload(payload),
      timestamp: event.timestamp,
      timestampLabel,
      stageId,
      tone: "critical",
    };
  }

  return {
    id: event.id,
    type: event.type,
    title: event.type,
    detail: summarizePayload(payload),
    timestamp: event.timestamp,
    timestampLabel,
    stageId,
    tone: "idle",
  };
};

const applySnapshot = (
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
    timers: Array.isArray(snapshot.timers) ? snapshot.timers : previous.timers,
    submissions: Array.isArray(snapshot.submissions)
      ? snapshot.submissions
      : previous.submissions,
    awards,
    domainEvents: previous.domainEvents,
    lastSequence:
      typeof snapshot.lastSequence === "number"
        ? snapshot.lastSequence
        : previous.lastSequence,
  };
};

const applyOrchestrationEvent = (
  previous: OrchestrationState,
  event: GatewayEventEnvelope,
): OrchestrationState => {
  const payload = isRecord(event.payload) ? event.payload : {};
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
          readString(payload, "templateId") ?? previous.activityRun?.templateId ?? "the-fool-v1",
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
        templateId: previous.activityRun?.templateId ?? "the-fool-v1",
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

export function useGatewayOverview(): GatewayOverview {
  const gatewayUrl = import.meta.env.VITE_OPENCLAW_URL?.trim() || "";
  const gatewayToken = import.meta.env.VITE_OPENCLAW_TOKEN?.trim() || "";
  const configured = Boolean(gatewayUrl && gatewayToken);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [authFailed, setAuthFailed] = useState(false);
  const [gatewayWarning, setGatewayWarning] = useState<string | null>(null);
  const [gatewayFeatures, setGatewayFeatures] = useState<GatewayFeatureState>(
    EMPTY_GATEWAY_FEATURES,
  );
  const [sessions, setSessions] = useState<GatewaySessionEntry[]>([]);
  const [messages, setMessages] = useState<GatewayMessage[]>([]);
  const [orchestration, setOrchestration] = useState<OrchestrationState>(
    EMPTY_ORCHESTRATION_STATE,
  );

  useEffect(() => {
    if (!configured) {
      return;
    }

    const config: GatewayConfig = {
      id: "molt-claw",
      url: gatewayUrl,
      token: gatewayToken,
    };

    const client = new OpenClawGatewayClient(config);
    const unsubscribers = [
      client.on("connection-change", (state) => {
        setConnectionState(state);
        if (state === "connecting" || state === "authenticating") {
          setGatewayWarning(null);
        }
        if (state === "connected") {
          setAuthFailed(false);
        }
      }),
      client.on("auth-error", () => {
        setAuthFailed(true);
      }),
      client.on("hello", (hello) => {
        setGatewayWarning(null);
        setGatewayFeatures(normalizeHelloFeatures(hello));
      }),
      client.on("warning", (warning) => {
        setGatewayWarning(formatGatewayWarning(warning));
      }),
      client.on("status", (entries) => {
        setSessions(entries);
      }),
      client.on("message", (message) => {
        setMessages((previous) => [message, ...previous].slice(0, 24));
      }),
      client.on("snapshot", (snapshot) => {
        setOrchestration((previous) => applySnapshot(previous, snapshot));
      }),
      client.on("orchestration-event", (event) => {
        setOrchestration((previous) => applyOrchestrationEvent(previous, event));
      }),
    ];

    client.connect();

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      client.destroy();
    };
  }, [configured, gatewayToken, gatewayUrl]);

  return useMemo(() => {
    const emptyStateCounts: GatewayStateCount[] = [
      { state: "speaking", label: "Speaking", count: 0, tone: "critical" },
      { state: "raised-hand", label: "Raised Hand", count: 0, tone: "active" },
      { state: "listening", label: "Listening", count: 0, tone: "warm" },
      { state: "muted", label: "Muted", count: 0, tone: "idle" },
    ];

    if (!configured) {
      return {
        configured: false,
        gatewayUrl: null,
        connectionState: "idle",
        authFailed: false,
        statusMessage: "OpenClaw not configured in this environment.",
        gatewayWarning: null,
        orchestrationContractStatus: "unknown",
        orchestrationContractNote: null,
        activityRun: null,
        authorityStageId: null,
        lastSequence: null,
        timers: [],
        activeTimer: null,
        submissions: [],
        lockedSubmissionCount: 0,
        totalSubmissionCount: 0,
        awards: [],
        domainEvents: [],
        totalActiveSessions: 0,
        stateCounts: emptyStateCounts,
        roomCounts: DEFAULT_GATEWAY_ROOM_IDS.map((roomId) => ({
          roomId,
          label: getRoomLabel(roomId),
          count: 0,
        })),
        roomRosters: DEFAULT_GATEWAY_ROOM_IDS.map((roomId) => ({
          roomId,
          label: getRoomLabel(roomId),
          sessions: [],
        })),
        sessions: [],
        contestants: [],
        activities: [],
      };
    }

    const roomCounts = DEFAULT_GATEWAY_ROOM_IDS.map((roomId) => ({
      roomId,
      label: getRoomLabel(roomId),
      count: sessions.filter((session) => resolveSessionRoomId(session.key) === roomId)
        .length,
    }));

    const allSessionSummaries: GatewaySessionSummary[] = [...sessions]
      .sort((left, right) => normalizeTimestamp(right.updatedAt) - normalizeTimestamp(left.updatedAt))
      .map((session) => {
        const roomId = resolveSessionRoomId(session.key);
        const state = deriveContestantState(session);
        return {
          agentId: session.agentId,
          sessionKey: session.key,
          roomId,
          roomLabel: getRoomLabel(roomId),
          updatedAt: normalizeTimestamp(session.updatedAt),
          updatedLabel: formatUpdatedLabel(session.updatedAt),
          state,
          stateLabel: stateMeta[state].label,
          stateTone: stateMeta[state].tone,
        };
      });

    const visibleSessions = allSessionSummaries.slice(0, 8);
    const roomByAgent = new Map(
      allSessionSummaries.map((session) => [
        session.agentId,
        {
          roomId: session.roomId,
          roomLabel: session.roomLabel,
        },
      ]),
    );

    const stateCounts: GatewayStateCount[] = [
      {
        state: "speaking",
        label: "Speaking",
        count: allSessionSummaries.filter((session) => session.state === "speaking").length,
        tone: "critical",
      },
      {
        state: "raised-hand",
        label: "Raised Hand",
        count: allSessionSummaries.filter((session) => session.state === "raised-hand").length,
        tone: "active",
      },
      {
        state: "listening",
        label: "Listening",
        count: allSessionSummaries.filter((session) => session.state === "listening").length,
        tone: "warm",
      },
      {
        state: "muted",
        label: "Muted",
        count: allSessionSummaries.filter((session) => session.state === "muted").length,
        tone: "idle",
      },
    ];

    const roomRosters = DEFAULT_GATEWAY_ROOM_IDS.map((roomId) => ({
      roomId,
      label: getRoomLabel(roomId),
      sessions: allSessionSummaries.filter((session) => session.roomId === roomId),
    }));

    const allActivities: GatewayActivity[] = messages.map((message) => {
      const relatedRoom = roomByAgent.get(message.senderId);
      const roomId = relatedRoom?.roomId ?? "quiet-orbit";
      const timestamp = normalizeTimestamp(message.ts);

      return {
        id: message.id,
        agentId: message.senderId,
        roomId,
        roomLabel: relatedRoom?.roomLabel ?? getRoomLabel(roomId),
        content: message.content,
        timestamp,
        timestampLabel: formatClockLabel(timestamp),
      };
    });

    const contestants: GatewayContestantSummary[] = allSessionSummaries
      .map((session) => {
        const recentActivities = allActivities
          .filter((activity) => activity.agentId === session.agentId)
          .slice(0, 3);

        return {
          ...session,
          activityCount: allActivities.filter((activity) => activity.agentId === session.agentId)
            .length,
          recentActivity: recentActivities[0] ?? null,
          recentActivities,
        };
      })
      .sort((left, right) => {
        const rightSignal = Math.max(
          right.updatedAt,
          right.recentActivity?.timestamp ?? 0,
        );
        const leftSignal = Math.max(left.updatedAt, left.recentActivity?.timestamp ?? 0);
        return rightSignal - leftSignal;
      });

    const timers: GatewayTimerSummary[] = orchestration.timers
      .map((timer) => ({
        id: timer.id,
        stageId: timer.stageId ?? null,
        remainingMs: timer.remainingMs,
        remainingLabel: formatRemainingLabel(timer.remainingMs),
        state: timer.state,
        stateLabel:
          timer.state === "running"
            ? "Running"
            : timer.state === "paused"
              ? "Paused"
              : timer.state === "ended"
                ? "Ended"
                : timer.state,
        isRunning: timer.state === "running",
      }))
      .sort((left, right) => left.remainingMs - right.remainingMs);

    const activeTimer =
      timers.find((timer) =>
        timer.stageId &&
        timer.stageId === orchestration.activityRun?.currentStageId &&
        timer.state !== "ended",
      ) ??
      timers.find((timer) => timer.isRunning) ??
      timers[0] ??
      null;

    const submissions: GatewaySubmissionSummary[] = orchestration.submissions
      .map((submission) => ({
        id: submission.id,
        schemaId: submission.schemaId,
        locked: submission.locked,
        lockedLabel: submission.locked ? "Locked" : "Open",
        teamId: submission.teamId ?? null,
        stageId: submission.stageId ?? null,
        updatedAt:
          typeof submission.updatedAt === "number"
            ? normalizeTimestamp(submission.updatedAt)
            : null,
        updatedLabel:
          typeof submission.updatedAt === "number"
            ? formatUpdatedLabel(submission.updatedAt)
            : null,
      }))
      .sort((left, right) => Number(right.locked) - Number(left.locked));

    const activityRun: GatewayActivityRunSummary | null = orchestration.activityRun
      ? {
          id: orchestration.activityRun.id,
          templateId: orchestration.activityRun.templateId,
          status: orchestration.activityRun.status,
          currentStageId: orchestration.activityRun.currentStageId,
          snapshotId: orchestration.snapshotId,
        }
      : null;

    const activities = allActivities.slice(0, 12);
    const lockedSubmissionCount = submissions.filter((submission) => submission.locked).length;
    const totalSubmissionCount = submissions.length;
    const configuredDispatchMethod = normalizeControlDispatchMethod(
      import.meta.env.VITE_OPENCLAW_COMMAND_METHOD,
    );
    const orchestrationContract = summarizeGatewayOrchestrationContract({
      capabilities: gatewayFeatures,
      configuredDispatchMethod,
    });

    let statusMessage = "Connected to the gateway and reading active contestant sessions.";
    if (authFailed) {
      statusMessage = AUTH_FAIL_MESSAGE;
    } else if (connectionState === "connected" && sessions.length === 0) {
      statusMessage = "Connected, but no contestant sessions are active yet.";
    } else if (connectionState === "connecting") {
      statusMessage = "Connecting to OpenClaw gateway...";
    } else if (connectionState === "authenticating") {
      statusMessage = "Authenticating with the OpenClaw gateway...";
    } else if (connectionState === "reconnecting") {
      statusMessage = "Gateway dropped. Attempting to reconnect...";
    } else if (connectionState === "disconnected") {
      statusMessage = "Gateway disconnected. Check URL, token, and local gateway availability.";
    }

    if (activityRun?.currentStageId) {
      statusMessage += ` Authority stage: ${activityRun.currentStageId}.`;
    }

    if (gatewayWarning) {
      statusMessage += ` Warning: ${gatewayWarning}.`;
    }

    return {
      configured: true,
      gatewayUrl,
      connectionState,
      authFailed,
      statusMessage,
      gatewayWarning,
      orchestrationContractStatus: orchestrationContract.status,
      orchestrationContractNote: orchestrationContract.note,
      activityRun,
      authorityStageId: activityRun?.currentStageId ?? null,
      lastSequence: orchestration.lastSequence,
      timers,
      activeTimer,
      submissions,
      lockedSubmissionCount,
      totalSubmissionCount,
      awards: orchestration.awards,
      domainEvents: orchestration.domainEvents,
      totalActiveSessions: sessions.length,
      stateCounts,
      roomCounts,
      roomRosters,
      sessions: visibleSessions,
      contestants,
      activities,
    };
  }, [
    authFailed,
    configured,
    connectionState,
    gatewayFeatures,
    gatewayUrl,
    gatewayWarning,
    messages,
    orchestration,
    sessions,
  ]);
}
