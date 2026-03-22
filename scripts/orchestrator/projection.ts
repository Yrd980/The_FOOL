import { normalizeActivityScoreAnnotations } from "../../src/openclaw/activityRuntime";
import type {
  AwardProjection,
  BetProjection,
  BetSettlementItem,
  EventEnvelope,
  ReactionProjection,
  ScoreAnnotations,
  ScoreProjection,
  SocialHeatEntry,
  SocialSnapshot,
  SubmissionProjection,
  SubmissionVersionRecord,
  TalkProjection,
  TimerProjection,
  TimerStatus,
  VoteProjection,
} from "../../src/openclaw/platform/contracts";
import {
  cloneJsonValue,
  isRecord,
  isRole,
  type ProjectionState,
  type ScoreQueryResult,
} from "./support";

export const computeRemainingMs = (
  timer: TimerProjection,
  now = Date.now(),
): number => {
  if (timer.state === "running" && typeof timer.endsAt === "number") {
    return Math.max(0, timer.endsAt - now);
  }

  if (timer.state === "ended") {
    return 0;
  }

  return Math.max(0, timer.remainingMs);
};

const upsertById = <T extends { id: string }>(
  items: T[],
  nextItem: T,
): T[] => {
  const remaining = items.filter((item) => item.id !== nextItem.id);
  return [...remaining, nextItem];
};

const upsertAwardById = (
  items: AwardProjection[],
  nextItem: AwardProjection,
): AwardProjection[] => {
  const remaining = items.filter((item) => item.awardId !== nextItem.awardId);
  return [...remaining, nextItem];
};

const upsertScoreById = (
  items: ScoreProjection[],
  nextItem: ScoreProjection,
): ScoreProjection[] => {
  const remaining = items.filter((item) => item.id !== nextItem.id);
  return [...remaining, nextItem];
};

const readSubmissionVersionRecord = (
  value: unknown,
): SubmissionVersionRecord | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.version !== "number" ||
    typeof value.updatedAt !== "number" ||
    typeof value.actorId !== "string" ||
    !isRole(value.actorRole) ||
    !isRecord(value.data)
  ) {
    return null;
  }

  return {
    version: value.version,
    updatedAt: value.updatedAt,
    actorId: value.actorId,
    actorRole: value.actorRole,
    data: cloneJsonValue(value.data),
  };
};

const readSubmissionVersionRecords = (
  value: unknown,
  fallback: SubmissionVersionRecord[] = [],
): SubmissionVersionRecord[] => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const records = value
    .map(readSubmissionVersionRecord)
    .filter((entry): entry is SubmissionVersionRecord => entry !== null)
    .sort((left, right) => left.version - right.version);

  return records.length > 0 ? records : fallback;
};

const readScoreAnnotations = (
  value: unknown,
  templateId?: string | null,
): ScoreAnnotations => {
  const rawScore = isRecord(value) ? value : {};
  return normalizeActivityScoreAnnotations(rawScore, templateId);
};

export const buildScoreSummary = (
  scores: ScoreProjection[],
): ScoreQueryResult["scoreSummary"] =>
  Array.from(
    scores.reduce(
      (groups, score) => {
        const summaryTargetType = score.teamId ? "team" : score.targetType;
        const summaryTargetId = score.teamId ?? score.targetId;
        const key = `${summaryTargetType}:${summaryTargetId}`;
        const existing = groups.get(key);
        if (existing) {
          existing.judgeCount += 1;
          existing.totalScore += score.score;
          existing.lastSubmittedAt = Math.max(
            existing.lastSubmittedAt,
            score.submittedAt,
          );
          if (!existing.teamId && score.teamId) {
            existing.teamId = score.teamId;
          }
          if (!existing.submissionId && score.submissionId) {
            existing.submissionId = score.submissionId;
          }
          return groups;
        }

        groups.set(key, {
          targetType: summaryTargetType,
          targetId: summaryTargetId,
          teamId: score.teamId,
          submissionId: score.submissionId,
          judgeCount: 1,
          totalScore: score.score,
          averageScore: score.score,
          lastSubmittedAt: score.submittedAt,
        });
        return groups;
      },
      new Map<string, ScoreQueryResult["scoreSummary"][number]>(),
    ),
  )
    .map(([, entry]) => ({
      ...entry,
      averageScore:
        entry.judgeCount > 0
          ? Number((entry.totalScore / entry.judgeCount).toFixed(2))
          : 0,
    }))
    .sort((left, right) => {
      if (right.averageScore !== left.averageScore) {
        return right.averageScore - left.averageScore;
      }
      if (right.judgeCount !== left.judgeCount) {
        return right.judgeCount - left.judgeCount;
      }
      return right.lastSubmittedAt - left.lastSubmittedAt;
    });

