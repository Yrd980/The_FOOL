import type { ActivityRoomSceneRole } from "./openclaw/activityMetadata";
import type {
  GatewayContestantSummary,
  GatewayOverview,
  StageDefinition,
  StageRuntimeGuide,
} from "./types";

export type UiTone = "critical" | "active" | "warm" | "idle";

export interface FocusRoomSummary {
  roomId: string;
  label: string;
  count: number;
}

export interface RankedContestant extends GatewayContestantSummary {
  isInFocusRoom: boolean;
  roomRole: ActivityRoomSceneRole | null;
  stageFitLabel: string;
  stageFitTone: UiTone;
  attentionLabel: string;
  attentionNote: string;
  attentionTone: UiTone;
}

export interface ShowStateCopy {
  label: string;
  action: string;
  note: string;
  tone: UiTone;
}

export interface RoomHeatSummary {
  roomId: string;
  label: string;
  count: number;
  roomRole: ActivityRoomSceneRole | null;
  liveActivityCount: number;
  authoritySignalCount: number;
  authorityScore: number;
  liveTieBreakerScore: number;
  latestAuthorityHeadline: string | null;
  heatScore: number;
  heatLabel: string;
  heatTone: UiTone;
  story: string;
  headliners: string[];
  isFocusRoom: boolean;
}

export interface ShowEventSummary {
  id: string;
  eyebrow: string;
  headline: string;
  body: string;
  roomLabel: string;
  timestampLabel: string;
  tone: UiTone;
}

export interface ShowEmptyState {
  eyebrow: string;
  title: string;
  body: string;
}

const statePriority = {
  speaking: 3,
  "raised-hand": 4,
  listening: 2,
  muted: 1,
};

const heatWeight = {
  speaking: 16,
  "raised-hand": 13,
  listening: 8,
  muted: 3,
};

const resolveRoomRole = (
  roomId: string,
  runtimeGuide: StageRuntimeGuide,
): ActivityRoomSceneRole | null => runtimeGuide.roomRoles[roomId] ?? null;

const buildStageFit = (
  contestant: GatewayContestantSummary,
  focusRoomIds: Set<string>,
  runtimeGuide: StageRuntimeGuide,
): Pick<
  RankedContestant,
  "isInFocusRoom" | "roomRole" | "stageFitLabel" | "stageFitTone"
> => {
  const roomRole = resolveRoomRole(contestant.roomId, runtimeGuide);
  if (focusRoomIds.has(contestant.roomId)) {
    return {
      isInFocusRoom: true,
      roomRole,
      stageFitLabel: "On Script",
      stageFitTone: "warm",
    };
  }

  if (roomRole === "holding") {
    return {
      isInFocusRoom: false,
      roomRole,
      stageFitLabel: "Holding",
      stageFitTone: "idle",
    };
  }

  return {
    isInFocusRoom: false,
    roomRole,
    stageFitLabel: "Side Room",
    stageFitTone: "active",
  };
};

const buildAttention = (
  contestant: GatewayContestantSummary,
  isInFocusRoom: boolean,
  primaryFocusRoomLabel: string | null,
): Pick<RankedContestant, "attentionLabel" | "attentionNote" | "attentionTone"> => {
  if (contestant.state === "raised-hand" && isInFocusRoom) {
    return {
      attentionLabel: "Give Next Turn",
      attentionNote: "参与者已经在当前幕的焦点房间里举手，适合优先给麦或点名回应。",
      attentionTone: "active",
    };
  }

  if (contestant.state === "raised-hand") {
    return {
      attentionLabel: `Pull To ${primaryFocusRoomLabel ?? "Focus Room"}`,
      attentionNote: "参与者正在请求注意力，但人还不在当前幕的焦点房间里，适合被拉回现场。",
      attentionTone: "active",
    };
  }

  if (contestant.state === "speaking" && isInFocusRoom) {
    return {
      attentionLabel: "Keep Live",
      attentionNote: "参与者已经在正确的房间里发声，适合继续保留镜头或顺手截取高光。",
      attentionTone: "critical",
    };
  }

  if (contestant.state === "speaking") {
    return {
      attentionLabel: "Monitor Side Signal",
      attentionNote: "参与者正在侧房间输出内容，可能值得巡房，也可能需要被拉回焦点房间。",
      attentionTone: "warm",
    };
  }

  if (contestant.state === "muted" && isInFocusRoom) {
    return {
      attentionLabel: "Ping Heartbeat",
      attentionNote: "参与者已经在焦点房间落位，但长时间没反应，适合发 heartbeat 或轻推一把。",
      attentionTone: "idle",
    };
  }

  if (isInFocusRoom) {
    return {
      attentionLabel: "Watch Reactions",
      attentionNote: "参与者在正确房间里保持倾听状态，暂时不必介入，但值得继续观察。",
      attentionTone: "warm",
    };
  }

  return {
    attentionLabel: "Let Team Cook",
    attentionNote: "参与者目前不在焦点房间，且没有强烈信号，适合暂时放在侧线继续推进。",
    attentionTone: "idle",
  };
};

const sortContestants = (left: RankedContestant, right: RankedContestant): number => {
  if (left.isInFocusRoom !== right.isInFocusRoom) {
    return Number(right.isInFocusRoom) - Number(left.isInFocusRoom);
  }

  if (left.state !== right.state) {
    return statePriority[right.state] - statePriority[left.state];
  }

  if (left.activityCount !== right.activityCount) {
    return right.activityCount - left.activityCount;
  }

  const rightSignal = Math.max(right.updatedAt, right.recentActivity?.timestamp ?? 0);
  const leftSignal = Math.max(left.updatedAt, left.recentActivity?.timestamp ?? 0);
  return rightSignal - leftSignal;
};

export const buildFocusRooms = (
  runtimeGuide: StageRuntimeGuide,
  gateway: GatewayOverview,
): FocusRoomSummary[] =>
  runtimeGuide.preferredRoomIds.map((roomId) => {
    const roomCount = gateway.roomCounts.find((room) => room.roomId === roomId);
    return {
      roomId,
      label: roomCount?.label ?? roomId,
      count: roomCount?.count ?? 0,
    };
  });

export const rankContestants = (
  gateway: GatewayOverview,
  runtimeGuide: StageRuntimeGuide,
): RankedContestant[] => {
  const focusRooms = buildFocusRooms(runtimeGuide, gateway);
  const focusRoomIds = new Set(runtimeGuide.preferredRoomIds);
  const primaryFocusRoomLabel = focusRooms[0]?.label ?? null;

  return gateway.contestants
    .map((contestant) => {
      const stageFit = buildStageFit(contestant, focusRoomIds, runtimeGuide);
      return {
        ...contestant,
        ...stageFit,
        ...buildAttention(contestant, stageFit.isInFocusRoom, primaryFocusRoomLabel),
      };
    })
    .sort(sortContestants);
};

