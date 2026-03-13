import type { AudienceInteraction, AudienceEventType, OpenClawContestantState } from "../../types";
import type { GatewayMessage, GatewaySessionEntry } from "./types";
import type { AgentRegistry } from "./agentRegistry";
import { lookupContestant } from "./agentRegistry";

export const deriveContestantStateFromSession = (
  session: GatewaySessionEntry | undefined,
): OpenClawContestantState => {
  if (!session) return "muted";

  const idleMs = Date.now() - session.updatedAt;

  // Aborted runs: recent aborts show as raised-hand (needs attention),
  // stale aborts fade to muted (likely already retried/resolved)
  if (session.abortedLastRun) {
    return idleMs < 30_000 ? "raised-hand" : "muted";
  }

  if (idleMs < 10_000) return "speaking";
  if (idleMs < 30_000) return "raised-hand";
  if (idleMs < 120_000) return "listening";
  return "muted";
};

export const mapSessionsToContestantStates = (
  sessions: GatewaySessionEntry[],
  registry: AgentRegistry,
  contestantIds: string[],
): Map<string, OpenClawContestantState> => {
  const stateMap = new Map<string, OpenClawContestantState>();

  // Default all contestants to muted
  for (const id of contestantIds) {
    stateMap.set(id, "muted");
  }

  for (const session of sessions) {
    const registration = lookupContestant(registry, session.agentId);
    if (!registration || !contestantIds.includes(registration.contestantId)) continue;

    stateMap.set(registration.contestantId, deriveContestantStateFromSession(session));
  }

  return stateMap;
};

const BET_PATTERN = /(?:下注|bet|押注)\s*(\d+)/i;
const POSITIVE_PATTERNS = /👍|太棒|厉害|赞|好|nice|great|amazing|awesome/i;
const NEGATIVE_PATTERNS = /👎|不行|差|烂|bad|terrible|awful/i;

export const classifyInteractionType = (content: string): AudienceEventType => {
  if (BET_PATTERN.test(content)) return "bet";
  if (POSITIVE_PATTERNS.test(content)) return "like";
  if (NEGATIVE_PATTERNS.test(content)) return "boo";
  return "danmaku";
};

const extractBetAmount = (content: string): number => {
  const match = content.match(BET_PATTERN);
  return match ? parseInt(match[1], 10) : 1;
};

const formatTimestamp = (ts: number): string => {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export const mapGatewayMessage = (
  msg: GatewayMessage,
  contestantId: string,
): AudienceInteraction => ({
  id: `gw-${msg.id}`,
  contestantId,
  type: classifyInteractionType(msg.content),
  source: msg.senderName ?? msg.senderId,
  content: msg.content,
  amount: extractBetAmount(msg.content),
  timestampLabel: formatTimestamp(msg.ts),
});