const buildHeatKey = (
  scope: SocialHeatEntry["scope"],
  targetId: string,
): string => `${scope}:${targetId}`;

const recordHeat = (
  entries: Map<string, SocialHeatEntry>,
  scope: SocialHeatEntry["scope"],
  targetId: string,
  delta: number,
  timestamp: number,
): void => {
  if (!Number.isFinite(delta) || delta <= 0) {
    return;
  }

  const key = buildHeatKey(scope, targetId);
  const existing = entries.get(key);
  if (existing) {
    existing.value += delta;
    existing.lastUpdatedAt = Math.max(existing.lastUpdatedAt, timestamp);
    return;
  }

  entries.set(key, {
    scope,
    targetId,
    value: delta,
    lastUpdatedAt: timestamp,
  });
};

const sortHeatEntries = (entries: SocialHeatEntry[]): SocialHeatEntry[] =>
  [...entries].sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }
    if (right.lastUpdatedAt !== left.lastUpdatedAt) {
      return right.lastUpdatedAt - left.lastUpdatedAt;
    }
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope);
    }
    return left.targetId.localeCompare(right.targetId);
  });

const sortBetSettlements = (items: BetSettlementItem[]): BetSettlementItem[] =>
  [...items].sort((left, right) => {
    if (right.settledAt !== left.settledAt) {
      return right.settledAt - left.settledAt;
    }
    return left.betId.localeCompare(right.betId);
  });

