import type { ConversationState, DeriveConversationStateInput } from "./types";

const isPresent = (value: string | undefined | null): value is string => Boolean(value);

export const deriveConversationState = ({
  activeStage,
  contestants,
  focusTeam,
  teams,
  leadingTeam,
  championTeamId,
  leadingContestantId,
  selectedContestantId,
  priorityContestantId,
  fallbackContestantId,
  nearbyHint,
}: DeriveConversationStateInput): ConversationState => {
  const orderedIds = contestants.map((contestant) => contestant.id);
  const contestantMap = Object.fromEntries(contestants.map((contestant) => [contestant.id, contestant]));
  const focusIds = focusTeam.memberIds;
  const outsideFocusIds = orderedIds.filter((id) => !focusIds.includes(id));
  const championTeam = teams.find((team) => team.id === championTeamId) ?? leadingTeam;
  const championIds = championTeam.memberIds;
  const defaultSpeakerId = focusIds[0] ?? orderedIds[0] ?? fallbackContestantId;
  const leadingId = leadingContestantId || orderedIds[0] || fallbackContestantId;

  const baseConversation = (() => {
    switch (activeStage.id) {
    case "act-1":
      return {
        speakerId: orderedIds[0] ?? defaultSpeakerId,
        raisedHandId: orderedIds[1] ?? defaultSpeakerId,
        listeningIds: orderedIds.slice(0, 3),
        queuedIds: orderedIds.slice(3, 5),
        callout: `${activeStage.title} 正在建人设，${contestantMap[orderedIds[0] ?? defaultSpeakerId]?.name ?? "当前选手"} 先把主麦拿走了。`,
      };
    case "act-2":
      return {
        speakerId: selectedContestantId ?? defaultSpeakerId,
        raisedHandId: outsideFocusIds[0] ?? orderedIds[1] ?? defaultSpeakerId,
        listeningIds: [...focusIds, orderedIds[2]].filter(isPresent).slice(0, 3),
        queuedIds: outsideFocusIds.slice(0, 2),
        callout: `${activeStage.title} 把偏好和嫌弃都摊开了，房间里开始有人抢着举手回应。`,
      };
    case "act-3":
      return {
        speakerId: focusIds[0] ?? defaultSpeakerId,
        raisedHandId: focusIds[1] ?? outsideFocusIds[0] ?? defaultSpeakerId,
        listeningIds: focusIds,
        queuedIds: outsideFocusIds.slice(0, 1),
        callout: `${focusTeam.name} 正在被推到 conversation ring 中央，其他选手在外圈等候下一轮分组。`,
      };
    case "act-4":
      return {
        speakerId: focusIds[1] ?? focusIds[0] ?? defaultSpeakerId,
        raisedHandId: focusIds[0] ?? outsideFocusIds[0] ?? defaultSpeakerId,
        listeningIds: focusIds,
        queuedIds: outsideFocusIds.slice(0, 2),
        callout: `${focusTeam.name} 的队内讨论已经热起来了，主麦在成员之间快速切换。`,
      };
    case "act-5":
      return {
        speakerId: focusIds[0] ?? defaultSpeakerId,
        raisedHandId: focusIds[1] ?? outsideFocusIds[0] ?? defaultSpeakerId,
        listeningIds: focusIds,
        queuedIds: focusIds.slice(2, 3),
        callout: `${focusTeam.submissionHeadline} 正在收束成可展示版本，队伍成员轮流补充最终卖点。`,
      };
    case "act-6":
      return {
        speakerId: focusIds[0] ?? defaultSpeakerId,
        raisedHandId: leadingId,
        listeningIds: focusIds,
        queuedIds: outsideFocusIds.slice(0, 1),
        callout: `人类评审正在外圈围观，${contestantMap[focusIds[0] ?? defaultSpeakerId]?.name ?? "队长"} 继续守着主麦解释方案。`,
      };
    case "act-7":
      return {
        speakerId: focusIds[0] ?? defaultSpeakerId,
        raisedHandId: championIds[1] ?? leadingId,
        listeningIds: [...new Set([...focusIds, ...championIds])].slice(0, 4),
        queuedIds: outsideFocusIds.slice(0, 1),
        callout: "AI 评审接管节奏，冠军候选队开始在房间中央反复被点名。",
      };
    case "act-8":
      return {
        speakerId: championIds[0] ?? defaultSpeakerId,
        raisedHandId: championIds[1] ?? focusIds[1] ?? defaultSpeakerId,
        listeningIds: championIds,
        queuedIds: [leadingId].filter((id) => !championIds.includes(id)),
        callout: `${championTeam.name} 正站在聚光区，其他选手在外圈等着奖项和人格标签落地。`,
      };
    case "act-9":
      return {
        speakerId: leadingId,
        raisedHandId: orderedIds[1] ?? defaultSpeakerId,
        listeningIds: orderedIds.slice(0, 4),
        queuedIds: orderedIds.slice(4, 6),
        callout: "赛后诗和像素画接管了空间，房间不再争主麦，而是在轮流放大情绪。",
      };
    case "act-10":
      return {
        speakerId: outsideFocusIds[0] ?? leadingId,
        raisedHandId: focusIds[0] ?? defaultSpeakerId,
        listeningIds: [...focusIds, leadingId].filter(isPresent).slice(0, 4),
        queuedIds: outsideFocusIds.slice(1, 3),
        callout: "开放麦阶段让 conversation 重新散开，主麦开始在房间和看台之间游走。",
      };
    default:
      return {
        speakerId: defaultSpeakerId,
        raisedHandId: focusIds[1] ?? leadingId,
        listeningIds: focusIds,
        queuedIds: outsideFocusIds.slice(0, 1),
        callout: nearbyHint,
      };
    }
  })();

  if (priorityContestantId && priorityContestantId !== baseConversation.speakerId) {
    return {
      ...baseConversation,
      raisedHandId: priorityContestantId,
      queuedIds: [
        priorityContestantId,
        ...baseConversation.queuedIds.filter((id) => id !== priorityContestantId),
      ],
      callout: `${contestantMap[priorityContestantId]?.name ?? "选手"} 被 wave over 到当前 conversation，房间正在为她/他留出切入点。`,
    };
  }

  return baseConversation;
};
