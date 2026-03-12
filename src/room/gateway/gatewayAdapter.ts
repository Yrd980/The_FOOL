import type { AudienceInteraction, AudienceEventType, OpenClawContestantState } from "../../types";
import type { AgentPresenceMap, GatewayMessage, GatewayPresenceEntry } from "./types";

export const deriveContestantState = (lastInputSeconds: number | undefined): OpenClawContestantState => {
  if (lastInputSeconds === undefined) return "muted";
  if (lastInputSeconds < 10) return "speaking";
  if (lastInputSeconds < 30) return "raised-hand";
  if (lastInputSeconds < 120) return "listening";
  return "muted";
};

export const mapPresenceToContestantStates = (
  presences: GatewayPresenceEntry[],
  contestantIds: string[],
  configMap: AgentPresenceMap,
): Map<string, OpenClawContestantState> => {
  const stateMap = new Map<string, OpenClawContestantState>();

  // Default all contestants to muted
  for (const id of contestantIds) {
    stateMap.set(id, "muted");
  }

  // Filter to agent-mode presences only (mode is freeform; match substring)
  const isAgentMode = (mode?: string) => mode !== undefined && mode.includes("agent");
  const agentPresences = presences
    .filter((p) => isAgentMode(p.mode))
    .sort((a, b) => a.ts - b.ts);

  let autoIndex = 0;

  for (const presence of agentPresences) {
    const state = deriveContestantState(presence.lastInputSeconds);

    // Try config map first
    const mapped = configMap[presence.instanceId ?? ""];
    if (mapped && contestantIds.includes(mapped.contestantId)) {
      stateMap.set(mapped.contestantId, state);
      continue;
    }

    // Auto-assign by order
    if (autoIndex < contestantIds.length) {
      stateMap.set(contestantIds[autoIndex], state);
      autoIndex++;
    }
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