export const buildShowStateCopy = (
  contestant: RankedContestant | null,
  stage: StageDefinition,
  runtimeGuide: StageRuntimeGuide,
): ShowStateCopy => {
  if (!contestant) {
    return {
      label: "待开机位",
      action: "焦点房间还在等第一位参与者冲进画面",
      note: `聚光灯已经切到 ${stage.title}，但第一句能被观众记住的台词还没落地。`,
      tone: "idle",
    };
  }

  if (contestant.state === "speaking" && contestant.isInFocusRoom) {
    return {
      label: "全场镜头锁定",
      action: "正在把主舞台推到最亮",
      note: `${contestant.agentId} 正在 ${contestant.roomLabel} 把 ${stage.title} 顶成此刻的正片中心，随时可能甩出下一句金句。`,
      tone: "critical",
    };
  }

  if (contestant.state === "speaking") {
    return {
      label: "侧房偷跑",
      action: `正在 ${contestant.roomLabel} 抢先产出剧情`,
      note: `${contestant.agentId} 在侧房已经说到观众会想切过去看，导演下一秒就可能把它拽回主线。`,
      tone: "warm",
    };
  }

  if (contestant.state === "raised-hand" && contestant.isInFocusRoom) {
    return {
      label: "抢麦中",
      action: "下一句可能就是爆点",
      note: `${contestant.agentId} 已经站到正确机位，明显在等一个 cue 把现场再往前拱一步。`,
      tone: "active",
    };
  }

  if (contestant.state === "raised-hand") {
    return {
      label: "举手求切镜头",
      action: `想从 ${contestant.roomLabel} 直接冲回现场`,
      note: `${contestant.agentId} 已经把手举起来了，只差被导演切进本幕的焦点区域。`,
      tone: "active",
    };
  }

  if (contestant.state === "listening" && contestant.isInFocusRoom) {
    return {
      label: "屏息等爆点",
      action: "正在盯着镜头机会",
      note: `${contestant.agentId} 已经卡在正确机位上，只差一个 cue 就会突然冒头。`,
      tone: "warm",
    };
  }

  if (contestant.state === "listening") {
    return {
      label: "暗线潜伏",
      action: `在 ${contestant.roomLabel} 憋下一段剧情`,
      note: `${contestant.agentId} 还没把自己推到镜头中心，但也绝对没有离场。`,
      tone: "warm",
    };
  }

  if (resolveRoomRole(contestant.roomId, runtimeGuide) === "holding") {
    return {
      label: "退到后景冷静",
      action: `在 ${contestant.roomLabel} 整理情绪`,
      note: `${contestant.agentId} 暂时撤出主线，但这通常只是下一轮反扑前的缓冲。`,
      tone: "idle",
    };
  }

  return {
    label: "镜头暂未扫到",
    action: "还没长成值得切近景的信号",
    note: `${contestant.agentId} 还在系统里，只是此刻的舞台声量还不够大。`,
    tone: "idle",
  };
};

interface AuthorityRoomSignal {
  id: string;
  roomId: string;
  headline: string;
  detail: string;
  tone: UiTone;
  timestamp: number;
  weight: number;
}

const authoritySignalWeight = {
  "stage.changed": 8,
  "timer.started": 7,
  "timer.paused": 6,
  "timer.ended": 8,
  "submission.opened": 10,
  "submission.updated": 12,
  "submission.locked": 14,
  "judge.score_submitted": 16,
  "award.granted": 18,
  "draw.submitted": 12,
  "entity.moved": 10,
  "team.assigned": 12,
} as const;

const authorityToneWeight = {
  critical: 4,
  active: 3,
  warm: 2,
  idle: 1,
} as const;

const resolveDomainEventRoomId = ({
  event,
  gateway,
  runtimeGuide,
}: {
  event: GatewayOverview["domainEvents"][number];
  gateway: GatewayOverview;
  runtimeGuide: StageRuntimeGuide;
}): string | null => {
  if (event.roomId) {
    return event.roomId;
  }

  if (event.teamId) {
    return (
      gateway.world.teams.find((team) => team.teamId === event.teamId)?.roomId ?? null
    );
  }

  if (event.submissionId) {
    const submission = gateway.submissions.find(
      (candidate) => candidate.id === event.submissionId,
    );
    if (submission?.teamId) {
      return (
        gateway.world.teams.find((team) => team.teamId === submission.teamId)?.roomId ??
        null
      );
    }
  }

  if (event.entityId) {
    const matchingTeam = gateway.world.teams.find(
      (team) => team.teamId === event.entityId,
    );
    if (matchingTeam?.roomId) {
      return matchingTeam.roomId;
    }

    const matchingEntity = gateway.world.entities.find(
      (entity) => entity.entityId === event.entityId,
    );
    if (matchingEntity?.roomId) {
      return matchingEntity.roomId;
    }

    if (matchingEntity?.teamId) {
      return (
        gateway.world.teams.find((team) => team.teamId === matchingEntity.teamId)?.roomId ??
        null
      );
    }
  }

  if (event.stageId && runtimeGuide.preferredRoomIds.length === 1) {
    return runtimeGuide.preferredRoomIds[0] ?? null;
  }

  return null;
};

