import { useEffect, useMemo, useState } from "react";
import { tryBuildActivityRoomCatalog } from "./activityRuntime";
import type {
  GatewayActivity,
  GatewayActivityRunSummary,
  GatewayAuditRecordSummary,
  GatewayAuthoritativeQueryStatus,
  GatewayAwardSummary,
  GatewayContestantSummary,
  GatewayOverview,
  GatewayScoreEntrySummary,
  GatewayScoreSummaryEntry,
  GatewayStateCount,
  GatewaySubmissionSummary,
  GatewayTimerSummary,
  GatewaySessionSummary,
} from "../types";
import {
  getGatewayRoomIds,
  getRoomLabel,
  normalizeControlDispatchMethod,
  resolveSessionRoomId,
  summarizeGatewayOrchestrationContract,
  UNAVAILABLE_ROOM_ID,
} from "./control";
import {
  buildGatewaySkillSummary,
  buildGatewayWorldSummary,
} from "./overviewSharedState";
import { OpenClawGatewayClient } from "./gateway/OpenClawGatewayClient";
import {
  OrchestratorQueryClient,
  resolveBrowserOrchestratorQueryConfig,
} from "./orchestratorQueryClient";
import type {
  ConnectionState,
  GatewayConfig,
  GatewayMessage,
  GatewaySessionEntry,
} from "./gateway/types";
import {
  AUTH_FAIL_MESSAGE,
  AUTHORITATIVE_QUERY_CHECK_ORDER,
  EMPTY_AUTHORITATIVE_QUERY_STATE,
  EMPTY_GATEWAY_FEATURES,
  EMPTY_ORCHESTRATION_STATE,
  applyOrchestrationEvent,
  applySnapshot,
  buildAuditRecordSummary,
  buildAuditSummary,
  buildBackendHealthSummary,
  buildDomainEventSummary,
  buildQueryCheckSummary,
  buildScoreEntrySummary,
  buildScoreSummaryEntry,
  buildSubmissionSummary,
  deriveContestantState,
  formatClockLabel,
  formatGatewayWarning,
  formatQueryFreshness,
  formatRemainingLabel,
  formatUpdatedLabel,
  normalizeHelloFeatures,
  normalizeTimestamp,
  resolveCurrentSubmission,
  stateMeta,
  type AuthoritativeQueryState,
  type GatewayFeatureState,
  type OrchestrationState,
} from "./overview/runtime";

