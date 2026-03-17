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
  activityCount: number;
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

const buildStageFit = (
  contestant: GatewayContestantSummary,
  focusRoomIds: Set<string>,
): Pick<RankedContestant, "isInFocusRoom" | "stageFitLabel" | "stageFitTone"> => {
  if (focusRoomIds.has(contestant.roomId)) {
    return {
      isInFocusRoom: true,
      stageFitLabel: "On Script",
      stageFitTone: "warm",
    };
  }

  if (contestant.roomId === "quiet-orbit") {
    return {
      isInFocusRoom: false,
      stageFitLabel: "Holding",
      stageFitTone: "idle",
    };
  }

  return {
    isInFocusRoom: false,
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
      attentionNote: "选手已经在当前 act 的焦点房间里举手，适合优先给麦或点名回应。",
      attentionTone: "active",
    };
  }

  if (contestant.state === "raised-hand") {
    return {
      attentionLabel: `Pull To ${primaryFocusRoomLabel ?? "Focus Room"}`,
      attentionNote: "选手正在请求注意力，但人还不在当前 act 的焦点房间里，适合被拉回现场。",
      attentionTone: "active",
    };
  }

  if (contestant.state === "speaking" && isInFocusRoom) {
    return {
      attentionLabel: "Keep Live",
      attentionNote: "选手已经在正确的房间里发声，适合继续保留镜头或顺手截取高光。",
      attentionTone: "critical",
    };
  }

  if (contestant.state === "speaking") {
    return {
      attentionLabel: "Monitor Side Signal",
      attentionNote: "选手正在侧房间输出内容，可能值得巡房，也可能需要被拉回主舞台。",
      attentionTone: "warm",
    };
  }

  if (contestant.state === "muted" && isInFocusRoom) {
    return {
      attentionLabel: "Ping Heartbeat",
      attentionNote: "选手已经在焦点房间落位，但长时间没反应，适合发 heartbeat 或轻推一把。",
      attentionTone: "idle",
    };
  }

  if (isInFocusRoom) {
    return {
      attentionLabel: "Watch Reactions",
      attentionNote: "选手在正确房间里保持倾听状态，暂时不必介入，但值得继续观察。",
      attentionTone: "warm",
    };
  }

  return {
    attentionLabel: "Let Team Cook",
    attentionNote: "选手目前不在焦点房间，且没有强烈信号，适合暂时放在侧线继续推进。",
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
      const stageFit = buildStageFit(contestant, focusRoomIds);
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
): ShowStateCopy => {
  if (!contestant) {
    return {
      label: "待开机位",
      action: "主舞台还在等第一只龙虾冲进画面",
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

  if (contestant.roomId === "quiet-orbit") {
    return {
      label: "退到后景冷静",
      action: "在 Quiet Orbit 整理情绪",
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

export const buildRoomHeatSummaries = (
  gateway: GatewayOverview,
  runtimeGuide: StageRuntimeGuide,
): RoomHeatSummary[] => {
  const focusRoomIds = new Set(runtimeGuide.preferredRoomIds);
  const activityCountByRoom = gateway.activities.reduce<Record<string, number>>((acc, activity) => {
    acc[activity.roomId] = (acc[activity.roomId] ?? 0) + 1;
    return acc;
  }, {});

  return gateway.roomRosters
    .map((room) => {
      const activityCount = activityCountByRoom[room.roomId] ?? 0;
      const stateScore = room.sessions.reduce((sum, session) => sum + heatWeight[session.state], 0);
      const heatScore =
        room.sessions.length * 10 +
        activityCount * 14 +
        stateScore +
        (focusRoomIds.has(room.roomId) ? 6 : 0);

      let heatLabel: string;
      let heatTone: UiTone;
      if (heatScore >= 70) {
        heatLabel = "炸场中";
        heatTone = "critical";
      } else if (heatScore >= 42) {
        heatLabel = "火苗越烧越高";
        heatTone = "active";
      } else if (heatScore >= 18) {
        heatLabel = "开始有戏";
        heatTone = "warm";
      } else {
        heatLabel = room.roomId === "quiet-orbit" ? "幕后缓冲" : "低火蓄势";
        heatTone = "idle";
      }

      let story = "镜头还没扫到这里，但不代表这里没在酝酿。";
      if (activityCount > 0 && focusRoomIds.has(room.roomId)) {
        story = "本幕主镜头正盯着这里，下一句高光随时可能直接冲上大屏。";
      } else if (activityCount > 0) {
        story = `刚刚有 ${activityCount} 条新剧情从这里冒出来，像是在后台偷跑正片。`;
      } else if (room.sessions.length > 0) {
        story = `${room.sessions.length} 位选手在这里压着气氛，离真正炸开只差一根火柴。`;
      } else if (room.roomId === "quiet-orbit") {
        story = "情绪、停顿和下一轮反扑都先在这里喘一口气。";
      }

      return {
        roomId: room.roomId,
        label: room.label,
        count: room.sessions.length,
        activityCount,
        heatScore,
        heatLabel,
        heatTone,
        story,
        headliners: room.sessions.slice(0, 3).map((session) => session.agentId),
        isFocusRoom: focusRoomIds.has(room.roomId),
      };
    })
    .sort((left, right) => {
      if (left.heatScore !== right.heatScore) {
        return right.heatScore - left.heatScore;
      }
      return right.count - left.count;
    });
};

export const buildShowEvents = (
  gateway: GatewayOverview,
  contestants: RankedContestant[],
): ShowEventSummary[] => {
  const contestantById = new Map(contestants.map((contestant) => [contestant.agentId, contestant]));
  const activityEvents = gateway.activities.map((activity) => {
    const contestant = contestantById.get(activity.agentId);

    let headline = `${activity.agentId} 刚往 ${activity.roomLabel} 扔进一句能剪预告的台词`;
    if (contestant?.state === "raised-hand") {
      headline = `${activity.agentId} 正在抢麦，想把现场再往前拱一步`;
    } else if (activity.roomId === "main-stage") {
      headline = `${activity.agentId} 又把主舞台顶亮了一格`;
    } else if (activity.roomId.startsWith("team-room")) {
      headline = `${activity.agentId} 在 ${activity.roomLabel} 憋出一段新的队内剧情`;
    } else if (activity.roomId === "quiet-orbit") {
      headline = `${activity.agentId} 在 Quiet Orbit 低声回血，像在准备下一波反扑`;
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
      title: "主舞台灯亮了，但镜头还没接进来",
      body: `节目已经切到 ${stage.title}，但导播台还在等 gateway 点亮。连上后，第一位 contestant 会直接从这里冲进画面。`,
    };
  }

  if (gateway.authFailed) {
    return {
      eyebrow: "连线受阻",
      title: "节目组拿错了入场证",
      body: "现在不是没人说话，而是主舞台没通过鉴权。修好 token 后，现场会立刻恢复心跳。",
    };
  }

  if (gateway.connectionState === "connecting" || gateway.connectionState === "authenticating") {
    return {
      eyebrow: "正在连线",
      title: "导播台正在把整座秀场接进前台",
      body: "主舞台灯已经亮了，只差把实时房间和台词信号真正推到观众眼前。",
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
      title: "主舞台暂时收不到后台回声",
      body: "检查本地 gateway 是否在线，或让导播台重新拉起连接。",
    };
  }

  return {
    eyebrow: "选手即将入场",
    title: "第一句能上预告片的话还没落地",
    body: `当前幕是 ${stage.title}。房间已经开好，只差第一只 contestant 说出那句会被观众记住的话。`,
  };
};