const buildSocialSnapshot = ({
  talks,
  reactions,
  bets,
  votes,
  betSettlements = [],
}: {
  talks: TalkProjection[];
  reactions: ReactionProjection[];
  bets: BetProjection[];
  votes: VoteProjection[];
  betSettlements?: BetSettlementItem[];
}): SocialSnapshot => {
  const audienceHeat = new Map<string, SocialHeatEntry>();
  const betHeat = new Map<string, SocialHeatEntry>();
  const reactionTotals = new Map<
    string,
    SocialSnapshot["reactionTotals"][number]
  >();
  const betSummary = new Map<string, SocialSnapshot["betSummary"][number]>();
  const voteSummary = new Map<string, SocialSnapshot["voteSummary"][number]>();

  for (const talk of talks) {
    if (talk.actorRole !== "viewer") {
      continue;
    }

    recordHeat(audienceHeat, "global", "global", 1, talk.submittedAt);
    if (talk.targetEntityId) {
      recordHeat(
        audienceHeat,
        "entity",
        talk.targetEntityId,
        1,
        talk.submittedAt,
      );
    } else if (talk.roomId) {
      recordHeat(audienceHeat, "room", talk.roomId, 1, talk.submittedAt);
    }
  }

  for (const reaction of reactions) {
    const scope = reaction.targetEntityId
      ? "entity"
      : reaction.targetTeamId
        ? "team"
        : reaction.roomId
          ? "room"
          : "global";
    const targetId =
      reaction.targetEntityId ??
      reaction.targetTeamId ??
      reaction.roomId ??
      "global";
    const key = buildHeatKey(scope, targetId);
    const existing = reactionTotals.get(key);
    if (existing) {
      existing.total += 1;
      existing.reactions[reaction.reaction] =
        (existing.reactions[reaction.reaction] ?? 0) + 1;
      existing.lastUpdatedAt = Math.max(
        existing.lastUpdatedAt,
        reaction.submittedAt,
      );
    } else {
      reactionTotals.set(key, {
        scope,
        targetId,
        total: 1,
        reactions: {
          [reaction.reaction]: 1,
        },
        lastUpdatedAt: reaction.submittedAt,
      });
    }

    if (reaction.actorRole === "viewer") {
      recordHeat(audienceHeat, "global", "global", 1, reaction.submittedAt);
      recordHeat(audienceHeat, scope, targetId, 1, reaction.submittedAt);
    }
  }

  for (const bet of bets) {
    const weight = bet.amount ?? 1;
    recordHeat(betHeat, "global", "global", weight, bet.placedAt);
    recordHeat(betHeat, bet.targetType, bet.targetId, weight, bet.placedAt);

    const betKey = `${bet.targetType}:${bet.targetId}`;
    const existing = betSummary.get(betKey);
    if (existing) {
      existing.count += 1;
      existing.totalAmount += bet.amount ?? 0;
      existing.lastPlacedAt = Math.max(existing.lastPlacedAt, bet.placedAt);
    } else {
      betSummary.set(betKey, {
        targetType: bet.targetType,
        targetId: bet.targetId,
        count: 1,
        totalAmount: bet.amount ?? 0,
        lastPlacedAt: bet.placedAt,
      });
    }

    if (bet.actorRole === "viewer") {
      recordHeat(audienceHeat, "global", "global", 1, bet.placedAt);
      recordHeat(audienceHeat, bet.targetType, bet.targetId, 1, bet.placedAt);
    }
  }

  for (const vote of votes) {
    const voteKey = `${vote.targetType}:${vote.targetId}`;
    const existing = voteSummary.get(voteKey);
    if (existing) {
      existing.count += 1;
      existing.totalValue += vote.value;
      existing.averageValue = Number(
        (existing.totalValue / existing.count).toFixed(2),
      );
      existing.lastSubmittedAt = Math.max(
        existing.lastSubmittedAt,
        vote.submittedAt,
      );
    } else {
      voteSummary.set(voteKey, {
        targetType: vote.targetType,
        targetId: vote.targetId,
        count: 1,
        totalValue: vote.value,
        averageValue: vote.value,
        lastSubmittedAt: vote.submittedAt,
      });
    }

    if (vote.voterRole === "viewer") {
      recordHeat(audienceHeat, "global", "global", 1, vote.submittedAt);
      recordHeat(
        audienceHeat,
        vote.targetType,
        vote.targetId,
        1,
        vote.submittedAt,
      );
    }
  }

  return {
    audienceHeat: sortHeatEntries([...audienceHeat.values()]),
    betHeat: sortHeatEntries([...betHeat.values()]),
    reactionTotals: [...reactionTotals.values()].sort((left, right) => {
      if (right.total !== left.total) {
        return right.total - left.total;
      }
      if (right.lastUpdatedAt !== left.lastUpdatedAt) {
        return right.lastUpdatedAt - left.lastUpdatedAt;
      }
      return left.targetId.localeCompare(right.targetId);
    }),
    betSummary: [...betSummary.values()].sort((left, right) => {
      if (right.totalAmount !== left.totalAmount) {
        return right.totalAmount - left.totalAmount;
      }
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.targetId.localeCompare(right.targetId);
    }),
    voteSummary: [...voteSummary.values()].sort((left, right) => {
      if (right.totalValue !== left.totalValue) {
        return right.totalValue - left.totalValue;
      }
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.targetId.localeCompare(right.targetId);
    }),
    betSettlements: sortBetSettlements(betSettlements),
  };
};