export function useGatewayOverview(): GatewayOverview {
  const gatewayUrl = import.meta.env.VITE_OPENCLAW_URL?.trim() || "";
  const gatewayToken = import.meta.env.VITE_OPENCLAW_TOKEN?.trim() || "";
  const orchestratorQueryBaseUrl =
    import.meta.env.VITE_OPENCLAW_ORCHESTRATOR_URL?.trim() || "";
  const orchestratorQueryToken =
    import.meta.env.VITE_OPENCLAW_ORCHESTRATOR_TOKEN?.trim() || "";
  const configured = Boolean(gatewayUrl && gatewayToken);
  const orchestratorQueryConfig = useMemo(
    () =>
      resolveBrowserOrchestratorQueryConfig({
        orchestratorBaseUrl: orchestratorQueryBaseUrl,
        gatewayUrl,
        orchestratorToken: orchestratorQueryToken,
        gatewayToken,
      }),
    [gatewayToken, gatewayUrl, orchestratorQueryBaseUrl, orchestratorQueryToken],
  );
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
  const [authoritativeQueryState, setAuthoritativeQuery] = useState<AuthoritativeQueryState>(
    EMPTY_AUTHORITATIVE_QUERY_STATE,
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

  useEffect(() => {
    if (!orchestratorQueryConfig) {
      return;
    }

    let cancelled = false;
    const client = new OrchestratorQueryClient(orchestratorQueryConfig);
    const activityRunId = orchestration.activityRun?.id;

    const loadAuthoritativeQueries = async () => {
      setAuthoritativeQuery((previous) => ({
        ...previous,
        configured: true,
        baseUrl: orchestratorQueryConfig.baseUrl,
        source: orchestratorQueryConfig.source,
        note: orchestratorQueryConfig.note,
        loading: true,
        error: null,
      }));

      const results = await Promise.allSettled([
        client.fetchSnapshot(activityRunId),
        client.fetchScores({ activityRunId, limit: 12 }),
        client.fetchEvents({ activityRunId, limit: 12 }),
        client.fetchReplay({ activityRunId, limit: 12 }),
        client.fetchAudit({ activityRunId, limit: 8 }),
      ]);

      if (cancelled) {
        return;
      }

      const completedAt = Date.now();

      setAuthoritativeQuery((previous) => {
        const readResultError = (
          result: PromiseRejectedResult,
        ): string =>
          result.reason instanceof Error ? result.reason.message : "request failed";
        const nextState: AuthoritativeQueryState = {
          ...previous,
          configured: true,
          baseUrl: orchestratorQueryConfig.baseUrl,
          source: orchestratorQueryConfig.source,
          note: orchestratorQueryConfig.note,
          loading: false,
          error: null,
          checks: {
            ...previous.checks,
          },
        };
        const errors: string[] = [];
        let successCount = 0;

        if (results[0]?.status === "fulfilled") {
          nextState.snapshot = results[0].value;
          nextState.checks.snapshot = {
            status: "ok",
            error: null,
            lastSuccessfulAt: completedAt,
          };
          successCount += 1;
        } else if (results[0]) {
          const error = readResultError(results[0]);
          nextState.checks.snapshot = {
            ...previous.checks.snapshot,
            status: "error",
            error,
          };
          errors.push(`snapshot: ${error}`);
        }

        if (results[1]?.status === "fulfilled") {
          nextState.scores = results[1].value;
          nextState.checks.scores = {
            status: "ok",
            error: null,
            lastSuccessfulAt: completedAt,
          };
          successCount += 1;
        } else if (results[1]) {
          const error = readResultError(results[1]);
          nextState.checks.scores = {
            ...previous.checks.scores,
            status: "error",
            error,
          };
          errors.push(`scores: ${error}`);
        }

        if (results[2]?.status === "fulfilled") {
          nextState.events = results[2].value;
          nextState.checks.events = {
            status: "ok",
            error: null,
            lastSuccessfulAt: completedAt,
          };
          successCount += 1;
        } else if (results[2]) {
          const error = readResultError(results[2]);
          nextState.checks.events = {
            ...previous.checks.events,
            status: "error",
            error,
          };
          errors.push(`events: ${error}`);
        }

        if (results[3]?.status === "fulfilled") {
          nextState.replay = results[3].value;
          nextState.checks.replay = {
            status: "ok",
            error: null,
            lastSuccessfulAt: completedAt,
          };
          successCount += 1;
        } else if (results[3]) {
          const error = readResultError(results[3]);
          nextState.checks.replay = {
            ...previous.checks.replay,
            status: "error",
            error,
          };
          errors.push(`replay: ${error}`);
        }

        if (results[4]?.status === "fulfilled") {
          nextState.audit = results[4].value;
          nextState.checks.audit = {
            status: "ok",
            error: null,
            lastSuccessfulAt: completedAt,
          };
          successCount += 1;
        } else if (results[4]) {
          const error = readResultError(results[4]);
          nextState.checks.audit = {
            ...previous.checks.audit,
            status: "error",
            error,
          };
          errors.push(`audit: ${error}`);
        }

        if (successCount > 0) {
          nextState.lastSuccessfulAt = completedAt;
        }

        if (errors.length > 0) {
          nextState.error = errors.join(" | ");
        }

        return nextState;
      });
    };

    void loadAuthoritativeQueries();

    const refreshTimer = setInterval(() => {
      void loadAuthoritativeQueries();
    }, 15_000);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, [
    orchestratorQueryConfig,
    orchestration.activityRun?.id,
    orchestration.lastSequence,
    gatewayToken,
    gatewayUrl,
    orchestratorQueryBaseUrl,
    orchestratorQueryToken,
  ]);

  const authoritativeQuery = useMemo<AuthoritativeQueryState>(
    () =>
      orchestratorQueryConfig
        ? authoritativeQueryState
        : {
            ...EMPTY_AUTHORITATIVE_QUERY_STATE,
            note: !gatewayUrl && !orchestratorQueryBaseUrl
              ? "Authoritative HTTP query path is not configured yet."
              : !gatewayToken && !orchestratorQueryToken
                ? "Authoritative HTTP query path needs VITE_OPENCLAW_TOKEN or VITE_OPENCLAW_ORCHESTRATOR_TOKEN."
                : gatewayUrl
                  ? "Set VITE_OPENCLAW_ORCHESTRATOR_URL, or point VITE_OPENCLAW_URL at local ws://127.0.0.1:18791 to enable browser authoritative queries."
                  : "Authoritative HTTP query path is unavailable.",
          },
    [
      authoritativeQueryState,
      gatewayToken,
      gatewayUrl,
      orchestratorQueryBaseUrl,
      orchestratorQueryConfig,
      orchestratorQueryToken,
    ],
  );

  return useMemo(() => {
    const authoritativeSnapshot = authoritativeQuery.snapshot?.snapshot ?? null;
    const authoritativeActivityRun =
      authoritativeSnapshot?.activityRun ?? orchestration.activityRun;
    const authoritativeWorld = authoritativeSnapshot?.world ?? null;
    const runtimeWorld = authoritativeSnapshot?.world ?? orchestration.world ?? null;
    const authoritativeTimers =
      authoritativeSnapshot?.timers ?? orchestration.timers;
    const authoritativeSkills = authoritativeSnapshot?.skills ?? null;
    const authoritativeSubmissions =
      authoritativeSnapshot?.submissions ?? orchestration.submissions;
    const authoritativeScoreEntries =
      authoritativeQuery.scores?.scores ??
      authoritativeSnapshot?.scores ??
      orchestration.scores;
    const authoritativeScoreSummary =
      authoritativeQuery.scores?.scoreSummary ??
      authoritativeSnapshot?.scoreSummary ??
      orchestration.scoreSummary;
    const activityPackageId = authoritativeActivityRun?.templateId ?? null;
    const roomCatalog = tryBuildActivityRoomCatalog(
      activityPackageId,
      runtimeWorld,
    );
    const roomCatalogOptions = roomCatalog ? { roomCatalog } : undefined;
    const roomLabelById = new Map(
      (runtimeWorld ?? { rooms: [] }).rooms.map((room) => [
        room.id,
        room.label?.trim() || room.id,
      ]),
    );
    const observedRoomIds = new Set<string>(
      getGatewayRoomIds(activityPackageId, roomCatalogOptions),
    );

    for (const room of runtimeWorld?.rooms ?? []) {
      observedRoomIds.add(room.id);
    }
    for (const team of runtimeWorld?.teams ?? []) {
      if (team.roomId) {
        observedRoomIds.add(team.roomId);
      }
    }
    for (const entity of runtimeWorld?.entities ?? []) {
      if (entity.roomId) {
        observedRoomIds.add(entity.roomId);
      }
    }

    const allSessionSummaries: GatewaySessionSummary[] = [...sessions]
      .sort((left, right) => normalizeTimestamp(right.updatedAt) - normalizeTimestamp(left.updatedAt))
      .map((session) => {
        const roomId = resolveSessionRoomId(
          session.key,
          activityPackageId,
          roomCatalogOptions,
        );
        observedRoomIds.add(roomId);
        const state = deriveContestantState(session);
        return {
          agentId: session.agentId,
          sessionKey: session.key,
          roomId,
          roomLabel:
            roomLabelById.get(roomId) ??
            getRoomLabel(roomId, activityPackageId, roomCatalogOptions),
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

    const fallbackRoomId =
      runtimeWorld?.rooms.at(-1)?.id ??
      roomCatalog?.fallbackRoomId ??
      UNAVAILABLE_ROOM_ID;

    const allActivities: GatewayActivity[] = messages.map((message) => {
      const relatedRoom = roomByAgent.get(message.senderId);
      const roomId = relatedRoom?.roomId ?? fallbackRoomId;
      observedRoomIds.add(roomId);
      const timestamp = normalizeTimestamp(message.ts);

      return {
        id: message.id,
        agentId: message.senderId,
        roomId,
        roomLabel:
          relatedRoom?.roomLabel ??
          roomLabelById.get(roomId) ??
          getRoomLabel(roomId, activityPackageId, roomCatalogOptions),
        content: message.content,
        timestamp,
        timestampLabel: formatClockLabel(timestamp),
      };
    });

    const resolvedRoomIds = [...observedRoomIds].sort((left, right) =>
      left.localeCompare(right),
    );
    const roomCounts = resolvedRoomIds.map((roomId) => ({
      roomId,
      label:
        roomLabelById.get(roomId) ??
        getRoomLabel(roomId, activityPackageId, roomCatalogOptions),
      count: allSessionSummaries.filter((session) => session.roomId === roomId).length,
    }));
    const roomRosters = resolvedRoomIds.map((roomId) => ({
      roomId,
      label:
        roomLabelById.get(roomId) ??
        getRoomLabel(roomId, activityPackageId, roomCatalogOptions),
      sessions: allSessionSummaries.filter((session) => session.roomId === roomId),
    }));

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
    const authoritativeEventPage =
      authoritativeQuery.events?.events.length
        ? authoritativeQuery.events
        : authoritativeQuery.replay?.events.length
          ? authoritativeQuery.replay
          : null;
    const authoritativeDomainEvents = authoritativeEventPage
      ? authoritativeEventPage.events
          .map(buildDomainEventSummary)
          .sort((left, right) => right.timestamp - left.timestamp)
          .slice(0, 12)
      : orchestration.domainEvents;
    const authoritativeAwardFallbackTs =
      authoritativeSnapshot?.health?.ts ??
      orchestration.health?.ts ??
      authoritativeQuery.lastSuccessfulAt ??
      0;
    const authoritativeAwards =
      Array.isArray(authoritativeSnapshot?.awards)
        ? authoritativeSnapshot.awards
            .map((award) => {
              if (!award.label || !award.entityId) {
                return null;
              }
              const grantedAt = normalizeTimestamp(
                award.grantedAt ?? authoritativeAwardFallbackTs,
              );
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
        : orchestration.awards;

    const timers: GatewayTimerSummary[] = authoritativeTimers
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
        timer.stageId === authoritativeActivityRun?.currentStageId &&
        timer.state !== "ended",
      ) ??
      timers.find((timer) => timer.isRunning) ??
      timers[0] ??
      null;

    const submissions: GatewaySubmissionSummary[] = authoritativeSubmissions
      .map(buildSubmissionSummary)
      .sort((left, right) => {
        const rightUpdatedAt = right.updatedAt ?? right.lockedAt ?? right.openedAt ?? 0;
        const leftUpdatedAt = left.updatedAt ?? left.lockedAt ?? left.openedAt ?? 0;
        return rightUpdatedAt - leftUpdatedAt;
      });

    const activityRun: GatewayActivityRunSummary | null = authoritativeActivityRun
      ? {
          id: authoritativeActivityRun.id,
          templateId: authoritativeActivityRun.templateId,
          status: authoritativeActivityRun.status,
          currentStageId: authoritativeActivityRun.currentStageId,
          snapshotId:
            authoritativeSnapshot?.snapshotId ?? orchestration.snapshotId,
        }
      : null;

    const scores: GatewayScoreEntrySummary[] = authoritativeScoreEntries
      .map(buildScoreEntrySummary)
      .sort((left, right) => right.submittedAt - left.submittedAt);

    const scoreSummary: GatewayScoreSummaryEntry[] = authoritativeScoreSummary
      .map(buildScoreSummaryEntry)
      .sort((left, right) => right.lastSubmittedAt - left.lastSubmittedAt);

    const recentAuditRecords: GatewayAuditRecordSummary[] =
      authoritativeQuery.audit?.records
        .map(buildAuditRecordSummary)
        .sort((left, right) => right.handledAt - left.handledAt)
        .slice(0, 8) ?? [];
    const queryChecks = AUTHORITATIVE_QUERY_CHECK_ORDER.map((key) =>
      buildQueryCheckSummary({
        key,
        check: authoritativeQuery.checks[key],
      }),
    );
    const hasSuccessfulQuerySync = authoritativeQuery.lastSuccessfulAt !== null;
    const failedQueryChecks = queryChecks.filter((check) => check.status === "error");
    const orchestratorQueryStatus = !orchestratorQueryConfig
      ? "disabled"
      : !hasSuccessfulQuerySync &&
          (authoritativeQuery.loading || failedQueryChecks.length === 0)
        ? "syncing"
      : !hasSuccessfulQuerySync && failedQueryChecks.length > 0
          ? "unavailable"
        : failedQueryChecks.length > 0
            ? "degraded"
            : "available";
    const orchestratorQueryReason =
      orchestratorQueryStatus === "disabled"
        ? authoritativeQuery.note
        : orchestratorQueryStatus === "syncing"
          ? "Waiting for the first authoritative sync."
          : orchestratorQueryStatus === "unavailable"
            ? authoritativeQuery.error ??
              "Authoritative HTTP query is configured but currently unreadable."
            : orchestratorQueryStatus === "degraded"
              ? authoritativeQuery.error ??
                "Some authoritative query checks are failing; cached data may be stale."
              : null;
    const orchestratorQuery: GatewayAuthoritativeQueryStatus = {
      configured: Boolean(orchestratorQueryConfig),
      loading: authoritativeQuery.loading,
      available:
        hasSuccessfulQuerySync ||
        authoritativeQuery.snapshot !== null ||
        authoritativeQuery.audit !== null,
      status: orchestratorQueryStatus,
      statusLabel:
        orchestratorQueryStatus === "available"
          ? "Available"
          : orchestratorQueryStatus === "degraded"
            ? "Degraded"
            : orchestratorQueryStatus === "syncing"
              ? "Syncing"
              : orchestratorQueryStatus === "unavailable"
                ? "Unavailable"
                : "Disabled",
      baseUrl: orchestratorQueryConfig?.baseUrl ?? null,
      source: orchestratorQueryConfig?.source ?? "unavailable",
      note: authoritativeQuery.note,
      reason: orchestratorQueryReason,
      error: authoritativeQuery.error,
      lastSuccessfulAt: authoritativeQuery.lastSuccessfulAt,
      lastSuccessfulLabel: authoritativeQuery.lastSuccessfulAt
        ? formatUpdatedLabel(authoritativeQuery.lastSuccessfulAt)
        : null,
      freshnessLabel: formatQueryFreshness(authoritativeQuery.lastSuccessfulAt),
      tone:
        orchestratorQueryStatus === "available"
          ? "warm"
          : orchestratorQueryStatus === "degraded" ||
              orchestratorQueryStatus === "syncing"
            ? "active"
            : orchestratorQueryStatus === "unavailable"
              ? "critical"
              : "idle",
      checks: queryChecks,
    };
    const auditSummary = buildAuditSummary({
      records: recentAuditRecords,
      auditCheck: authoritativeQuery.checks.audit,
    });
    const authoritativeHealth =
      authoritativeSnapshot?.health ?? orchestration.health;
    const backendHealth = buildBackendHealthSummary({
      health: authoritativeHealth,
      hasAuthoritativeHealth: Boolean(authoritativeSnapshot?.health),
      orchestratorQuery,
      auditSummary,
    });
    const world = buildGatewayWorldSummary({
      authoritativeWorld,
      gatewayWorld: orchestration.world,
      hasAuthoritativeSnapshot: Boolean(authoritativeSnapshot),
      queryStatus: orchestratorQuery,
      sessions: allSessionSummaries,
      activityPackageId: activityRun?.templateId ?? null,
    });
    const skills = buildGatewaySkillSummary({
      authoritativeSkills,
      gatewaySkills: orchestration.skills,
      hasAuthoritativeSnapshot: Boolean(authoritativeSnapshot),
      queryStatus: orchestratorQuery,
      currentStageId: activityRun?.currentStageId ?? null,
    });

    const currentSubmission = resolveCurrentSubmission(
      submissions,
      activityRun?.currentStageId ?? null,
    );
    const activities = allActivities.slice(0, 12);
    const lockedSubmissionCount = submissions.filter((submission) => submission.locked).length;
    const totalSubmissionCount = submissions.length;
    const lastSequenceCandidates = [
      orchestration.lastSequence,
      authoritativeSnapshot?.lastSequence ?? null,
      authoritativeEventPage?.lastSequence ?? null,
      authoritativeQuery.scores?.lastSequence ?? null,
    ].filter((value): value is number => typeof value === "number");
    const lastSequence =
      lastSequenceCandidates.length > 0 ? Math.max(...lastSequenceCandidates) : null;
    const configuredDispatchMethod = normalizeControlDispatchMethod(
      import.meta.env.VITE_OPENCLAW_COMMAND_METHOD,
    );
    const orchestrationContract = summarizeGatewayOrchestrationContract({
      capabilities: gatewayFeatures,
      configuredDispatchMethod,
    });

    let statusMessage = "Connected to the gateway and reading active participant sessions.";
    if (!configured && orchestratorQuery.configured && orchestratorQuery.available) {
      statusMessage =
        "Gateway websocket is not configured; control is currently reading the authoritative HTTP query layer only.";
    } else if (!configured && orchestratorQuery.configured) {
      statusMessage =
        "Gateway websocket is not configured yet. Authoritative HTTP query is configured and waiting for backend sync.";
    } else if (!configured) {
      statusMessage = "OpenClaw gateway is not configured in this environment.";
    } else if (authFailed) {
      statusMessage = AUTH_FAIL_MESSAGE;
    } else if (connectionState === "connected" && sessions.length === 0) {
      statusMessage = "Connected, but no participant sessions are active yet.";
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

    if (orchestratorQuery.configured) {
      statusMessage += ` Authoritative query: ${orchestratorQuery.statusLabel} · ${orchestratorQuery.reason ?? orchestratorQuery.freshnessLabel}.`;
    }

    if (gatewayWarning) {
      statusMessage += ` Warning: ${gatewayWarning}.`;
    }

    return {
      configured,
      gatewayUrl: configured ? gatewayUrl : null,
      orchestratorQuery,
      auditSummary,
      backendHealth,
      world,
      skills,
      connectionState,
      authFailed,
      statusMessage,
      gatewayWarning,
      orchestrationContractStatus: orchestrationContract.status,
      orchestrationContractNote: orchestrationContract.note,
      activityRun,
      authorityStageId: activityRun?.currentStageId ?? null,
      lastSequence,
      timers,
      activeTimer,
      submissions,
      currentSubmission,
      lockedSubmissionCount,
      totalSubmissionCount,
      scores,
      scoreSummary,
      awards: authoritativeAwards,
      domainEvents: authoritativeDomainEvents,
      recentAuditRecords,
      totalActiveSessions: sessions.length,
      stateCounts,
      roomCounts,
      roomRosters,
      sessions: visibleSessions,
      contestants,
      activities,
    };
  }, [
    authoritativeQuery,
    authFailed,
    configured,
    connectionState,
    gatewayFeatures,
    gatewayUrl,
    gatewayWarning,
    messages,
    orchestration,
    orchestratorQueryConfig,
    sessions,
  ]);
}

