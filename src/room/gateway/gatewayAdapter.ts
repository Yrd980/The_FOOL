import type { AudienceInteraction, AudienceEventType, OpenClawContestantState } from "../../types";
import type { AgentPresenceMap, GatewayMessage, GatewayPresenceEntry, GatewaySessionEntry } from "./types";
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

// --- Session-based contestant state mapping (primary) ---

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

// --- Presence-based identity resolution (for message routing) ---

const isAgentMode = (mode?: string) => mode !== undefined && mode.includes("agent");

const normalizeIdentity = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const buildPresenceAssignments = (
  presences: GatewayPresenceEntry[],
  contestantIds: string[],
  configMap: AgentPresenceMap,
) => {
  const agentPresences = presences
    .filter((presence) => isAgentMode(presence.mode))
    .sort((left, right) => left.ts - right.ts);
  const assignments: Array<{ presence: GatewayPresenceEntry; contestantId: string }> = [];
  const assigned = new Set<string>();
  let autoIndex = 0;

  for (const presence of agentPresences) {
    const configuredContestantId = configMap[presence.instanceId ?? ""]?.contestantId;
    const preferredContestantId =
      configuredContestantId &&
      contestantIds.includes(configuredContestantId) &&
      !assigned.has(configuredContestantId)
        ? configuredContestantId
        : null;
    let contestantId = preferredContestantId;

    while (!contestantId && autoIndex < contestantIds.length) {
      const candidate = contestantIds[autoIndex];
      autoIndex += 1;
      if (!assigned.has(candidate)) {
        contestantId = candidate;
      }
    }

    if (!contestantId) {
      continue;
    }

    assignments.push({ presence, contestantId });
    assigned.add(contestantId);
  }

  return assignments;
};

const registerIdentity = (
  mapping: Map<string, string>,
  rawIdentity: string | null | undefined,
  contestantId: string,
) => {
  const identity = normalizeIdentity(rawIdentity);

  if (identity) {
    mapping.set(identity, contestantId);
  }
};

export const buildPresenceContestantMap = (
  presences: GatewayPresenceEntry[],
  contestantIds: string[],
  configMap: AgentPresenceMap,
): Map<string, string> => {
  const mapping = new Map<string, string>();

  for (const assignment of buildPresenceAssignments(presences, contestantIds, configMap)) {
    const configured = configMap[assignment.presence.instanceId ?? ""];
    registerIdentity(mapping, assignment.presence.instanceId, assignment.contestantId);
    registerIdentity(mapping, assignment.presence.deviceId, assignment.contestantId);
    registerIdentity(mapping, assignment.contestantId, assignment.contestantId);
    registerIdentity(mapping, configured?.name, assignment.contestantId);
  }

  return mapping;
};

// --- Message classification & mapping ---

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

export const resolveGatewayContestantId = (
  msg: GatewayMessage,
  presenceContestantMap: Map<string, string>,
  contestantIds: string[],
): string | null => {
  const candidateKeys = [msg.senderId, msg.senderName].map((value) => normalizeIdentity(value));

  for (const key of candidateKeys) {
    if (presenceContestantMap.has(key)) {
      return presenceContestantMap.get(key) ?? null;
    }
  }

  for (const key of candidateKeys) {
    if (!key) {
      continue;
    }

    const matchedContestantId = contestantIds.find((contestantId) =>
      key.includes(normalizeIdentity(contestantId)),
    );

    if (matchedContestantId) {
      return matchedContestantId;
    }
  }

  return null;
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