const readBetSettlementItems = (value: unknown): BetSettlementItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry): BetSettlementItem | null => {
      if (!isRecord(entry)) {
        return null;
      }

      const result =
        entry.result === "won" || entry.result === "lost" || entry.result === "push"
          ? entry.result
          : null;
      const targetType =
        entry.targetType === "team" ||
        entry.targetType === "entity" ||
        entry.targetType === "submission"
          ? entry.targetType
          : null;
      const actorRole =
        entry.actorRole === "agent" ||
        entry.actorRole === "host" ||
        entry.actorRole === "judge" ||
        entry.actorRole === "viewer" ||
        entry.actorRole === "admin"
          ? entry.actorRole
          : null;
      const winningTargetType =
        entry.winningTargetType === "team" ||
        entry.winningTargetType === "entity" ||
        entry.winningTargetType === "submission"
          ? entry.winningTargetType
          : undefined;

      if (
        typeof entry.betId !== "string" ||
        typeof entry.actorId !== "string" ||
        !actorRole ||
        !targetType ||
        typeof entry.targetId !== "string" ||
        !result ||
        typeof entry.settledAt !== "number"
      ) {
        return null;
      }

      return {
        betId: entry.betId,
        actorId: entry.actorId,
        actorRole,
        targetType,
        targetId: entry.targetId,
        amount:
          typeof entry.amount === "number" && Number.isFinite(entry.amount)
            ? entry.amount
            : undefined,
        odds:
          typeof entry.odds === "number" && Number.isFinite(entry.odds)
            ? entry.odds
            : undefined,
        stance:
          typeof entry.stance === "string" ? entry.stance : undefined,
        result,
        payout:
          typeof entry.payout === "number" && Number.isFinite(entry.payout)
            ? entry.payout
            : undefined,
        settledAt: entry.settledAt,
        winningTargetType,
        winningTargetId:
          typeof entry.winningTargetId === "string"
            ? entry.winningTargetId
            : undefined,
      };
    })
    .filter((entry): entry is BetSettlementItem => entry !== null);
};

const refreshSocialSnapshot = (
  projection: ProjectionState,
  betSettlements = projection.social.betSettlements,
): SocialSnapshot =>
  buildSocialSnapshot({
    talks: projection.talks,
    reactions: projection.reactions,
    bets: projection.bets,
    votes: projection.votes,
    betSettlements,
  });