const buildAuthorityRoomSignals = (
  gateway: GatewayOverview,
  runtimeGuide: StageRuntimeGuide,
): Map<string, AuthorityRoomSignal[]> => {
  const signalsByRoom = new Map<string, AuthorityRoomSignal[]>();

  const pushSignal = (signal: AuthorityRoomSignal): void => {
    const existing = signalsByRoom.get(signal.roomId) ?? [];
    existing.push(signal);
    existing.sort((left, right) => right.timestamp - left.timestamp);
    signalsByRoom.set(signal.roomId, existing.slice(0, 6));
  };

  for (const event of gateway.domainEvents) {
    const roomId = resolveDomainEventRoomId({ event, gateway, runtimeGuide });
    if (!roomId) {
      continue;
    }

    pushSignal({
      id: event.id,
      roomId,
      headline: event.title,
      detail: event.detail,
      tone: event.tone,
      timestamp: event.timestamp,
      weight:
        (authoritySignalWeight[
          event.type as keyof typeof authoritySignalWeight
        ] ?? 6) + authorityToneWeight[event.tone],
    });
  }

  const currentSubmission = gateway.currentSubmission;
  if (currentSubmission?.teamId) {
    const roomId =
      gateway.world.teams.find((team) => team.teamId === currentSubmission.teamId)?.roomId ??
      null;
    if (roomId) {
      pushSignal({
        id: `submission:${currentSubmission.id}`,
        roomId,
        headline: currentSubmission.locked
          ? "Current Submission Locked"
          : "Current Submission In Flight",
        detail: currentSubmission.locked
          ? `${currentSubmission.id} 已经锁进 authority projection。`
          : `${currentSubmission.id} 仍在 authority submission window 内更新。`,
        tone: currentSubmission.locked ? "critical" : "active",
        timestamp:
          currentSubmission.lockedAt ??
          currentSubmission.updatedAt ??
          currentSubmission.openedAt ??
          0,
        weight: currentSubmission.locked ? 16 : 12,
      });
    }
  }

  const latestScore = gateway.scores[0] ?? null;
  if (latestScore?.teamId) {
    const roomId =
      gateway.world.teams.find((team) => team.teamId === latestScore.teamId)?.roomId ??
      null;
    if (roomId) {
      pushSignal({
        id: `score:${latestScore.id}`,
        roomId,
        headline: "Latest Score Registered",
        detail: `${latestScore.judgeId ?? "judge"} 对 ${latestScore.teamId} 的评分已经进入 authority score projection。`,
        tone: "critical",
        timestamp: latestScore.submittedAt,
        weight: 17,
      });
    }
  }

  const latestAward = gateway.awards[0] ?? null;
  if (latestAward) {
    const awardRoomId =
      gateway.world.teams.find((team) => team.teamId === latestAward.entityId)?.roomId ??
      gateway.world.entities.find((entity) => entity.entityId === latestAward.entityId)
        ?.roomId ??
      null;
    if (awardRoomId) {
      pushSignal({
        id: `award:${latestAward.id}`,
        roomId: awardRoomId,
        headline: "Latest Award Granted",
        detail: `${latestAward.entityId} 刚被正式写进 ${latestAward.label}。`,
        tone: "critical",
        timestamp: latestAward.grantedAt,
        weight: 19,
      });
    }
  }

  return signalsByRoom;
};

