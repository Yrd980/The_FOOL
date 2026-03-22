import {
  buildBetEnvelope,
  buildBroadcastEnvelope,
  buildReactionEnvelope,
  buildTalkEnvelope,
  buildVoteEnvelope,
} from "../../../src/openclaw/control";
import { dispatchOrPreview } from "../dispatch";
import {
  parseBetArgs,
  parseBroadcastArgs,
  parseReactionArgs,
  parseTalkArgs,
  parseVoteArgs,
} from "../parse";
import { resolveActorId, resolveActorRole } from "../support";

export const handleTalk = async (args: string[]): Promise<void> => {
  const talk = parseTalkArgs(args);
  await dispatchOrPreview({
    envelope: buildTalkEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: talk.activityRunId,
      message: talk.message,
      roomId: talk.roomId,
      targetEntityId: talk.targetEntityId,
      audienceScope: talk.audienceScope,
      idempotencyKey: `talk-${talk.activityRunId}-${Date.now()}`,
    }),
    summary: `talk ${talk.activityRunId} / ${talk.roomId ?? "auto-room"}`,
  });
};

export const handleBroadcast = async (args: string[]): Promise<void> => {
  const broadcast = parseBroadcastArgs(args);
  await dispatchOrPreview({
    envelope: buildBroadcastEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: broadcast.activityRunId,
      message: broadcast.message,
      roomId: broadcast.roomId,
      teamId: broadcast.teamId,
      audienceScope: broadcast.audienceScope,
      idempotencyKey: `broadcast-${broadcast.activityRunId}-${Date.now()}`,
    }),
    summary:
      `broadcast ${broadcast.activityRunId} / ` +
      `${broadcast.teamId ?? broadcast.roomId ?? broadcast.audienceScope ?? "global"}`,
  });
};

export const handleReaction = async (args: string[]): Promise<void> => {
  const reaction = parseReactionArgs(args);
  await dispatchOrPreview({
    envelope: buildReactionEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: reaction.activityRunId,
      reaction: reaction.reaction,
      roomId: reaction.roomId,
      targetEntityId: reaction.targetEntityId,
      targetTeamId: reaction.targetTeamId,
      note: reaction.note,
      idempotencyKey: `reaction-${reaction.activityRunId}-${Date.now()}`,
    }),
    summary:
      `reaction ${reaction.activityRunId} / ` +
      `${reaction.targetEntityId ?? reaction.targetTeamId ?? reaction.roomId ?? "stage"}`,
  });
};

export const handleBet = async (args: string[]): Promise<void> => {
  const bet = parseBetArgs(args);
  await dispatchOrPreview({
    envelope: buildBetEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: bet.activityRunId,
      targetType: bet.targetType,
      targetId: bet.targetId,
      roomId: bet.roomId,
      amount: bet.amount,
      odds: bet.odds,
      stance: bet.stance,
      note: bet.note,
      idempotencyKey: `bet-${bet.activityRunId}-${bet.targetType}-${bet.targetId}-${Date.now()}`,
    }),
    summary: `bet ${bet.activityRunId} / ${bet.targetType}:${bet.targetId}`,
  });
};

export const handleVote = async (args: string[]): Promise<void> => {
  const vote = parseVoteArgs(args);
  await dispatchOrPreview({
    envelope: buildVoteEnvelope({
      actorId: resolveActorId(),
      actorRole: resolveActorRole(),
      activityRunId: vote.activityRunId,
      targetType: vote.targetType,
      targetId: vote.targetId,
      roomId: vote.roomId,
      value: vote.value,
      note: vote.note,
      idempotencyKey: `vote-${vote.activityRunId}-${vote.targetType}-${vote.targetId}-${Date.now()}`,
    }),
    summary: `vote ${vote.activityRunId} / ${vote.targetType}:${vote.targetId}`,
  });
};