export const applyEventToProjection = (
  current: ProjectionState,
  event: EventEnvelope,
): ProjectionState => {
  const payload = isRecord(event.payload) ? event.payload : {};
  let next: ProjectionState = {
    ...current,
    snapshotId: `snapshot-${event.sequence}`,
    lastSequence: event.sequence,
  };

  if (event.type === "activity.started") {
    const stageId =
      typeof payload.stageId === "string"
        ? payload.stageId
        : next.activityRun.currentStageId;
    next = {
      ...next,
      activityRun: {
        ...next.activityRun,
        status: "running",
        currentStageId: stageId,
        startedAt:
          typeof payload.startedAt === "number"
            ? payload.startedAt
            : next.activityRun.startedAt ?? event.timestamp,
      },
    };
  }

  if (event.type === "activity.finished") {
    const endedAt =
      typeof payload.endedAt === "number" ? payload.endedAt : event.timestamp;
    next = {
      ...next,
      activityRun: {
        ...next.activityRun,
        status: "finished",
        endedAt,
      },
      social: refreshSocialSnapshot(
        next,
        readBetSettlementItems(payload.betSettlements),
      ),
    };
  }

  if (event.type === "stage.changed") {
    const toStageId =
      typeof payload.toStageId === "string"
        ? payload.toStageId
        : typeof payload.stageId === "string"
          ? payload.stageId
          : null;
    next = {
      ...next,
      activityRun: {
        ...next.activityRun,
        currentStageId: toStageId,
        status: "running",
      },
    };
  }

  if (event.type.startsWith("timer.")) {
    const rawTimer = isRecord(payload.timer) ? payload.timer : payload;
    const existingTimer =
      typeof rawTimer.id === "string"
        ? next.timers.find((entry) => entry.id === rawTimer.id)
        : undefined;
    const timerId =
      typeof rawTimer.id === "string" ? rawTimer.id : `timer-${Date.now()}`;
    const durationSec =
      typeof rawTimer.durationSec === "number"
        ? rawTimer.durationSec
        : typeof payload.durationSec === "number"
          ? payload.durationSec
          : existingTimer?.durationSec ?? 0;
    const timer: TimerProjection = {
      id: timerId,
      stageId:
        typeof rawTimer.stageId === "string"
          ? rawTimer.stageId
          : existingTimer?.stageId ??
            next.activityRun.currentStageId ??
            "unknown-stage",
      durationSec,
      remainingMs:
        typeof rawTimer.remainingMs === "number"
          ? rawTimer.remainingMs
          : event.type === "timer.ended"
            ? 0
            : existingTimer?.remainingMs ?? durationSec * 1_000,
      state:
        typeof rawTimer.state === "string"
          ? (rawTimer.state as TimerStatus)
          : event.type === "timer.started"
            ? "running"
            : event.type === "timer.paused"
              ? "paused"
              : "ended",
      kind: "countdown",
      startedAt:
        typeof rawTimer.startedAt === "number"
          ? rawTimer.startedAt
          : existingTimer?.startedAt,
      pausedAt:
        typeof rawTimer.pausedAt === "number"
          ? rawTimer.pausedAt
          : existingTimer?.pausedAt,
      endedAt:
        typeof rawTimer.endedAt === "number"
          ? rawTimer.endedAt
          : existingTimer?.endedAt,
      endsAt:
        typeof rawTimer.endsAt === "number"
          ? rawTimer.endsAt
          : existingTimer?.endsAt,
      commandContext:
        isRecord(rawTimer.commandContext) &&
        (typeof rawTimer.commandContext.commandId === "string" ||
          typeof rawTimer.commandContext.idempotencyKey === "string")
          ? {
              commandId:
                typeof rawTimer.commandContext.commandId === "string"
                  ? rawTimer.commandContext.commandId
                  : undefined,
              idempotencyKey:
                typeof rawTimer.commandContext.idempotencyKey === "string"
                  ? rawTimer.commandContext.idempotencyKey
                  : undefined,
              actorId:
                typeof rawTimer.commandContext.actorId === "string"
                  ? rawTimer.commandContext.actorId
                  : undefined,
              actorRole:
                rawTimer.commandContext.actorRole === "agent" ||
                rawTimer.commandContext.actorRole === "host" ||
                rawTimer.commandContext.actorRole === "judge" ||
                rawTimer.commandContext.actorRole === "viewer" ||
                rawTimer.commandContext.actorRole === "admin"
                  ? rawTimer.commandContext.actorRole
                  : undefined,
            }
          : event.commandId || event.idempotencyKey
            ? {
                commandId: event.commandId,
                idempotencyKey: event.idempotencyKey,
                actorId: event.actorId,
                actorRole: event.actorRole,
              }
            : existingTimer?.commandContext,
    };
    next = {
      ...next,
      timers: upsertById(next.timers, timer),
    };
  }

  if (event.type.startsWith("submission.")) {
    const rawSubmission = isRecord(payload.submission) ? payload.submission : payload;
    const submissionId =
      typeof rawSubmission.id === "string" ? rawSubmission.id : null;

    if (submissionId) {
      const existingSubmission = next.submissions.find(
        (entry) => entry.id === submissionId,
      );
      const versions = readSubmissionVersionRecords(
        rawSubmission.versions,
        existingSubmission?.versions ?? [],
      );
      const latestVersionRecord = versions.at(-1);
      const submission: SubmissionProjection = {
        id: submissionId,
        activityRunId:
          typeof rawSubmission.activityRunId === "string"
            ? rawSubmission.activityRunId
            : next.activityRun.id,
        submitterId:
          typeof rawSubmission.submitterId === "string"
            ? rawSubmission.submitterId
            : typeof rawSubmission.teamId === "string"
              ? rawSubmission.teamId
              : existingSubmission?.submitterId ?? "unknown-submitter",
        schemaId:
          typeof rawSubmission.schemaId === "string"
            ? rawSubmission.schemaId
            : existingSubmission?.schemaId ?? "unknown-schema",
        data:
          isRecord(rawSubmission.data)
            ? cloneJsonValue(rawSubmission.data)
            : existingSubmission?.data ?? {},
        version:
          typeof rawSubmission.version === "number"
            ? rawSubmission.version
            : latestVersionRecord?.version ?? existingSubmission?.version ?? 0,
        versions,
        locked:
          typeof rawSubmission.locked === "boolean"
            ? rawSubmission.locked
            : event.type === "submission.locked",
        teamId:
          typeof rawSubmission.teamId === "string"
            ? rawSubmission.teamId
            : existingSubmission?.teamId,
        stageId:
          typeof rawSubmission.stageId === "string"
            ? rawSubmission.stageId
            : existingSubmission?.stageId,
        openedAt:
          typeof rawSubmission.openedAt === "number"
            ? rawSubmission.openedAt
            : existingSubmission?.openedAt ??
              (event.type === "submission.opened" ? event.timestamp : undefined),
        updatedAt:
          typeof rawSubmission.updatedAt === "number"
            ? rawSubmission.updatedAt
            : latestVersionRecord?.updatedAt ??
              existingSubmission?.updatedAt ??
              event.timestamp,
        lockedAt:
          typeof rawSubmission.lockedAt === "number"
            ? rawSubmission.lockedAt
            : existingSubmission?.lockedAt ??
              (event.type === "submission.locked" ? event.timestamp : undefined),
      };
      next = {
        ...next,
        submissions: upsertById(next.submissions, submission),
      };
    }
  }

  if (event.type === "judge.score_submitted") {
    const rawScore = isRecord(payload.judgeScore) ? payload.judgeScore : payload;
    const annotations = readScoreAnnotations(
      rawScore,
      next.activityRun.templateId,
    );

    if (
      typeof rawScore.id === "string" &&
      typeof rawScore.stageId === "string" &&
      typeof rawScore.judgeId === "string" &&
      (rawScore.judgeRole === "agent" ||
        rawScore.judgeRole === "host" ||
        rawScore.judgeRole === "judge" ||
        rawScore.judgeRole === "viewer" ||
        rawScore.judgeRole === "admin") &&
      (rawScore.targetType === "team" || rawScore.targetType === "submission") &&
      typeof rawScore.targetId === "string" &&
      typeof rawScore.score === "number" &&
      typeof rawScore.reason === "string"
    ) {
      next = {
        ...next,
        scores: upsertScoreById(next.scores, {
          id: rawScore.id,
          activityRunId:
            typeof rawScore.activityRunId === "string"
              ? rawScore.activityRunId
              : next.activityRun.id,
          stageId: rawScore.stageId,
          judgeId: rawScore.judgeId,
          judgeRole: rawScore.judgeRole,
          targetType: rawScore.targetType,
          targetId: rawScore.targetId,
          submissionId:
            typeof rawScore.submissionId === "string"
              ? rawScore.submissionId
              : undefined,
          teamId:
            typeof rawScore.teamId === "string" ? rawScore.teamId : undefined,
          score: rawScore.score,
          reason: rawScore.reason,
          annotations,
          submittedAt:
            typeof rawScore.submittedAt === "number"
              ? rawScore.submittedAt
              : event.timestamp,
        }),
      };
    }
  }

  if (event.type === "entity.moved") {
    const entityId =
      typeof payload.entityId === "string" ? payload.entityId : event.entityId;
    const toRoomId =
      typeof payload.toRoomId === "string"
        ? payload.toRoomId
        : typeof payload.roomId === "string"
          ? payload.roomId
          : undefined;
    if (entityId && toRoomId !== undefined) {
      const existingEntity = next.world.entities.find((entry) => entry.id === entityId);
      if (existingEntity) {
        next = {
          ...next,
          world: {
            ...next.world,
            entities: next.world.entities.map((entry) =>
              entry.id === entityId ? { ...entry, roomId: toRoomId } : entry,
            ),
          },
        };
      } else {
        next = {
          ...next,
          world: {
            ...next.world,
            entities: [
              ...next.world.entities,
              {
                id: entityId,
                kind: typeof payload.kind === "string" ? payload.kind : "agent",
                roomId: toRoomId,
              },
            ],
          },
        };
      }
    }
  }

  if (event.type === "team.assigned") {
    const rawTeam = isRecord(payload.team) ? payload.team : payload;
    const teamId = typeof rawTeam.id === "string" ? rawTeam.id : null;
    if (teamId) {
      const memberIds = Array.isArray(rawTeam.memberIds)
        ? rawTeam.memberIds.filter((memberId): memberId is string => typeof memberId === "string")
        : [];
      const roomId =
        typeof rawTeam.roomId === "string" ? rawTeam.roomId : undefined;
      const existingTeam = next.world.teams.find((team) => team.id === teamId);
      if (existingTeam) {
        next = {
          ...next,
          world: {
            ...next.world,
            teams: next.world.teams.map((team) =>
              team.id === teamId
                ? {
                    ...team,
                    memberIds: memberIds.length > 0 ? memberIds : team.memberIds,
                    roomId: roomId ?? team.roomId,
                  }
                : team,
            ),
          },
        };
      } else {
        next = {
          ...next,
          world: {
            ...next.world,
            teams: [...next.world.teams, { id: teamId, memberIds, roomId }],
          },
        };
      }
    }
  }

  if (event.type === "award.granted") {
    const rawAward = isRecord(payload.award) ? payload.award : payload;
    if (
      typeof rawAward.awardId === "string" &&
      typeof rawAward.label === "string" &&
      typeof rawAward.entityId === "string"
    ) {
      next = {
        ...next,
        awards: upsertAwardById(next.awards, {
          awardId: rawAward.awardId,
          label: rawAward.label,
          entityId: rawAward.entityId,
          reason:
            typeof rawAward.reason === "string" ? rawAward.reason : undefined,
          grantedAt:
            typeof rawAward.grantedAt === "number"
              ? rawAward.grantedAt
              : event.timestamp,
        }),
      };
    }
  }

  if (event.type === "agent.talked") {
    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";
    if (message && typeof event.actorId === "string" && isRole(event.actorRole)) {
      next = {
        ...next,
        talks: [
          ...next.talks,
          {
            actorId: event.actorId,
            actorRole: event.actorRole,
            stageId:
              typeof payload.stageId === "string" ? payload.stageId : undefined,
            message,
            roomId:
              typeof payload.roomId === "string" ? payload.roomId : undefined,
            targetEntityId:
              typeof payload.targetEntityId === "string"
                ? payload.targetEntityId
                : undefined,
            audienceScope:
              payload.audienceScope === "room" ||
              payload.audienceScope === "team" ||
              payload.audienceScope === "global"
                ? payload.audienceScope
                : undefined,
            submittedAt: event.timestamp,
          },
        ],
      };
      next = {
        ...next,
        social: refreshSocialSnapshot(next),
      };
    }
  }

  if (event.type === "reaction.added") {
    const reaction =
      typeof payload.reaction === "string" ? payload.reaction.trim() : "";
    if (reaction && typeof event.actorId === "string" && isRole(event.actorRole)) {
      next = {
        ...next,
        reactions: [
          ...next.reactions,
          {
            actorId: event.actorId,
            actorRole: event.actorRole,
            stageId:
              typeof payload.stageId === "string" ? payload.stageId : undefined,
            reaction,
            roomId:
              typeof payload.roomId === "string" ? payload.roomId : undefined,
            targetEntityId:
              typeof payload.targetEntityId === "string"
                ? payload.targetEntityId
                : undefined,
            targetTeamId:
              typeof payload.targetTeamId === "string"
                ? payload.targetTeamId
                : undefined,
            note: typeof payload.note === "string" ? payload.note : undefined,
            submittedAt: event.timestamp,
          },
        ],
      };
      next = {
        ...next,
        social: refreshSocialSnapshot(next),
      };
    }
  }

  if (event.type === "bet.placed") {
    const targetType =
      payload.targetType === "team" ||
      payload.targetType === "entity" ||
      payload.targetType === "submission"
        ? payload.targetType
        : null;
    const targetId =
      typeof payload.targetId === "string" ? payload.targetId : null;
    if (
      targetType &&
      targetId &&
      typeof event.actorId === "string" &&
      isRole(event.actorRole)
    ) {
      next = {
        ...next,
        bets: upsertById(next.bets, {
          id: event.id,
          activityRunId: event.activityRunId ?? next.activityRun.id,
          actorId: event.actorId,
          actorRole: event.actorRole,
          stageId:
            typeof payload.stageId === "string" ? payload.stageId : undefined,
          targetType,
          targetId,
          roomId:
            typeof payload.roomId === "string" ? payload.roomId : undefined,
          amount:
            typeof payload.amount === "number" && Number.isFinite(payload.amount)
              ? payload.amount
              : undefined,
          odds:
            typeof payload.odds === "number" && Number.isFinite(payload.odds)
              ? payload.odds
              : undefined,
          stance: typeof payload.stance === "string" ? payload.stance : undefined,
          note: typeof payload.note === "string" ? payload.note : undefined,
          placedAt: event.timestamp,
        }),
      };
      next = {
        ...next,
        social: refreshSocialSnapshot(next),
      };
    }
  }

  if (event.type === "vote.cast") {
    const targetType =
      payload.targetType === "team" ||
      payload.targetType === "entity" ||
      payload.targetType === "submission"
        ? payload.targetType
        : null;
    const targetId =
      typeof payload.targetId === "string" ? payload.targetId : null;
    if (
      targetType &&
      targetId &&
      typeof event.actorId === "string" &&
      isRole(event.actorRole)
    ) {
      next = {
        ...next,
        votes: upsertById(next.votes, {
          id: event.id,
          activityRunId: event.activityRunId ?? next.activityRun.id,
          voterId: event.actorId,
          voterRole: event.actorRole,
          stageId:
            typeof payload.stageId === "string" ? payload.stageId : undefined,
          targetType,
          targetId,
          roomId:
            typeof payload.roomId === "string" ? payload.roomId : undefined,
          value:
            typeof payload.value === "number" && Number.isFinite(payload.value)
              ? Math.max(1, Math.round(payload.value))
              : 1,
          note: typeof payload.note === "string" ? payload.note : undefined,
          submittedAt: event.timestamp,
        }),
      };
      next = {
        ...next,
        social: refreshSocialSnapshot(next),
      };
    }
  }

  return next;
};

export const buildBootstrapActivityStartedEvent = (
  seedProjection: ProjectionState,
): EventEnvelope => {
  const now = seedProjection.activityRun.startedAt ?? Date.now();
  return {
    id: "evt-1",
    sequence: 1,
    type: "activity.started",
    activityRunId: seedProjection.activityRun.id,
    timestamp: now,
    payload: {
      activityRunId: seedProjection.activityRun.id,
      stageId: seedProjection.activityRun.currentStageId,
      startedAt: now,
    },
  };
};

export const rebuildProjectionFromEventLog = (
  events: EventEnvelope[],
  seedProjection: ProjectionState,
): ProjectionState => events.reduce(applyEventToProjection, seedProjection);