export const buildRoomHeatSummaries = (
  gateway: GatewayOverview,
  runtimeGuide: StageRuntimeGuide,
): RoomHeatSummary[] => {
  const focusRoomIds = new Set(runtimeGuide.preferredRoomIds);
  const activityCountByRoom = gateway.activities.reduce<Record<string, number>>(
    (acc, activity) => {
      acc[activity.roomId] = (acc[activity.roomId] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const worldRoomById = new Map(
    gateway.world.rooms.map((room) => [room.roomId, room]),
  );
  const worldTeamById = new Map(
    gateway.world.teams.map((team) => [team.teamId, team]),
  );
  const authoritySignalsByRoom = buildAuthorityRoomSignals(gateway, runtimeGuide);

  return gateway.roomRosters
    .map((room) => {
      const roomRole = resolveRoomRole(room.roomId, runtimeGuide);
      const liveActivityCount = activityCountByRoom[room.roomId] ?? 0;
      const authoritySignals = authoritySignalsByRoom.get(room.roomId) ?? [];
      const latestAuthoritySignal = authoritySignals[0] ?? null;
      const worldRoom = worldRoomById.get(room.roomId) ?? null;
      const authoritySignalCount = authoritySignals.length;
      const authorityScore =
        authoritySignals.reduce(
          (sum, signal, index) => sum + Math.max(4, signal.weight - index * 2),
          0,
        ) +
        (worldRoom?.teamCount ?? 0) * 10 +
        (worldRoom?.memberCount ?? 0) * 4 +
        (worldRoom?.occupantCount ?? 0) * 2;
      const stateScore = room.sessions.reduce((sum, session) => sum + heatWeight[session.state], 0);
      const liveTieBreakerScore = runtimeGuide.scene.heatAsTieBreaker
        ? room.sessions.length * 4 + liveActivityCount * 5 + stateScore
        : 0;
      const heatScore =
        authorityScore +
        liveTieBreakerScore +
        (focusRoomIds.has(room.roomId) ? 24 : 0);

      let heatLabel: string;
      let heatTone: UiTone;
      if (latestAuthoritySignal && focusRoomIds.has(room.roomId)) {
        heatLabel = "权威主机位";
        heatTone =
          latestAuthoritySignal.tone === "idle"
            ? "active"
            : latestAuthoritySignal.tone;
      } else if (latestAuthoritySignal) {
        heatLabel = "权威信号已点亮";
        heatTone = latestAuthoritySignal.tone;
      } else if (focusRoomIds.has(room.roomId)) {
        heatLabel = "本幕主房间";
        heatTone = "warm";
      } else if (worldRoom && (worldRoom.teamCount > 0 || worldRoom.occupantCount > 0)) {
        heatLabel = roomRole === "holding" ? "权威缓冲区" : "权威落位已就位";
        heatTone = roomRole === "holding" ? "idle" : "warm";
      } else {
        heatLabel =
          runtimeGuide.scene.heatAsTieBreaker && room.sessions.length > 0
            ? "同幕 tie-breaker"
            : roomRole === "holding"
              ? "幕后缓冲"
              : "待权威信号";
        heatTone =
          runtimeGuide.scene.heatAsTieBreaker && room.sessions.length > 0
            ? "active"
            : "idle";
      }

      let story = "镜头暂时还没拿到足够的权威房间线索，先保持低火观察。";
      if (latestAuthoritySignal) {
        story = `${latestAuthoritySignal.detail} ${
          runtimeGuide.scene.heatAsTieBreaker && liveActivityCount > 0
            ? `Live 侧的 ${liveActivityCount} 条房间台词只负责同幕内细排，不再主导这幕去哪。`
            : "当前排序优先跟这条权威信号走。"
        }`;
      } else if (focusRoomIds.has(room.roomId) && worldRoom) {
        story = `${worldRoom.teamCount} 支队伍映射到这里，${worldRoom.occupantCount} 位实体当前在场。当前幕还没出现更强的房间级事件前，镜头先跟 authority room placement 走。`;
      } else if (worldRoom && (worldRoom.teamCount > 0 || worldRoom.occupantCount > 0)) {
        story = `${worldRoom.teamCount} 支队伍映射到这里，${worldRoom.occupantCount} 位实体当前在场。这里的叙事先由 authority world 支撑，而不是单靠聊天热度抬起来。`;
      } else if (runtimeGuide.scene.heatAsTieBreaker && room.sessions.length > 0) {
        story = `${room.sessions.length} 个 live session 和 ${liveActivityCount} 条房间台词目前只作为并列时的辅助排序依据。`;
      } else if (roomRole === "holding") {
        story = "情绪、停顿和下一轮反扑都先在这里喘一口气。";
      }

      const headliners = [
        ...room.sessions.map((session) => session.agentId),
        ...(worldRoom?.occupantIds ?? []),
        ...((worldRoom?.teamIds ?? []).flatMap(
          (teamId) => worldTeamById.get(teamId)?.members.map((member) => member.entityId) ?? [],
        )),
      ]
        .filter((value, index, array) => array.indexOf(value) === index)
        .slice(0, 3);

      return {
        roomId: room.roomId,
        label: room.label,
        count: room.sessions.length,
        roomRole,
        liveActivityCount,
        authoritySignalCount,
        authorityScore,
        liveTieBreakerScore,
        latestAuthorityHeadline: latestAuthoritySignal?.headline ?? null,
        heatScore,
        heatLabel,
        heatTone,
        story,
        headliners,
        isFocusRoom: focusRoomIds.has(room.roomId),
      };
    })
    .sort((left, right) => {
      if (left.isFocusRoom !== right.isFocusRoom) {
        return left.isFocusRoom ? -1 : 1;
      }
      if (left.authorityScore !== right.authorityScore) {
        return right.authorityScore - left.authorityScore;
      }
      if (
        runtimeGuide.scene.heatAsTieBreaker &&
        left.liveTieBreakerScore !== right.liveTieBreakerScore
      ) {
        return right.liveTieBreakerScore - left.liveTieBreakerScore;
      }
      if (left.heatScore !== right.heatScore) {
        return right.heatScore - left.heatScore;
      }
      return right.count - left.count;
    });
};

export const buildShowEvents = (
  gateway: GatewayOverview,
  contestants: RankedContestant[],
  runtimeGuide: StageRuntimeGuide,
): ShowEventSummary[] => {
  const contestantById = new Map(contestants.map((contestant) => [contestant.agentId, contestant]));
  const activityEvents = gateway.activities.map((activity) => {
    const contestant = contestantById.get(activity.agentId);
    const roomRole = resolveRoomRole(activity.roomId, runtimeGuide);

    let headline = `${activity.agentId} 刚往 ${activity.roomLabel} 扔进一句能剪预告的台词`;
    if (contestant?.state === "raised-hand") {
      headline = `${activity.agentId} 正在抢麦，想把现场再往前拱一步`;
    } else if (roomRole === "stage") {
      headline = `${activity.agentId} 又把主舞台顶亮了一格`;
    } else if (roomRole === "collaboration") {
      headline = `${activity.agentId} 在 ${activity.roomLabel} 憋出一段新的协作剧情`;
    } else if (roomRole === "holding") {
      headline = `${activity.agentId} 在 ${activity.roomLabel} 低声回血，像在准备下一波反扑`;
    }

    return {
      id: activity.id,
      eyebrow: activity.roomLabel,
      headline,
      body: activity.content,
      roomLabel: activity.roomLabel,
      timestampLabel: activity.timestampLabel,
      tone: contestant?.stateTone ?? "warm",
      sortTimestamp: activity.timestamp,
    };
  });

  const domainEvents = gateway.domainEvents.map((event) => ({
    id: event.id,
    eyebrow: "Platform Cue",
    headline: event.title,
    body: event.detail,
    roomLabel: event.stageId ?? "platform",
    timestampLabel: event.timestampLabel,
    tone: event.tone,
    sortTimestamp: event.timestamp,
  }));

  return [...domainEvents, ...activityEvents]
    .sort((left, right) => right.sortTimestamp - left.sortTimestamp)
    .map((event) => ({
      id: event.id,
      eyebrow: event.eyebrow,
      headline: event.headline,
      body: event.body,
      roomLabel: event.roomLabel,
      timestampLabel: event.timestampLabel,
      tone: event.tone,
    }));
};

export const buildShowEmptyState = (
  gateway: GatewayOverview,
  stage: StageDefinition,
): ShowEmptyState => {
  if (!gateway.configured) {
    return {
      eyebrow: "待开播现场",
      title: "焦点房间已经亮起，但镜头还没接进来",
      body: `节目已经切到 ${stage.title}，但导播台还在等 gateway 点亮。连上后，第一位参与者会直接从这里冲进画面。`,
    };
  }

  if (gateway.authFailed) {
    return {
      eyebrow: "连线受阻",
      title: "现场凭证还没对上",
      body: "现在不是没人说话，而是 live feed 没通过鉴权。修好 token 后，现场会立刻恢复心跳。",
    };
  }

  if (gateway.connectionState === "connecting" || gateway.connectionState === "authenticating") {
    return {
      eyebrow: "正在连线",
      title: "导播台正在把整场 live feed 接进前台",
      body: "焦点房间已经亮了，只差把实时房间和台词信号真正推到观众眼前。",
    };
  }

  if (gateway.connectionState === "reconnecting") {
    return {
      eyebrow: "临时掉线",
      title: "节目没停，只是镜头短暂黑了一下",
      body: "系统正在重连，台前的故事会在连接恢复后继续滚动。",
    };
  }

  if (gateway.connectionState === "disconnected") {
    return {
      eyebrow: "信号中断",
      title: "前台暂时收不到后台回声",
      body: "检查本地 gateway 是否在线，或让导播台重新拉起连接。",
    };
  }

  return {
    eyebrow: "参与者即将入场",
    title: "第一句能上预告片的话还没落地",
    body: `当前幕是 ${stage.title}。房间已经开好，只差第一位参与者说出那句会被观众记住的话。`,
  };
};

export interface ShowTeamRoomSpotlight {
  id: string;
  teamId: string;
  teamLabel: string;
  roomId: string | null;
  roomLabel: string | null;
  memberIds: string[];
  headline: string;
  detail: string;
  tone: UiTone;
}

export interface ShowRoomNarrative {
  roomId: string;
  roomLabel: string;
  headline: string;
  detail: string;
  tone: UiTone;
  isFocusRoom: boolean;
}

export interface ShowSubmissionNarrative {
  headline: string;
  detail: string;
  progressLabel: string;
  tone: UiTone;
}

export interface ShowScoreNarrative {
  headline: string;
  detail: string;
  tone: UiTone;
  leaderLabel: string | null;
}

export interface ShowPlatformCueNarrative {
  headline: string;
  detail: string;
  timestampLabel: string | null;
  tone: UiTone;
}

export interface ShowBackstageNarrative {
  headline: string;
  detail: string;
  docBadges: string[];
  tone: UiTone;
}

export interface ShowSoftFallbackNarrative {
  title: string;
  body: string;
}

export interface ShowPrimarySpotlight {
  title: string;
  eyebrow: string;
  body: string;
  line: string;
  tone: UiTone;
  source:
    | "speaker"
    | "team"
    | "room"
    | "submission"
    | "score"
    | "award"
    | "co-creation"
    | "fallback";
}

export interface ShowAudienceComposition {
  authorityStageId: string | null;
  stageHeadline: string;
  primarySpotlight: ShowPrimarySpotlight;
  teamRoomSpotlights: ShowTeamRoomSpotlight[];
  roomNarratives: ShowRoomNarrative[];
  submission: ShowSubmissionNarrative;
  score: ShowScoreNarrative;
  platformCue: ShowPlatformCueNarrative;
  backstage: ShowBackstageNarrative;
  softFallbacks: ShowSoftFallbackNarrative[];
}

const pickSpotlightTone = (
  placementStatus: "aligned" | "mixed" | "unassigned",
): UiTone =>
  placementStatus === "aligned"
    ? "warm"
    : placementStatus === "mixed"
      ? "active"
      : "idle";

const buildTeamRoomSpotlights = (
  gateway: GatewayOverview,
  runtimeGuide: StageRuntimeGuide,
): ShowTeamRoomSpotlight[] => {
  if (!gateway.world.available || gateway.world.teams.length === 0) {
    return [];
  }

  const focusRoomIds = new Set(runtimeGuide.preferredRoomIds);
  const scoredTeams = gateway.world.teams
    .map((team) => {
      const memberSignalScore = team.members.reduce((score, member) => {
        if (member.liveState === "raised-hand") {
          return score + 3;
        }
        if (member.liveState === "speaking") {
          return score + 2;
        }
        if (member.liveState === "listening") {
          return score + 1;
        }
        return score;
      }, 0);
      const focusScore = team.roomId && focusRoomIds.has(team.roomId) ? 4 : 0;
      const placementScore =
        team.placementStatus === "aligned"
          ? 3
          : team.placementStatus === "mixed"
            ? 2
            : 0;

      return {
        team,
        score: memberSignalScore + focusScore + placementScore + team.memberCount,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  return scoredTeams.map(({ team }) => {
    const memberIds = team.members.map((member) => member.entityId);
    const roomCopy = team.roomLabel ?? team.roomId ?? "未标注房间";
    const memberRoomCopy =
      [...new Set(
        team.members
          .map((member) => member.roomLabel ?? member.roomId ?? "未标注房间")
          .filter((label) => label.trim().length > 0),
      )].join(" / ") || "别处";
    const headline =
      team.placementStatus === "aligned"
        ? `${team.label} 已在 ${roomCopy} 落位`
        : team.placementStatus === "mixed"
          ? `${team.label} 在 ${roomCopy} 与现场走位出现分叉`
          : `${team.label} 仍在等待稳定机位`;

    const detail =
      team.placementStatus === "aligned"
        ? `${memberIds.length} 位成员和队伍分房卡此刻是对齐的，观众看到的是这支队伍完整落位后的现场。`
        : team.placementStatus === "mixed"
          ? `官方分房卡把 ${team.label} 写在 ${roomCopy}，但镜头里的成员此刻分散在 ${memberRoomCopy}。节目会忠实保留这份错位感，而不是在前台把它偷偷抹平。`
          : `${team.label} 还没拿到稳定分房卡，镜头先按目前能确认的成员落点继续推进，等下一次状态更新把人和房间重新对上。`;

    return {
      id: `${team.teamId}:${team.roomId ?? "unassigned"}`,
      teamId: team.teamId,
      teamLabel: team.label,
      roomId: team.roomId,
      roomLabel: team.roomLabel,
      memberIds,
      headline,
      detail,
      tone: pickSpotlightTone(team.placementStatus),
    };
  });
};

const buildRoomNarratives = (
  gateway: GatewayOverview,
  runtimeGuide: StageRuntimeGuide,
): ShowRoomNarrative[] => {
  const heat = buildRoomHeatSummaries(gateway, runtimeGuide);
  const roomById = new Map(gateway.world.rooms.map((room) => [room.roomId, room]));

  return heat.slice(0, 4).map((room) => {
    const worldRoom = roomById.get(room.roomId);
    const worldDetail = worldRoom
      ? `${worldRoom.teamCount} 支队伍映射到这里，${worldRoom.occupantCount} 位实体当前在场。`
      : `${room.count} 个 live session 正在这个房间里冒头。`;
    const headline = room.latestAuthorityHeadline
      ? room.isFocusRoom
        ? `${room.label} 刚被本幕权威事件点亮`
        : `${room.label} 收到新的权威房间信号`
      : room.isFocusRoom
        ? `${room.label} 是本幕主镜头房间`
        : `${room.label} 正在等待下一条权威 cue`;

    return {
      roomId: room.roomId,
      roomLabel: room.label,
      headline,
      detail: `${worldDetail} ${room.story}`,
      tone: room.heatTone,
      isFocusRoom: room.isFocusRoom,
    };
  });
};

const buildSubmissionNarrative = (
  gateway: GatewayOverview,
  stage: StageDefinition,
): ShowSubmissionNarrative => {
  const isSubmissionStage = stage.presentation.deskMode === "submission";
  const progressLabel = `${gateway.lockedSubmissionCount}/${gateway.totalSubmissionCount}`;
  const current = gateway.currentSubmission;

  if (!current && gateway.totalSubmissionCount === 0) {
    return {
      headline: isSubmissionStage ? "作品提交通道待开启" : "本幕提交不是主线镜头",
      detail: isSubmissionStage
        ? "观众先看到的是队伍打磨过程，提交通道一旦开启会在这里转成明确进度。"
        : "当前幕更关注现场叙事，提交进度会在需要时自然浮出水面。",
      progressLabel,
      tone: isSubmissionStage ? "active" : "idle",
    };
  }

  if (!current) {
    return {
      headline: "提交进度正在同步",
      detail: `已经看到 ${gateway.totalSubmissionCount} 份 submission 轨迹，镜头会优先等待最新版本落地。`,
      progressLabel,
      tone: "warm",
    };
  }

  return {
    headline: current.locked
      ? `${current.id} 已锁稿`
      : `${current.id} 还在更新窗口`,
    detail: current.locked
      ? `当前版本 v${current.version ?? 1} 已进入锁定态，接下来更适合切到点评和评分镜头。`
      : `当前版本 v${current.version ?? 1}，最近更新于 ${current.updatedLabel ?? "刚刚"}。观众侧会继续跟随它的成稿过程。`,
    progressLabel,
    tone: current.locked ? "critical" : "active",
  };
};

const buildScoreNarrative = (
  gateway: GatewayOverview,
  stage: StageDefinition,
): ShowScoreNarrative => {
  const isJudgingStage = stage.presentation.deskMode === "score";
  const leader = gateway.scoreSummary[0] ?? null;

  if (!leader) {
    return {
      headline: isJudgingStage ? "评审席正在写分" : "评分榜暂未点亮",
      detail: isJudgingStage
        ? "分数会在评委提交后立刻汇入榜单，观众不用切后台就能看到走势。"
        : "当前幕重点不在评分，榜单会在评审阶段自动顶到前台。",
      tone: isJudgingStage ? "active" : "idle",
      leaderLabel: null,
    };
  }

  const leaderLabel = leader.teamId ?? leader.submissionId ?? leader.targetId;
  return {
    headline: `${leaderLabel} 暂时领跑`,
    detail: `平均分 ${leader.averageLabel}，共 ${leader.judgeCount} 位评委已提交。官方评分板一刷新，观众这边就会立刻跟上。`,
    tone: "critical",
    leaderLabel,
  };
};

const buildPlatformCueNarrative = (
  gateway: GatewayOverview,
  stage: StageDefinition,
): ShowPlatformCueNarrative => {
  const latestCue = gateway.domainEvents[0] ?? null;
  if (!latestCue) {
    return {
      headline: "平台正在准备下一条节目提示",
      detail: `当前幕是 ${stage.title}。只要 stage / timer / submission / score 有新动静，这里会先出 cue。`,
      timestampLabel: null,
      tone: "idle",
    };
  }

  return {
    headline: latestCue.title,
    detail: latestCue.detail,
    timestampLabel: latestCue.timestampLabel,
    tone: latestCue.tone,
  };
};

const buildBackstageNarrative = (
  gateway: GatewayOverview,
  stage: StageDefinition,
): ShowBackstageNarrative => {
  if (!gateway.skills.available) {
    return {
      headline: "幕后说明正在同步",
      detail: "节目仍可继续观看；文档绑定一旦到位，会在这里提示本幕引用的上下文。",
      docBadges: [],
      tone: "idle",
    };
  }

  const activeBindings = gateway.skills.currentStageBindings.length > 0
    ? gateway.skills.currentStageBindings
    : gateway.skills.globalBindings;
  const docBadges = activeBindings
    .slice(0, 3)
    .map((binding) => `${binding.docId}@${binding.version}`);

  if (activeBindings.length === 0) {
    return {
      headline: `${stage.title} 暂无额外文档线索`,
      detail: "本幕先按现场行为推进，后台上下文会在有新的 skill binding 时补齐。",
      docBadges: [],
      tone: "idle",
    };
  }

  const sourceCopy = gateway.skills.currentStageBindings.length > 0
    ? "本幕 backstage context"
    : "全局 backstage context";

  return {
    headline: `${sourceCopy} 已就位`,
    detail: gateway.skills.currentStageBindings.length > 0
      ? "这一幕已经发了单独的后台说明卡，观众现在看到的是这些说明最终落在舞台上的结果。"
      : `${stage.title} 这一幕暂时沿用全局说明，后台还没有额外发 stage-specific 台本卡。`,
    docBadges,
    tone: gateway.skills.currentStageBindings.length > 0 ? "warm" : "active",
  };
};

const buildSoftFallbacks = (
  gateway: GatewayOverview,
  stage: StageDefinition,
): ShowSoftFallbackNarrative[] => {
  const fallbacks: ShowSoftFallbackNarrative[] = [];

  if (!gateway.world.available) {
    fallbacks.push({
      title: "队伍镜头仍在拼接",
      body: gateway.world.teams.length > 0
        ? "官方分房卡还在补全，前台先跟着已经在场的队伍和房间动静继续往下讲。"
        : `当前幕是 ${stage.title}。正式队伍与房间映射一旦到位，镜头会自然切成更完整的节目叙事。`,
    });
  }

  if (!gateway.skills.available) {
    fallbacks.push({
      title: "幕后上下文暂未到场",
      body: "节目仍在推进，文档绑定恢复后会补上 backstage 提示。",
    });
  }

  if (gateway.connectionState !== "connected" && gateway.totalActiveSessions === 0) {
    fallbacks.push({
      title: "前台正在等现场心跳",
      body: "直播画面暂时偏静态，但不会切成后台报错口吻；连接恢复后节奏会继续滚动。",
    });
  }

  return fallbacks;
};

const buildFallbackPrimarySpotlight = ({
  primaryTeamSpotlight,
  primaryRoomNarrative,
  primaryFallback,
  emptyState,
}: {
  primaryTeamSpotlight: ShowTeamRoomSpotlight | null;
  primaryRoomNarrative: ShowRoomNarrative | null;
  primaryFallback: ShowSoftFallbackNarrative | null;
  emptyState: ShowEmptyState;
}): ShowPrimarySpotlight => ({
  title:
    primaryTeamSpotlight?.teamLabel ??
    primaryRoomNarrative?.roomLabel ??
    primaryFallback?.title ??
    emptyState.title,
  eyebrow:
    primaryTeamSpotlight?.headline ??
    primaryRoomNarrative?.headline ??
    primaryFallback?.title ??
    emptyState.eyebrow,
  body:
    primaryTeamSpotlight?.detail ??
    primaryRoomNarrative?.detail ??
    primaryFallback?.body ??
    emptyState.body,
  line:
    primaryTeamSpotlight?.headline ??
    primaryRoomNarrative?.headline ??
    primaryFallback?.body ??
    emptyState.body,
  tone: primaryTeamSpotlight?.tone ?? primaryRoomNarrative?.tone ?? "idle",
  source: "fallback",
});

const pickSubmissionLeadLine = (
  data: Record<string, unknown> | null | undefined,
): string | null => {
  if (!data) {
    return null;
  }

  const poem =
    typeof data.poem === "string" && data.poem.trim().length > 0
      ? data.poem.trim()
      : null;
  if (poem) {
    return poem;
  }

  const elevatorPitch =
    typeof data.elevatorPitch === "string" && data.elevatorPitch.trim().length > 0
      ? data.elevatorPitch.trim()
      : null;
  if (elevatorPitch) {
    return elevatorPitch;
  }

  const highlights = Array.isArray(data.highlights)
    ? data.highlights.find(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      ) ?? null
    : null;
  if (highlights) {
    return highlights.trim();
  }

  const risk =
    typeof data.risk === "string" && data.risk.trim().length > 0
      ? data.risk.trim()
      : null;
  if (risk) {
    return risk;
  }

  const posterOrDeck =
    typeof data.posterOrDeck === "string" && data.posterOrDeck.trim().length > 0
      ? data.posterOrDeck.trim()
      : null;

  return posterOrDeck;
};

const summarizeScoreAnnotations = (
  annotations: Record<string, string> | undefined,
): string | null => {
  if (!annotations) {
    return null;
  }

  const favorite = annotations.favorite?.trim();
  const mostAbsurd = annotations.mostAbsurd?.trim();
  const pieces = [
    favorite ? `favorite: ${favorite}` : null,
    mostAbsurd ? `mostAbsurd: ${mostAbsurd}` : null,
  ].filter((value): value is string => Boolean(value));

  return pieces.length > 0 ? pieces.join(" · ") : null;
};

const buildPrimarySpeakerSpotlight = ({
  contestant,
  stage,
  runtimeGuide,
  primaryTeamSpotlight,
  primaryFallback,
  emptyState,
  gateway,
}: {
  contestant: RankedContestant | null;
  stage: StageDefinition;
  runtimeGuide: StageRuntimeGuide;
  primaryTeamSpotlight: ShowTeamRoomSpotlight | null;
  primaryFallback: ShowSoftFallbackNarrative | null;
  emptyState: ShowEmptyState;
  gateway: GatewayOverview;
}): ShowPrimarySpotlight => {
  if (!contestant) {
    return buildFallbackPrimarySpotlight({
      primaryTeamSpotlight,
      primaryRoomNarrative: null,
      primaryFallback,
      emptyState,
    });
  }

  const showState = buildShowStateCopy(contestant, stage, runtimeGuide);

  return {
    title: contestant.agentId,
    eyebrow: `${showState.label} · ${showState.action}`,
    body: [showState.note, primaryTeamSpotlight?.detail]
      .filter((value): value is string => Boolean(value))
      .join(" "),
    line:
      contestant.recentActivity?.content ??
      gateway.domainEvents[0]?.detail ??
      primaryTeamSpotlight?.headline ??
      primaryFallback?.body ??
      emptyState.body,
    tone: showState.tone,
    source: "speaker",
  };
};

const buildPrimaryTeamSpotlight = ({
  primaryTeamSpotlight,
  primaryRoomNarrative,
  primaryFallback,
  emptyState,
}: {
  primaryTeamSpotlight: ShowTeamRoomSpotlight | null;
  primaryRoomNarrative: ShowRoomNarrative | null;
  primaryFallback: ShowSoftFallbackNarrative | null;
  emptyState: ShowEmptyState;
}): ShowPrimarySpotlight => {
  if (!primaryTeamSpotlight) {
    return buildFallbackPrimarySpotlight({
      primaryTeamSpotlight,
      primaryRoomNarrative,
      primaryFallback,
      emptyState,
    });
  }

  return {
    title: primaryTeamSpotlight.teamLabel,
    eyebrow: `Team Reveal · ${primaryTeamSpotlight.headline}`,
    body: primaryTeamSpotlight.detail,
    line:
      primaryTeamSpotlight.memberIds.length > 0
        ? primaryTeamSpotlight.memberIds.join(" / ")
        : primaryTeamSpotlight.headline,
    tone: primaryTeamSpotlight.tone,
    source: "team",
  };
};

const buildPrimaryRoomSpotlight = ({
  primaryTeamSpotlight,
  primaryRoomNarrative,
  primaryFallback,
  emptyState,
}: {
  primaryTeamSpotlight: ShowTeamRoomSpotlight | null;
  primaryRoomNarrative: ShowRoomNarrative | null;
  primaryFallback: ShowSoftFallbackNarrative | null;
  emptyState: ShowEmptyState;
}): ShowPrimarySpotlight => {
  if (!primaryRoomNarrative) {
    return buildFallbackPrimarySpotlight({
      primaryTeamSpotlight,
      primaryRoomNarrative,
      primaryFallback,
      emptyState,
    });
  }

  return {
    title: primaryRoomNarrative.roomLabel,
    eyebrow: `Room Spotlight · ${primaryRoomNarrative.headline}`,
    body: primaryRoomNarrative.detail,
    line: primaryRoomNarrative.headline,
    tone: primaryRoomNarrative.tone,
    source: "room",
  };
};

const buildPrimarySubmissionSpotlight = ({
  gateway,
  stage,
  submission,
  primaryTeamSpotlight,
  primaryRoomNarrative,
  primaryFallback,
  emptyState,
}: {
  gateway: GatewayOverview;
  stage: StageDefinition;
  submission: ShowSubmissionNarrative;
  primaryTeamSpotlight: ShowTeamRoomSpotlight | null;
  primaryRoomNarrative: ShowRoomNarrative | null;
  primaryFallback: ShowSoftFallbackNarrative | null;
  emptyState: ShowEmptyState;
}): ShowPrimarySpotlight => {
  const currentSubmission = gateway.currentSubmission;
  if (!currentSubmission) {
    return buildFallbackPrimarySpotlight({
      primaryTeamSpotlight,
      primaryRoomNarrative,
      primaryFallback,
      emptyState,
    });
  }

  const title =
    currentSubmission.teamId ?? currentSubmission.id;
  const leadLine =
    pickSubmissionLeadLine(currentSubmission.data) ??
    submission.headline;

  return {
    title,
    eyebrow: currentSubmission.locked
      ? `${stage.title} · locked submission`
      : `${stage.title} · submission in flight`,
    body: [submission.detail, primaryTeamSpotlight?.detail]
      .filter((value): value is string => Boolean(value))
      .join(" "),
    line: leadLine,
    tone: submission.tone,
    source: "submission",
  };
};

const buildPrimaryScoreSpotlight = ({
  gateway,
  stage,
  score,
  primaryTeamSpotlight,
  primaryRoomNarrative,
  primaryFallback,
  emptyState,
}: {
  gateway: GatewayOverview;
  stage: StageDefinition;
  score: ShowScoreNarrative;
  primaryTeamSpotlight: ShowTeamRoomSpotlight | null;
  primaryRoomNarrative: ShowRoomNarrative | null;
  primaryFallback: ShowSoftFallbackNarrative | null;
  emptyState: ShowEmptyState;
}): ShowPrimarySpotlight => {
  const latestScore = gateway.scores[0] ?? null;
  if (!latestScore) {
    return buildFallbackPrimarySpotlight({
      primaryTeamSpotlight,
      primaryRoomNarrative,
      primaryFallback,
      emptyState,
    });
  }

  const annotationLine = summarizeScoreAnnotations(latestScore.annotations);

  return {
    title:
      latestScore.submissionId ??
      latestScore.teamId ??
      latestScore.targetId,
    eyebrow: `${stage.title} · ${latestScore.judgeId ?? "judge"} ${latestScore.score}/10`,
    body: [latestScore.reason, annotationLine, score.detail]
      .filter((value): value is string => Boolean(value))
      .join(" "),
    line:
      annotationLine ??
      `${latestScore.score}/10 · ${latestScore.reason}`,
    tone: "critical",
    source: "score",
  };
};

const buildPrimaryAwardSpotlight = ({
  gateway,
  primaryTeamSpotlight,
  primaryRoomNarrative,
  primaryFallback,
  emptyState,
}: {
  gateway: GatewayOverview;
  primaryTeamSpotlight: ShowTeamRoomSpotlight | null;
  primaryRoomNarrative: ShowRoomNarrative | null;
  primaryFallback: ShowSoftFallbackNarrative | null;
  emptyState: ShowEmptyState;
}): ShowPrimarySpotlight => {
  const latestAward = gateway.awards[0] ?? null;
  if (!latestAward) {
    return buildFallbackPrimarySpotlight({
      primaryTeamSpotlight,
      primaryRoomNarrative,
      primaryFallback,
      emptyState,
    });
  }

  return {
    title: latestAward.label,
    eyebrow: `Award Reveal · ${latestAward.entityId}`,
    body: latestAward.reason
      ? `${latestAward.entityId} 刚刚被正式写入权威 award projection。理由：${latestAward.reason}`
      : `${latestAward.entityId} 刚刚被正式写入权威 award projection。`,
    line: latestAward.reason ?? latestAward.label,
    tone: "critical",
    source: "award",
  };
};

const buildPrimaryCoCreationSpotlight = ({
  gateway,
  stage,
  submission,
  primaryTeamSpotlight,
  primaryRoomNarrative,
  primaryFallback,
  emptyState,
}: {
  gateway: GatewayOverview;
  stage: StageDefinition;
  submission: ShowSubmissionNarrative;
  primaryTeamSpotlight: ShowTeamRoomSpotlight | null;
  primaryRoomNarrative: ShowRoomNarrative | null;
  primaryFallback: ShowSoftFallbackNarrative | null;
  emptyState: ShowEmptyState;
}): ShowPrimarySpotlight => {
  const currentSubmission = gateway.currentSubmission;
  const latestAuthorityCue = gateway.domainEvents[0] ?? null;
  const leadLine =
    pickSubmissionLeadLine(currentSubmission?.data) ??
    latestAuthorityCue?.detail ??
    submission.headline;

  if (!currentSubmission && !latestAuthorityCue) {
    return buildFallbackPrimarySpotlight({
      primaryTeamSpotlight,
      primaryRoomNarrative,
      primaryFallback,
      emptyState,
    });
  }

  return {
    title:
      currentSubmission?.teamId ??
      currentSubmission?.id ??
      latestAuthorityCue?.entityId ??
      stage.title,
    eyebrow: `${stage.title} · poem / canvas orbit`,
    body: [submission.detail, primaryRoomNarrative?.detail]
      .filter((value): value is string => Boolean(value))
      .join(" "),
    line: leadLine,
    tone: currentSubmission?.locked ? "critical" : "warm",
    source: "co-creation",
  };
};

const buildPrimarySpotlight = ({
  gateway,
  stage,
  runtimeGuide,
  contestants,
  primaryTeamSpotlight,
  primaryRoomNarrative,
  submission,
  score,
  softFallbacks,
  emptyState,
}: {
  gateway: GatewayOverview;
  stage: StageDefinition;
  runtimeGuide: StageRuntimeGuide;
  contestants: RankedContestant[];
  primaryTeamSpotlight: ShowTeamRoomSpotlight | null;
  primaryRoomNarrative: ShowRoomNarrative | null;
  submission: ShowSubmissionNarrative;
  score: ShowScoreNarrative;
  softFallbacks: ShowSoftFallbackNarrative[];
  emptyState: ShowEmptyState;
}): ShowPrimarySpotlight => {
  const primaryFallback = softFallbacks[0] ?? null;
  const focusContestant = contestants[0] ?? null;

  switch (runtimeGuide.scene.spotlightSource) {
    case "speaker":
      return buildPrimarySpeakerSpotlight({
        contestant: focusContestant,
        stage,
        runtimeGuide,
        primaryTeamSpotlight,
        primaryFallback,
        emptyState,
        gateway,
      });
    case "team":
      return buildPrimaryTeamSpotlight({
        primaryTeamSpotlight,
        primaryRoomNarrative,
        primaryFallback,
        emptyState,
      });
    case "room":
      return buildPrimaryRoomSpotlight({
        primaryTeamSpotlight,
        primaryRoomNarrative,
        primaryFallback,
        emptyState,
      });
    case "submission":
      return buildPrimarySubmissionSpotlight({
        gateway,
        stage,
        submission,
        primaryTeamSpotlight,
        primaryRoomNarrative,
        primaryFallback,
        emptyState,
      });
    case "score":
      return buildPrimaryScoreSpotlight({
        gateway,
        stage,
        score,
        primaryTeamSpotlight,
        primaryRoomNarrative,
        primaryFallback,
        emptyState,
      });
    case "award":
      return buildPrimaryAwardSpotlight({
        gateway,
        primaryTeamSpotlight,
        primaryRoomNarrative,
        primaryFallback,
        emptyState,
      });
    case "co-creation":
      return buildPrimaryCoCreationSpotlight({
        gateway,
        stage,
        submission,
        primaryTeamSpotlight,
        primaryRoomNarrative,
        primaryFallback,
        emptyState,
      });
    default:
      return buildFallbackPrimarySpotlight({
        primaryTeamSpotlight,
        primaryRoomNarrative,
        primaryFallback,
        emptyState,
      });
  }
};

export const buildShowAudienceComposition = ({
  gateway,
  stage,
  runtimeGuide,
  contestants,
}: {
  gateway: GatewayOverview;
  stage: StageDefinition;
  runtimeGuide: StageRuntimeGuide;
  contestants: RankedContestant[];
}): ShowAudienceComposition => {
  const authorityStageId = gateway.authorityStageId ?? gateway.activityRun?.currentStageId ?? null;
  const teamRoomSpotlights = buildTeamRoomSpotlights(gateway, runtimeGuide);
  const roomNarratives = buildRoomNarratives(gateway, runtimeGuide);
  const submission = buildSubmissionNarrative(gateway, stage);
  const score = buildScoreNarrative(gateway, stage);
  const platformCue = buildPlatformCueNarrative(gateway, stage);
  const backstage = buildBackstageNarrative(gateway, stage);
  const softFallbacks = buildSoftFallbacks(gateway, stage);
  const emptyState = buildShowEmptyState(gateway, stage);
  const primarySpotlight = buildPrimarySpotlight({
    gateway,
    stage,
    runtimeGuide,
    contestants,
    primaryTeamSpotlight: teamRoomSpotlights[0] ?? null,
    primaryRoomNarrative: roomNarratives[0] ?? null,
    submission,
    score,
    softFallbacks,
    emptyState,
  });

  return {
    authorityStageId,
    stageHeadline: authorityStageId
      ? `节目当前由 ${authorityStageId} 驱动镜头编排，scene preset = ${runtimeGuide.scene.layoutPreset ?? "default"}`
      : `节目当前使用 ${stage.id} 的本地预演镜头，scene preset = ${runtimeGuide.scene.layoutPreset ?? "default"}`,
    primarySpotlight,
    teamRoomSpotlights,
    roomNarratives,
    submission,
    score,
    platformCue,
    backstage,
    softFallbacks,
  };
};
