import type { ConversationState, DeriveConversationStateInput } from "./types";

const isPresent = (value: string | undefined | null): value is string => Boolean(value);

const firstId = (...values: Array<string | undefined | null>) =>
  values.find((value): value is string => Boolean(value)) ?? null;

export const deriveConversationState = ({
  activeStageId,
  activeStageTitle,
  orderedContestantIds,
  focusIds,
  championIds,
  leadingContestantId,
  defaultSpeakerId,
  selectedContestantId,
  focusTeamName,
  focusHeadline,
  nearbyHint,
  contestantNameById,
  priorityContestantId,
}: DeriveConversationStateInput): ConversationState => {
  const outsideFocusIds = orderedContestantIds.filter((id) => !focusIds.includes(id));
  const activeChampionIds = championIds.length > 0 ? championIds : focusIds;
  const leadingId = firstId(leadingContestantId, orderedContestantIds[0], defaultSpeakerId);

  const baseConversation = (() => {
    switch (activeStageId) {
    case "act-1": {
      const firstSpeakerId = firstId(orderedContestantIds[0], defaultSpeakerId);

      return {
        speakerId: firstSpeakerId,
        raisedHandId: firstId(orderedContestantIds[1], defaultSpeakerId),
        listeningIds: orderedContestantIds.slice(0, 3),
        queuedIds: orderedContestantIds.slice(3, 5),
        callout: `${activeStageTitle} 正在建人设，${contestantNameById[firstSpeakerId ?? ""] ?? "当前选手"} 先把主麦拿走了。`,
      };
    }
    case "act-2":
      return {
        speakerId: firstId(selectedContestantId, defaultSpeakerId),
        raisedHandId: firstId(outsideFocusIds[0], orderedContestantIds[1], defaultSpeakerId),
        listeningIds: [...focusIds, orderedContestantIds[2]].filter(isPresent).slice(0, 3),
        queuedIds: outsideFocusIds.slice(0, 2),
        callout: `${activeStageTitle} 把偏好和嫌弃都摊开了，房间里开始有人抢着举手回应。`,
      };
    case "act-3":
      return {
        speakerId: firstId(focusIds[0], defaultSpeakerId),
        raisedHandId: firstId(focusIds[1], outsideFocusIds[0], defaultSpeakerId),
        listeningIds: focusIds,
        queuedIds: outsideFocusIds.slice(0, 1),
        callout: `${focusTeamName} 正在被推到 conversation ring 中央，其他选手在外圈等候下一轮分组。`,
      };
    case "act-4":
      return {
        speakerId: firstId(focusIds[1], focusIds[0], defaultSpeakerId),
        raisedHandId: firstId(focusIds[0], outsideFocusIds[0], defaultSpeakerId),
        listeningIds: focusIds,
        queuedIds: outsideFocusIds.slice(0, 2),
        callout: `${focusTeamName} 的队内讨论已经热起来了，主麦在成员之间快速切换。`,
      };
    case "act-5":
      return {
        speakerId: firstId(focusIds[0], defaultSpeakerId),
        raisedHandId: firstId(focusIds[1], outsideFocusIds[0], defaultSpeakerId),
        listeningIds: focusIds,
        queuedIds: focusIds.slice(2, 3),
        callout: `${focusHeadline} 正在收束成可展示版本，队伍成员轮流补充最终卖点。`,
      };
    case "act-6": {
      const focusSpeakerId = firstId(focusIds[0], defaultSpeakerId);

      return {
        speakerId: focusSpeakerId,
        raisedHandId: leadingId,
        listeningIds: focusIds,
        queuedIds: outsideFocusIds.slice(0, 1),
        callout: `人类评审正在外圈围观，${contestantNameById[focusSpeakerId ?? ""] ?? "队长"} 继续守着主麦解释方案。`,
      };
    }
    case "act-7":
      return {
        speakerId: firstId(focusIds[0], defaultSpeakerId),
        raisedHandId: firstId(activeChampionIds[1], leadingId),
        listeningIds: [...new Set([...focusIds, ...activeChampionIds])].filter(isPresent).slice(0, 4),
        queuedIds: outsideFocusIds.slice(0, 1),
        callout: "AI 评审接管节奏，冠军候选队开始在房间中央反复被点名。",
      };
    case "act-8":
      return {
        speakerId: firstId(activeChampionIds[0], defaultSpeakerId),
        raisedHandId: firstId(activeChampionIds[1], focusIds[1], defaultSpeakerId),
        listeningIds: activeChampionIds,
        queuedIds: [leadingId].filter(isPresent).filter((id) => !activeChampionIds.includes(id)),
        callout: `${focusTeamName} 正站在聚光区，其他选手在外圈等着奖项和人格标签落地。`,
      };
    case "act-9":
      return {
        speakerId: leadingId,
        raisedHandId: firstId(orderedContestantIds[1], defaultSpeakerId),
        listeningIds: orderedContestantIds.slice(0, 4),
        queuedIds: orderedContestantIds.slice(4, 6),
        callout: "赛后诗和像素画接管了空间，房间不再争主麦，而是在轮流放大情绪。",
      };
    case "act-10":
      return {
        speakerId: firstId(outsideFocusIds[0], leadingId),
        raisedHandId: firstId(focusIds[0], defaultSpeakerId),
        listeningIds: [...focusIds, leadingId].filter(isPresent).slice(0, 4),
        queuedIds: outsideFocusIds.slice(1, 3),
        callout: "开放麦阶段让 conversation 重新散开，主麦开始在房间和看台之间游走。",
      };
    default:
      return {
        speakerId: defaultSpeakerId,
        raisedHandId: firstId(focusIds[1], leadingId),
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
        ...baseConversation.queuedIds.filter(isPresent).filter((id) => id !== priorityContestantId),
      ],
      callout: `${contestantNameById[priorityContestantId] ?? "选手"} 被 wave over 到当前 conversation，房间正在为她/他留出切入点。`,
    };
  }

  return baseConversation;
};
