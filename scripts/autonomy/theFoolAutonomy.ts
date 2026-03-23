import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildWorldRoomCatalog,
  tryBuildBootstrapRoomCatalog,
  tryResolveActivityPackageId,
  type ActivityRoomCatalog,
} from "../../src/openclaw/activityRuntime";
import {
  buildCommandConfirmation,
  buildCommandEnvelope,
  buildFinishActivityConfirmationChallenge,
  buildGatewayAgentCallArgs,
  buildGrantAwardConfirmationChallenge,
  buildLockSubmissionConfirmationChallenge,
  buildMoveEntityConfirmationChallenge,
  buildTransitionStageConfirmationChallenge,
} from "../../src/openclaw/control";
import type { OrchestratorStageTemplate } from "../../src/openclaw/orchestratorQueryClient";
import type {
  ActorRole,
  BetTargetType,
  CommandEnvelope,
  MessageAudienceScope,
  VoteTargetType,
} from "../../src/openclaw/platform/contracts";
import type {
  GatewayEventEnvelope,
  GatewaySnapshotEnvelope,
} from "../../src/openclaw/gateway/types";
import {
  resolveConfigValue,
  resolveGatewayToken,
  resolveLocalOrchestratorAuth,
  runOpenClawJson,
} from "../control/support";
import {
  OrchestratorRpcClient,
  type RpcEventPage,
  type RpcSnapshotPayload,
} from "./orchestratorRpc";

interface AutonomyState {
  runId: string;
  completedSteps: string[];
  lastSeenSequenceByActor: Record<string, number>;
  turnCounts: Record<string, number>;
}

interface AutonomyOptions {
  activityRunId?: string;
  ledgerDir?: string;
  logger?: Pick<Console, "log">;
}

interface PromptAction {
  action: string;
  [key: string]: unknown;
}

interface AutonomousRole {
  actorId: string;
  actorRole: ActorRole;
  gatewayAgentId: string;
  fallbackRoomId: string;
  persona: string;
}

interface ActionSpec {
  stepKey: string;
  actorId: string;
  instruction: string;
  example: PromptAction;
  promptSkeleton?: PromptAction;
  nonEmptyPaths?: string[];
  validate?: (value: PromptAction) => string | null;
}

interface RuntimeContext {
  activityRunId: string;
  logger: Pick<Console, "log">;
  ledgerPath: string;
  state: AutonomyState;
  docs: {
    skill: string;
    heartbeat: string;
    requirements: string;
  };
  clients: Map<string, OrchestratorRpcClient>;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

const AUTONOMOUS_ROLES: AutonomousRole[] = [
  {
    actorId: "host-01",
    actorRole: "host",
    gatewayAgentId: "main",
    fallbackRoomId: "main-stage",
    persona: "authoritative host; advance the show cleanly and keep the activity legible.",
  },
  {
    actorId: "contestant-01",
    actorRole: "agent",
    gatewayAgentId: "contestant-01",
    fallbackRoomId: "main-stage",
    persona: "chaotic systems architect who still cares about runtime truth.",
  },
  {
    actorId: "contestant-02",
    actorRole: "agent",
    gatewayAgentId: "contestant-02",
    fallbackRoomId: "main-stage",
    persona: "anti-boring operator who wants crisp, direct collaboration.",
  },
  {
    actorId: "contestant-03",
    actorRole: "agent",
    gatewayAgentId: "contestant-03",
    fallbackRoomId: "main-stage",
    persona: "competitive builder obsessed with winning without losing rigor.",
  },
  {
    actorId: "contestant-04",
    actorRole: "agent",
    gatewayAgentId: "contestant-04",
    fallbackRoomId: "main-stage",
    persona: "experimental maker who likes playful but explainable ideas.",
  },
  {
    actorId: "contestant-05",
    actorRole: "agent",
    gatewayAgentId: "contestant-05",
    fallbackRoomId: "main-stage",
    persona: "poetic maker who turns structure into atmosphere.",
  },
  {
    actorId: "contestant-06",
    actorRole: "agent",
    gatewayAgentId: "contestant-06",
    fallbackRoomId: "main-stage",
    persona: "electric contrarian who still lands coherent output.",
  },
  {
    actorId: "judge-01",
    actorRole: "judge",
    gatewayAgentId: "contestant-07",
    fallbackRoomId: "main-stage",
    persona: "precise AI judge focused on authority, clarity, and fit.",
  },
  {
    actorId: "judge-02",
    actorRole: "judge",
    gatewayAgentId: "contestant-08",
    fallbackRoomId: "main-stage",
    persona: "AI judge who rewards transparent structure and tasteful absurdity.",
  },
  {
    actorId: "judge-03",
    actorRole: "judge",
    gatewayAgentId: "contestant-09",
    fallbackRoomId: "main-stage",
    persona: "AI judge who prefers strange ideas that still survive scrutiny.",
  },
  {
    actorId: "viewer-01",
    actorRole: "viewer",
    gatewayAgentId: "contestant-10",
    fallbackRoomId: "main-stage",
    persona: "reaction-heavy viewer who amplifies whoever catches attention first.",
  },
  {
    actorId: "viewer-02",
    actorRole: "viewer",
    gatewayAgentId: "contestant-11",
    fallbackRoomId: "main-stage",
    persona: "bet-heavy viewer who talks like a confident, dramatic bookmaker.",
  },
  {
    actorId: "viewer-03",
    actorRole: "viewer",
    gatewayAgentId: "contestant-12",
    fallbackRoomId: "main-stage",
    persona: "vote-heavy viewer who likes momentum, closure, and strong endings.",
  },
];

const ROLES_BY_ID = new Map(
  AUTONOMOUS_ROLES.map((role) => [role.actorId, role] as const),
);

const TEAM_BY_CONTESTANT: Record<string, string> = {
  "contestant-01": "team-1",
  "contestant-02": "team-1",
  "contestant-03": "team-2",
  "contestant-04": "team-2",
  "contestant-05": "team-3",
  "contestant-06": "team-3",
};

const CAPTAIN_BY_TEAM: Record<string, string> = {
  "team-1": "contestant-01",
  "team-2": "contestant-03",
  "team-3": "contestant-05",
};

const SUBMISSION_BY_TEAM: Record<string, string> = {
  "team-1": "submission-1",
  "team-2": "submission-2",
  "team-3": "submission-3",
};

const PREFERENCE_SCRIPT: Record<
  string,
  { wants: [string, string]; avoids: [string, string] }
> = {
  "contestant-01": { wants: ["contestant-05", "contestant-06"], avoids: ["contestant-02", "contestant-04"] },
  "contestant-02": { wants: ["contestant-01", "contestant-03"], avoids: ["contestant-05", "contestant-06"] },
  "contestant-03": { wants: ["contestant-02", "contestant-04"], avoids: ["contestant-01", "contestant-05"] },
  "contestant-04": { wants: ["contestant-03", "contestant-06"], avoids: ["contestant-02", "contestant-05"] },
  "contestant-05": { wants: ["contestant-01", "contestant-06"], avoids: ["contestant-02", "contestant-03"] },
  "contestant-06": { wants: ["contestant-04", "contestant-05"], avoids: ["contestant-01", "contestant-02"] },
};

const PROJECT_SUBMISSION_SEEDS: Record<
  string,
  {
    posterOrDeck: string;
    risk: string;
    highlightSeed: string;
    pitchSeed: string;
  }
> = {
  "team-1": {
    posterOrDeck: "deck-1",
    risk: "timing drift under pressure",
    highlightSeed: "authoritative orchestration insight",
    pitchSeed: "operator-grade authority visibility",
  },
  "team-2": {
    posterOrDeck: "deck-2",
    risk: "annotation drift across judges",
    highlightSeed: "explainable scoring flow",
    pitchSeed: "transparent judging with structured replay",
  },
  "team-3": {
    posterOrDeck: "deck-3",
    risk: "poetic overload without control",
    highlightSeed: "mood-driven creation loop",
    pitchSeed: "creative heat turned into a coherent artifact",
  },
};

const POEM_BY_ACTOR: Record<
  string,
  {
    submissionId: string;
    color: string;
    x: number;
    y: number;
  }
> = {
  "contestant-01": { submissionId: "poem-alpha", color: "blue", x: 2, y: 3 },
  "contestant-02": { submissionId: "poem-bravo", color: "green", x: 3, y: 5 },
  "contestant-03": { submissionId: "poem-charlie", color: "gold", x: 5, y: 1 },
  "contestant-04": { submissionId: "poem-delta", color: "orange", x: 6, y: 2 },
  "contestant-05": { submissionId: "poem-echo", color: "pink", x: 7, y: 4 },
  "contestant-06": { submissionId: "poem-foxtrot", color: "violet", x: 8, y: 6 },
};

const JUDGE_SCORE_PLAN: Record<string, number> = {
  "submission-1": 8,
  "submission-2": 9,
  "submission-3": 10,
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (
  record: Record<string, unknown> | undefined,
  key: string,
): string | null => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const truncate = (value: string, maxChars: number): string =>
  value.length <= maxChars ? value : `${value.slice(0, maxChars)}\n...[truncated]`;

const AUTONOMY_CONTROL_WORDS = new Set([
  "stop",
  "abort",
  "quit",
  "cancel",
  "memory_get",
  "memory_put",
  "error",
]);

const INFRA_FAILURE_TEXT_PATTERNS = [
  /^llm request rejected:/i,
  /organization has been disabled/i,
  /^openclaw\b.* failed:/i,
  /^failed to run openclaw\b/i,
  /returned invalid json/i,
  /^timed out waiting for event /i,
  /^websocket connection failed\.?$/i,
];

const stableSubsetMatches = (value: unknown, expected: unknown): boolean => {
  if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
    return value === expected;
  }
  if (!isRecord(value) || !isRecord(expected)) {
    return false;
  }

  return Object.entries(expected).every(([key, childExpected]) =>
    stableSubsetMatches(value[key], childExpected),
  );
};

const readPath = (value: unknown, pathText: string): unknown => {
  let current: unknown = value;
  for (const key of pathText.split(".")) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
};

const writePath = (
  value: Record<string, unknown>,
  pathText: string,
  nextValue: unknown,
): void => {
  const keys = pathText.split(".");
  let current: Record<string, unknown> = value;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const existing = current[key];
    if (!isRecord(existing)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys.at(-1) ?? pathText] = nextValue;
};

const ensureNonEmptyPaths = (
  value: PromptAction,
  paths: string[] | undefined,
): string | null => {
  for (const entry of paths ?? []) {
    const resolved = readPath(value, entry);
    if (typeof resolved === "string" && resolved.trim().length > 0) {
      continue;
    }
    if (typeof resolved === "number" && Number.isFinite(resolved)) {
      continue;
    }
    if (Array.isArray(resolved) && resolved.length > 0) {
      continue;
    }
    if (isRecord(resolved) && Object.keys(resolved).length > 0) {
      continue;
    }
    return `Missing non-empty field ${entry}.`;
  }
  return null;
};

const selectLastPayloadText = (payload: unknown): string | null => {
  const texts = collectPayloadTexts(payload)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return texts.at(-1) ?? null;
};

const selectFreeTextCandidate = (payload: unknown): string | null => {
  const texts = collectPayloadTexts(payload)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const filtered = texts.filter(
    (entry) =>
      !entry.includes("Return exactly one JSON object") &&
      !entry.includes("Current stage doc excerpt:") &&
      !entry.includes("Authority snapshot:") &&
      !entry.includes("JSON example:") &&
      !AUTONOMY_CONTROL_WORDS.has(entry.toLowerCase()),
  );
  const candidate = filtered.at(-1) ?? texts.at(-1);
  if (!candidate || candidate.trim().length === 0) {
    return null;
  }
  return AUTONOMY_CONTROL_WORDS.has(candidate.toLowerCase())
    ? null
    : candidate.trim();
};

const isInfrastructureFailureText = (value: string): boolean =>
  INFRA_FAILURE_TEXT_PATTERNS.some((pattern) => pattern.test(value.trim()));

const coercePromptActionFromText = (
  payload: unknown,
  spec: ActionSpec,
): PromptAction | null => {
  if ((spec.nonEmptyPaths?.length ?? 0) !== 1) {
    return null;
  }

  const targetPath = spec.nonEmptyPaths?.[0];
  if (
    !targetPath ||
    !["message", "note", "stance", "reason", "label"].includes(targetPath)
  ) {
    return null;
  }

  const freeText = selectFreeTextCandidate(payload);
  if (!freeText) {
    return null;
  }

  const nextText = isInfrastructureFailureText(freeText) ? null : freeText;
  if (!nextText) {
    return null;
  }

  const coerced = JSON.parse(JSON.stringify(spec.example)) as PromptAction;
  writePath(coerced, targetPath, nextText);
  return coerced;
};

const normalizeParsedPromptAction = (
  parsed: PromptAction,
  spec: ActionSpec,
): PromptAction => {
  const normalized = JSON.parse(JSON.stringify(parsed)) as PromptAction;
  if (spec.nonEmptyPaths?.includes("message") && !readString(normalized, "message")) {
    const aliasedMessage =
      readString(normalized, "text") ?? readString(normalized, "content");
    if (aliasedMessage) {
      normalized.message = aliasedMessage;
    }
  }
  if (normalized.action === "submit") {
    const data = isRecord(normalized.data) ? normalized.data : null;
    if (typeof data?.elevatorPitch === "string") {
      data.elevatorPitch = Array.from(data.elevatorPitch.trim()).slice(0, 100).join("");
    }
  }
  return normalized;
};

const extractJsonObject = (text: string): PromptAction | null => {
  const trimmed = text.trim();
  const candidates = [
    trimmed,
    ...Array.from(trimmed.matchAll(/```json\s*([\s\S]*?)```/g)).map(
      (match) => match[1]?.trim() ?? "",
    ),
  ];

  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    candidates.push(trimmed.slice(braceStart, braceEnd + 1));
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isRecord(parsed) && typeof parsed.action === "string") {
        return parsed as PromptAction;
      }
    } catch {
      // Keep scanning candidate strings until one parses.
    }
  }

  return null;
};

const collectPayloadTexts = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectPayloadTexts(entry));
  }
  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.payloads)) {
    return collectPayloadTexts(value.payloads);
  }

  if (isRecord(value.result) && Array.isArray(value.result.payloads)) {
    return collectPayloadTexts(value.result.payloads);
  }

  const hasOnlyPayloadFields = Object.keys(value).every((key) =>
    ["text", "mediaUrl", "type"].includes(key),
  );
  if (hasOnlyPayloadFields && typeof value.text === "string") {
    return [value.text];
  }

  return [];
};

const createInitialState = (runId: string): AutonomyState => ({
  runId,
  completedSteps: [],
  lastSeenSequenceByActor: {},
  turnCounts: {},
});

const loadState = async (
  ledgerPath: string,
  runId: string,
): Promise<AutonomyState> => {
  try {
    const parsed = JSON.parse(await readFile(ledgerPath, "utf8")) as AutonomyState;
    if (
      typeof parsed.runId === "string" &&
      Array.isArray(parsed.completedSteps) &&
      isRecord(parsed.lastSeenSequenceByActor) &&
      isRecord(parsed.turnCounts)
    ) {
      return {
        ...parsed,
        runId,
      };
    }
  } catch {
    // Fall through to a fresh state file.
  }
  return createInitialState(runId);
};

const saveState = async (context: RuntimeContext): Promise<void> => {
  await mkdir(path.dirname(context.ledgerPath), { recursive: true });
  await writeFile(
    context.ledgerPath,
    JSON.stringify(context.state, null, 2),
    "utf8",
  );
};

const loadDocs = async (): Promise<RuntimeContext["docs"]> => {
  const [skill, heartbeat, requirements] = await Promise.all([
    readFile(path.join(repoRoot, "public", "skill.md"), "utf8"),
    readFile(path.join(repoRoot, "public", "heartbeat.md"), "utf8"),
    readFile(
      path.join(repoRoot, "docs", "activities", "the-fool-v1", "requirements.md"),
      "utf8",
    ),
  ]);
  return { skill, heartbeat, requirements };
};

const STAGE_DOC_MARKERS: Record<string, string> = {
  "act-1-intro": "### 8.1 Act I",
  "act-2-preference": "### 8.2 Act II",
  "act-3-assignment": "### 8.3 Act III",
  "act-4-discussion": "### 8.4 Act IV",
  "act-5-submission": "### 8.5 Act V",
  "act-6-human-review": "### 8.6 Act VI",
  "act-7-ai-judging": "### 8.7 Act VII",
  "act-8-awards": "### 8.8 Act VIII",
  "act-9-co-creation": "### 8.9 Act IX",
  "act-10-open-mic": "### 8.10 Act X",
};

const extractStageDoc = (requirements: string, stageId: string): string => {
  const marker = STAGE_DOC_MARKERS[stageId];
  if (!marker) {
    return "";
  }
  const startIndex = requirements.indexOf(marker);
  if (startIndex < 0) {
    return "";
  }
  const remaining = requirements.slice(startIndex);
  const nextIndex = remaining.slice(marker.length).search(/\n###\s8\./);
  return nextIndex < 0
    ? remaining.trim()
    : remaining.slice(0, marker.length + nextIndex).trim();
};

const summarizeRecentEvents = (events: GatewayEventEnvelope[]): string =>
  events.length === 0
    ? "(none)"
    : events
        .slice(-12)
        .map((event) => {
          const bits = [
            typeof event.sequence === "number" ? `#${event.sequence}` : "#?",
            event.type,
            event.actorId ? `by ${event.actorId}` : null,
          ].filter((entry): entry is string => entry !== null);
          return bits.join(" ");
        })
        .join("\n");

const summarizeSnapshot = (
  snapshotPayload: RpcSnapshotPayload,
  actorId: string,
): string => {
  const snapshot = snapshotPayload.snapshot;
  const world = snapshot.world;
  const activityRun = snapshot.activityRun;
  const teams = world?.teams ?? [];
  const entities = world?.entities ?? [];
  const ownEntity = entities.find((entity) => entity.id === actorId);
  const ownTeam = teams.find((team) => team.memberIds.includes(actorId));
  const roomSummary = (world?.rooms ?? [])
    .map((room) => {
      const occupants = entities
        .filter((entity) => entity.roomId === room.id)
        .map((entity) => entity.id)
        .join(", ");
      return `${room.id}: ${occupants || "empty"}`;
    })
    .join(" | ");

  const topScores = (snapshot.scoreSummary ?? [])
    .slice(0, 3)
    .map(
      (entry) =>
        `${entry.teamId ?? entry.targetId} avg=${entry.averageScore.toFixed(2)} votes=${entry.judgeCount}`,
    )
    .join(" | ");

  const topVotes = (snapshot.social?.voteSummary ?? [])
    .slice(0, 3)
    .map((entry) => `${entry.targetId} total=${entry.totalValue}`)
    .join(" | ");

  return [
    `activity: ${activityRun?.id ?? "unknown"} status=${activityRun?.status ?? "unknown"} stage=${activityRun?.currentStageId ?? "none"}`,
    `you: room=${ownEntity?.roomId ?? "n/a"} team=${ownTeam?.id ?? "n/a"}`,
    `rooms: ${roomSummary || "n/a"}`,
    `submissions: ${(snapshot.submissions ?? []).map((submission) => `${submission.id}:${submission.locked ? "locked" : `v${submission.version ?? 0}`}`).join(" | ") || "none"}`,
    `scores: ${topScores || "none"}`,
    `votes: ${topVotes || "none"}`,
  ].join("\n");
};

const nextTurnNumber = (context: RuntimeContext, key: string): number => {
  const nextValue = (context.state.turnCounts[key] ?? 0) + 1;
  context.state.turnCounts[key] = nextValue;
  return nextValue;
};

const markCompleted = async (
  context: RuntimeContext,
  stepKey: string,
): Promise<void> => {
  if (!context.state.completedSteps.includes(stepKey)) {
    context.state.completedSteps.push(stepKey);
    await saveState(context);
  }
};

const resolveRoomForActor = (
  snapshot: GatewaySnapshotEnvelope,
  actorId: string,
): string => {
  const world = snapshot.world;
  const role = ROLES_BY_ID.get(actorId);
  const entityRoomId =
    world?.entities.find((entity) => entity.id === actorId)?.roomId ?? null;
  return entityRoomId ?? role?.fallbackRoomId ?? "main-stage";
};

const resolveSnapshotActivityPackageId = (
  snapshot: GatewaySnapshotEnvelope,
): string | null =>
  tryResolveActivityPackageId({
    templateId: snapshot.activityRun?.templateId,
  }) ??
  snapshot.activityRun?.templateId ??
  null;

const resolveRoomCatalogForSnapshot = (
  snapshot: GatewaySnapshotEnvelope,
): ActivityRoomCatalog | null => {
  const activityPackageId = resolveSnapshotActivityPackageId(snapshot);
  if (snapshot.world) {
    return buildWorldRoomCatalog({
      world: snapshot.world,
      activityPackageId,
    });
  }

  return tryBuildBootstrapRoomCatalog(activityPackageId);
};

const queryRecentEventsForActor = async (
  context: RuntimeContext,
  actorId: string,
): Promise<GatewayEventEnvelope[]> => {
  const client = context.clients.get(actorId);
  if (!client) {
    throw new Error(`Missing orchestrator client for ${actorId}.`);
  }
  const lastSeenSequence = context.state.lastSeenSequenceByActor[actorId];
  const page = await client.fetchEvents({
    activityRunId: context.activityRunId,
    ...(typeof lastSeenSequence === "number"
      ? { afterSequence: lastSeenSequence }
      : {}),
    limit: 60,
  });
  return page.events;
};

const updateLastSeen = async (
  context: RuntimeContext,
  actorId: string,
  page: RpcEventPage | RpcSnapshotPayload,
): Promise<void> => {
  const sequence =
    "lastSequence" in page
      ? page.lastSequence
      : (page.snapshot.lastSequence ?? 0);
  context.state.lastSeenSequenceByActor[actorId] = sequence;
  await saveState(context);
};

const buildActionPrompt = ({
  role,
  activityRunId,
  stageTemplate,
  snapshotPayload,
  recentEvents,
  docs,
  instruction,
  example,
}: {
  role: AutonomousRole;
  activityRunId: string;
  stageTemplate: OrchestratorStageTemplate | undefined;
  snapshotPayload: RpcSnapshotPayload;
  recentEvents: GatewayEventEnvelope[];
  docs: RuntimeContext["docs"];
  instruction: string;
  example: PromptAction;
}): string => {
  const currentStageId = snapshotPayload.snapshot.activityRun?.currentStageId ?? "unknown";
  return [
    `You are ${role.actorId} (${role.actorRole}) in The Fool v1 activity run ${activityRunId}.`,
    `OpenClaw persona: ${role.persona}`,
    "",
    "Authority snapshot:",
    summarizeSnapshot(snapshotPayload, role.actorId),
    "",
    "Recent authority events since your last turn:",
    summarizeRecentEvents(recentEvents),
    "",
    "Current stage doc excerpt:",
    truncate(extractStageDoc(docs.requirements, currentStageId), 2600),
    "",
    "Base skill excerpt:",
    truncate(docs.skill, 1800),
    "",
    "Heartbeat excerpt:",
    truncate(docs.heartbeat, 900),
    "",
    `Current stage allowed actions: ${stageTemplate?.allowedActions?.join(", ") ?? "unknown"}`,
    `Task: ${instruction}`,
    "",
    "Return exactly one JSON object and nothing else.",
    "Do not wrap in markdown fences.",
    `JSON example: ${JSON.stringify(example)}`,
  ].join("\n");
};

const parsePromptAction = (
  payload: unknown,
  spec: ActionSpec,
): PromptAction => {
  for (const text of collectPayloadTexts(payload)) {
    const parsed = extractJsonObject(text);
    if (!parsed) {
      continue;
    }
    const normalized = normalizeParsedPromptAction(parsed, spec);

    const subsetError = stableSubsetMatches(normalized, spec.example)
      ? null
      : `Expected subset ${JSON.stringify(spec.example)}.`;
    if (subsetError) {
      continue;
    }

    const nonEmptyError = ensureNonEmptyPaths(normalized, spec.nonEmptyPaths);
    if (nonEmptyError) {
      continue;
    }

    const validateError = spec.validate?.(normalized);
    if (validateError) {
      continue;
    }
    return normalized;
  }

  const coerced = coercePromptActionFromText(payload, spec);
  if (coerced) {
    const nonEmptyError = ensureNonEmptyPaths(coerced, spec.nonEmptyPaths);
    const validateError = spec.validate?.(coerced);
    if (!nonEmptyError && !validateError) {
      return coerced;
    }
  }

  const payloadSnippet = selectLastPayloadText(payload);
  throw new Error(
    `Agent response for ${spec.stepKey} did not contain valid JSON matching ${JSON.stringify(spec.example)}.${payloadSnippet ? ` Last payload text: ${JSON.stringify(truncate(payloadSnippet, 400))}` : ""}`,
  );
};

const callGatewayAgent = async (
  role: AutonomousRole,
  roomId: string,
  prompt: string,
  gatewayRunId: string,
  activityPackageId: string | null | undefined,
  roomCatalog: ActivityRoomCatalog | null,
  sessionKeySuffix: string,
): Promise<unknown> => {
  const token = resolveGatewayToken();
  if (!token) {
    throw new Error(
      "Missing OpenClaw gateway token. Set OPENCLAW_GATEWAY_TOKEN or configure ~/.openclaw/openclaw.json.",
    );
  }
  const gatewayUrl = resolveConfigValue("OPENCLAW_GATEWAY_URL");
  return runOpenClawJson(
    buildGatewayAgentCallArgs({
      agentId: role.gatewayAgentId,
      room: roomId,
      message: prompt,
      timeoutSeconds: 180,
      gatewayUrl,
      token,
      idempotencyKey: gatewayRunId,
      activityPackageId: activityPackageId ?? undefined,
      roomCatalog,
      sessionKeySuffix,
    }),
  );
};

const promptForAction = async (
  context: RuntimeContext,
  spec: ActionSpec,
): Promise<PromptAction> => {
  const role = ROLES_BY_ID.get(spec.actorId);
  const client = context.clients.get(spec.actorId);
  if (!role || !client) {
    throw new Error(`Unknown autonomy role ${spec.actorId}.`);
  }

  const snapshotPayload = await client.fetchSnapshot(context.activityRunId);
  const stageId = snapshotPayload.snapshot.activityRun?.currentStageId ?? "";
  const stageTemplate = snapshotPayload.stageTemplates?.find(
    (entry) => entry.id === stageId,
  );
  const recentEvents = await queryRecentEventsForActor(context, spec.actorId);
  const roomId = resolveRoomForActor(snapshotPayload.snapshot, spec.actorId);
  const roomCatalog = resolveRoomCatalogForSnapshot(snapshotPayload.snapshot);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const runOrdinal = nextTurnNumber(context, `${spec.stepKey}-prompt`);
    const prompt =
      attempt === 1
        ? buildActionPrompt({
            role,
            activityRunId: context.activityRunId,
            stageTemplate,
            snapshotPayload,
            recentEvents,
            docs: context.docs,
            instruction: spec.instruction,
            example: spec.promptSkeleton ?? spec.example,
          })
        : [
            buildActionPrompt({
              role,
              activityRunId: context.activityRunId,
              stageTemplate,
              snapshotPayload,
              recentEvents,
              docs: context.docs,
              instruction: spec.instruction,
              example: spec.promptSkeleton ?? spec.example,
            }),
            "",
            "Previous attempt was invalid.",
            "Reply with valid JSON only.",
            attempt === 3
              ? `If needed, echo this exact skeleton and only replace the free-text values: ${JSON.stringify(spec.promptSkeleton ?? spec.example)}`
              : "Do not add any explanation before or after the JSON object.",
          ].join("\n");

    try {
      const gatewayPayload = await callGatewayAgent(
        role,
        roomId,
        prompt,
        `${context.state.runId}-${spec.stepKey}-agent-${runOrdinal}`,
        resolveSnapshotActivityPackageId(snapshotPayload.snapshot),
        roomCatalog,
        context.state.runId,
      );
      const parsed = parsePromptAction(gatewayPayload, spec);
      await updateLastSeen(context, spec.actorId, snapshotPayload);
      return parsed;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
    }
  }

  throw new Error(`Failed to obtain a valid action for ${spec.stepKey}.`);
};

const buildAutonomyEnvelope = ({
  actorId,
  actorRole,
  activityRunId,
  action,
  idempotencyKey,
}: {
  actorId: string;
  actorRole: ActorRole;
  activityRunId: string;
  action: PromptAction;
  idempotencyKey: string;
}): CommandEnvelope => {
  const actionType = String(action.action);
  if (actionType === "talk") {
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "talk",
      payload: {
        message: String(action.message),
        ...(readString(action, "roomId") ? { roomId: readString(action, "roomId") } : {}),
        ...(readString(action, "targetEntityId")
          ? { targetEntityId: readString(action, "targetEntityId") }
          : {}),
        ...(readString(action, "audienceScope")
          ? {
              audienceScope: readString(
                action,
                "audienceScope",
              ) as MessageAudienceScope,
            }
          : {}),
      },
      idempotencyKey,
    });
  }

  if (actionType === "broadcast") {
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "broadcast",
      payload: {
        message: String(action.message),
        ...(readString(action, "roomId") ? { roomId: readString(action, "roomId") } : {}),
        ...(readString(action, "teamId") ? { teamId: readString(action, "teamId") } : {}),
        ...(readString(action, "audienceScope")
          ? {
              audienceScope: readString(
                action,
                "audienceScope",
              ) as MessageAudienceScope,
            }
          : {}),
      },
      idempotencyKey,
    });
  }

  if (actionType === "reaction") {
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "reaction",
      payload: {
        reaction: String(action.reaction),
        ...(readString(action, "note") ? { note: readString(action, "note") } : {}),
        ...(readString(action, "roomId") ? { roomId: readString(action, "roomId") } : {}),
        ...(readString(action, "targetEntityId")
          ? { targetEntityId: readString(action, "targetEntityId") }
          : {}),
        ...(readString(action, "targetTeamId")
          ? { targetTeamId: readString(action, "targetTeamId") }
          : {}),
      },
      idempotencyKey,
    });
  }

  if (actionType === "bet") {
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "bet",
      payload: {
        targetType: String(action.targetType) as BetTargetType,
        targetId: String(action.targetId),
        ...(typeof action.amount === "number" ? { amount: action.amount } : {}),
        ...(typeof action.odds === "number" ? { odds: action.odds } : {}),
        ...(readString(action, "stance") ? { stance: readString(action, "stance") } : {}),
        ...(readString(action, "note") ? { note: readString(action, "note") } : {}),
        ...(readString(action, "roomId") ? { roomId: readString(action, "roomId") } : {}),
      },
      idempotencyKey,
    });
  }

  if (actionType === "vote") {
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "vote",
      payload: {
        targetType: String(action.targetType) as VoteTargetType,
        targetId: String(action.targetId),
        value:
          typeof action.value === "number" && Number.isFinite(action.value)
            ? Math.round(action.value)
            : 1,
        ...(readString(action, "note") ? { note: readString(action, "note") } : {}),
        ...(readString(action, "roomId") ? { roomId: readString(action, "roomId") } : {}),
      },
      idempotencyKey,
    });
  }

  if (actionType === "transition_stage") {
    const targetStageId = String(action.targetStageId);
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "transition_stage",
      payload: { targetStageId },
      idempotencyKey,
      confirmation: buildCommandConfirmation(
        buildTransitionStageConfirmationChallenge(targetStageId),
      ),
    });
  }

  if (actionType === "start_timer") {
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "start_timer",
      payload: {
        stageId: String(action.stageId),
        durationSec:
          typeof action.durationSec === "number" ? Math.round(action.durationSec) : 1,
        kind: "countdown",
      },
      idempotencyKey,
    });
  }

  if (actionType === "open_submission") {
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "open_submission",
      payload: { submissionId: String(action.submissionId) },
      idempotencyKey,
    });
  }

  if (actionType === "submit") {
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "submit",
      payload: {
        submissionId: String(action.submissionId),
        data: isRecord(action.data) ? action.data : {},
      },
      idempotencyKey,
    });
  }

  if (actionType === "lock_submission") {
    const submissionId = String(action.submissionId);
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "lock_submission",
      payload: { submissionId },
      idempotencyKey,
      confirmation: buildCommandConfirmation(
        buildLockSubmissionConfirmationChallenge(submissionId),
      ),
    });
  }

  if (actionType === "submit_score") {
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "submit_score",
      payload: {
        submissionId: String(action.submissionId),
        score:
          typeof action.score === "number" ? Math.round(action.score) : Number.NaN,
        reason: String(action.reason),
        annotations: isRecord(action.annotations)
          ? Object.fromEntries(
              Object.entries(action.annotations).map(([key, value]) => [
                key,
                String(value),
              ]),
            )
          : {},
      },
      idempotencyKey,
    });
  }

  if (actionType === "grant_award") {
    const awardId = String(action.awardId);
    const entityId = String(action.entityId);
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "grant_award",
      payload: {
        awardId,
        entityId,
        label: String(action.label),
        reason: String(action.reason),
      },
      idempotencyKey,
      confirmation: buildCommandConfirmation(
        buildGrantAwardConfirmationChallenge({ awardId, entityId }),
      ),
    });
  }

  if (actionType === "draw") {
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "draw",
      payload: {
        entityId: readString(action, "entityId") ?? actorId,
        data: isRecord(action.data) ? action.data : {},
      },
      idempotencyKey,
    });
  }

  if (actionType === "move_entity") {
    const entityId = String(action.entityId);
    const toRoomId = String(action.toRoomId);
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "move_entity",
      payload: {
        entityId,
        toRoomId,
        kind: readString(action, "kind") ?? "agent",
      },
      idempotencyKey,
      confirmation: buildCommandConfirmation(
        buildMoveEntityConfirmationChallenge({ entityId, toRoomId }),
      ),
    });
  }

  if (actionType === "finish_activity") {
    const winningTargetType = String(action.winningTargetType) as VoteTargetType;
    const winningTargetId = String(action.winningTargetId);
    return buildCommandEnvelope({
      actorId,
      actorRole,
      activityRunId,
      type: "finish_activity",
      payload: {
        settlementMode: String(action.settlementMode) === "push" ? "push" : "winner",
        winningTargetType,
        winningTargetId,
        ...(readString(action, "note") ? { note: readString(action, "note") } : {}),
      },
      idempotencyKey,
      confirmation: buildCommandConfirmation(
        buildFinishActivityConfirmationChallenge({
          activityRunId,
          settlementMode:
            String(action.settlementMode) === "push" ? "push" : "winner",
          winningTargetType,
          winningTargetId,
        }),
      ),
    });
  }

  throw new Error(`Unsupported prompted action ${actionType}.`);
};

const executeActionSpec = async (
  context: RuntimeContext,
  spec: ActionSpec,
): Promise<void> => {
  if (context.state.completedSteps.includes(spec.stepKey)) {
    return;
  }
  const role = ROLES_BY_ID.get(spec.actorId);
  const client = context.clients.get(spec.actorId);
  if (!role || !client) {
    throw new Error(`Unknown actor ${spec.actorId}.`);
  }

  const action = await promptForAction(context, spec);
  const commandId = `${context.state.runId}-${spec.stepKey}-cmd`;
  const envelope = buildAutonomyEnvelope({
    actorId: role.actorId,
    actorRole: role.actorRole,
    activityRunId: context.activityRunId,
    action,
    idempotencyKey: commandId,
  });
  const response = await client.dispatchCommand(envelope);
  context.logger.log(
    `[autonomy] ${spec.stepKey} -> ${response.receipt.status} ${response.receipt.commandType}`,
  );
  await client.waitForSequence(
    Math.max(...response.receipt.emittedSequences, 0),
    context.activityRunId,
  );
  await markCompleted(context, spec.stepKey);
  await updateLastSeen(context, spec.actorId, {
    snapshot: response.snapshot,
  });
  await sleep(120);
};

const waitForStage = async (
  context: RuntimeContext,
  expectedStageId: string,
  timeoutMs = 12_000,
): Promise<void> => {
  const hostClient = context.clients.get("host-01");
  if (!hostClient) {
    throw new Error("Missing host orchestrator client.");
  }
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshotPayload = await hostClient.fetchSnapshot(context.activityRunId);
    if (snapshotPayload.snapshot.activityRun?.currentStageId === expectedStageId) {
      return;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for stage ${expectedStageId}.`);
};

const fetchHostSnapshot = async (
  context: RuntimeContext,
): Promise<RpcSnapshotPayload> => {
  const hostClient = context.clients.get("host-01");
  if (!hostClient) {
    throw new Error("Missing host orchestrator client.");
  }
  return hostClient.fetchSnapshot(context.activityRunId);
};

const detectWinner = (
  snapshot: GatewaySnapshotEnvelope,
): { winningTargetType: "team"; winningTargetId: string } => {
  const scoreByTeam = new Map<string, number>();
  for (const entry of snapshot.scoreSummary ?? []) {
    const teamId = entry.teamId ?? (entry.targetType === "team" ? entry.targetId : null);
    if (teamId) {
      scoreByTeam.set(teamId, entry.averageScore);
    }
  }

  const voteByTeam = new Map<string, number>();
  for (const entry of snapshot.social?.voteSummary ?? []) {
    if (entry.targetType === "team") {
      voteByTeam.set(entry.targetId, entry.totalValue);
    }
  }

  const betHeatByTeam = new Map<string, number>();
  for (const entry of snapshot.social?.betHeat ?? []) {
    if (entry.scope === "team") {
      betHeatByTeam.set(entry.targetId, entry.value);
    }
  }

  const candidates = ["team-1", "team-2", "team-3"];
  candidates.sort((left, right) => {
    const leftScore = scoreByTeam.get(left) ?? 0;
    const rightScore = scoreByTeam.get(right) ?? 0;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    const leftVotes = voteByTeam.get(left) ?? 0;
    const rightVotes = voteByTeam.get(right) ?? 0;
    if (rightVotes !== leftVotes) {
      return rightVotes - leftVotes;
    }
    const leftBetHeat = betHeatByTeam.get(left) ?? 0;
    const rightBetHeat = betHeatByTeam.get(right) ?? 0;
    if (rightBetHeat !== leftBetHeat) {
      return rightBetHeat - leftBetHeat;
    }
    return left.localeCompare(right);
  });

  return { winningTargetType: "team", winningTargetId: candidates[0] };
};

const detectMostAbsurdWinner = (snapshot: GatewaySnapshotEnvelope): string => {
  const counts = new Map<string, { count: number; lastSubmittedAt: number }>();
  for (const score of snapshot.scores ?? []) {
    const rawValue =
      isRecord(score.annotations) && typeof score.annotations.mostAbsurd === "string"
        ? score.annotations.mostAbsurd.trim()
        : "";
    if (!rawValue) {
      continue;
    }
    const actorId = rawValue.includes("contestant-")
      ? rawValue.match(/contestant-\d+/)?.[0] ?? rawValue
      : rawValue.includes("team-")
        ? TEAM_BY_CONTESTANT[CAPTAIN_BY_TEAM[rawValue] ?? ""] ?? "contestant-05"
        : "contestant-05";
    const existing = counts.get(actorId);
    if (existing) {
      existing.count += 1;
      existing.lastSubmittedAt = Math.max(existing.lastSubmittedAt, score.submittedAt);
    } else {
      counts.set(actorId, { count: 1, lastSubmittedAt: score.submittedAt });
    }
  }

  const ranked = [...counts.entries()].sort((left, right) => {
    if (right[1].count !== left[1].count) {
      return right[1].count - left[1].count;
    }
    if (right[1].lastSubmittedAt !== left[1].lastSubmittedAt) {
      return right[1].lastSubmittedAt - left[1].lastSubmittedAt;
    }
    return left[0].localeCompare(right[0]);
  });
  return ranked[0]?.[0] ?? "contestant-05";
};

const createTalkSpec = (
  stepKey: string,
  actorId: string,
  instruction: string,
): ActionSpec => ({
  stepKey,
  actorId,
  instruction,
  example: { action: "talk" },
  nonEmptyPaths: ["message"],
});

const runAct1 = async (context: RuntimeContext): Promise<void> => {
  for (const contestantId of Object.keys(TEAM_BY_CONTESTANT)) {
    await executeActionSpec(
      context,
      createTalkSpec(
        `act-1-intro-${contestantId}`,
        contestantId,
        "Introduce yourself in one short line. Mention your style and what kind of build energy you bring tonight.",
      ),
    );
  }

  await executeActionSpec(context, {
    stepKey: "act-1-viewer-01-reaction",
    actorId: "viewer-01",
    instruction:
      "Add one warm opening reaction for contestant-01. Keep the note short and lively.",
    example: {
      action: "reaction",
      reaction: "clap",
      targetEntityId: "contestant-01",
    },
    nonEmptyPaths: ["note"],
  });
  await executeActionSpec(context, {
    stepKey: "act-1-viewer-02-bet",
    actorId: "viewer-02",
    instruction:
      "Place one early-read bet on team-2 with amount 2 and a compact stance string.",
    example: {
      action: "bet",
      targetType: "team",
      targetId: "team-2",
      amount: 2,
    },
    nonEmptyPaths: ["stance"],
  });
  await executeActionSpec(context, {
    stepKey: "act-1-viewer-03-vote",
    actorId: "viewer-03",
    instruction:
      "Cast one first-impression vote for team-3 with value 2 and a short note.",
    example: {
      action: "vote",
      targetType: "team",
      targetId: "team-3",
      value: 2,
    },
    nonEmptyPaths: ["note"],
  });
  await executeActionSpec(context, {
    stepKey: "act-1-host-transition",
    actorId: "host-01",
    instruction:
      "The intro round is complete. Advance the authority stage to act-2-preference.",
    example: {
      action: "transition_stage",
      targetStageId: "act-2-preference",
    },
  });
  await waitForStage(context, "act-2-preference");
};

const runAct2 = async (context: RuntimeContext): Promise<void> => {
  for (const [contestantId, preference] of Object.entries(PREFERENCE_SCRIPT)) {
    await executeActionSpec(
      context,
      createTalkSpec(
        `act-2-preference-${contestantId}`,
        contestantId,
        `State two people you most want to team with (${preference.wants.join(", ")}) and two you want to avoid (${preference.avoids.join(", ")}). Keep it to one compact sentence.`,
      ),
    );
  }

  await executeActionSpec(context, {
    stepKey: "act-2-host-transition",
    actorId: "host-01",
    instruction:
      "Preferences are collected. Advance the stage to act-3-assignment.",
    example: {
      action: "transition_stage",
      targetStageId: "act-3-assignment",
    },
  });
  await waitForStage(context, "act-3-assignment");
};

const runAct3 = async (context: RuntimeContext): Promise<void> => {
  await executeActionSpec(context, {
    stepKey: "act-3-host-broadcast",
    actorId: "host-01",
    instruction:
      "Broadcast the final team assignment: team-1=01,02; team-2=03,04; team-3=05,06.",
    example: {
      action: "broadcast",
      audienceScope: "global",
    },
    nonEmptyPaths: ["message"],
  });

  for (const actorId of ["contestant-01", "contestant-03", "contestant-05"]) {
    await executeActionSpec(
      context,
      createTalkSpec(
        `act-3-ack-${actorId}`,
        actorId,
        "Acknowledge your assigned team in one short line.",
      ),
    );
  }

  await executeActionSpec(context, {
    stepKey: "act-3-host-transition",
    actorId: "host-01",
    instruction: "Move the activity into act-4-discussion.",
    example: {
      action: "transition_stage",
      targetStageId: "act-4-discussion",
    },
  });
  await waitForStage(context, "act-4-discussion");
};

const runAct4 = async (context: RuntimeContext): Promise<void> => {
  for (const contestantId of Object.keys(TEAM_BY_CONTESTANT)) {
    await executeActionSpec(context, {
      stepKey: `act-4-move-${contestantId}`,
      actorId: "host-01",
      instruction: `Move ${contestantId} into that contestant's team room so the authoritative room state matches discussion reality.`,
      example: {
        action: "move_entity",
        entityId: contestantId,
        toRoomId: TEAM_BY_CONTESTANT[contestantId].replace("team", "team-room"),
      },
    });
  }

  for (const contestantId of Object.keys(TEAM_BY_CONTESTANT)) {
    const teamId = TEAM_BY_CONTESTANT[contestantId];
    await executeActionSpec(
      context,
      createTalkSpec(
        `act-4-talk-${contestantId}`,
        contestantId,
        `You are in ${teamId}. Propose one concrete project direction your team can build.`,
      ),
    );
  }

  await executeActionSpec(context, {
    stepKey: "act-4-host-start-timer",
    actorId: "host-01",
    instruction:
      "The discussion checkpoint is satisfied. Start a short 1 second authority timer for act-4-discussion so the runtime auto-advances.",
    example: {
      action: "start_timer",
      stageId: "act-4-discussion",
      durationSec: 1,
    },
  });
  await waitForStage(context, "act-5-submission");
};

const runAct5 = async (context: RuntimeContext): Promise<void> => {
  for (const submissionId of Object.values(SUBMISSION_BY_TEAM)) {
    await executeActionSpec(context, {
      stepKey: `act-5-open-${submissionId}`,
      actorId: "host-01",
      instruction: `Open the authoritative submission slot ${submissionId}.`,
      example: {
        action: "open_submission",
        submissionId,
      },
    });
  }

  for (const [teamId, captainId] of Object.entries(CAPTAIN_BY_TEAM)) {
    const seed = PROJECT_SUBMISSION_SEEDS[teamId];
    await executeActionSpec(context, {
      stepKey: `act-5-submit-${captainId}`,
      actorId: captainId,
      instruction:
        `Submit the team project package for ${teamId}. Use schema fields posterOrDeck, elevatorPitch, highlights (exactly 3 items), and risk. elevatorPitch must be 100 characters or fewer. Build a concise but vivid project concept around ${seed.highlightSeed} and ${seed.pitchSeed}.`,
      example: {
        action: "submit",
        submissionId: SUBMISSION_BY_TEAM[teamId],
      },
      promptSkeleton: {
        action: "submit",
        submissionId: SUBMISSION_BY_TEAM[teamId],
        data: {
          posterOrDeck: seed.posterOrDeck,
          elevatorPitch: "one short pitch line",
          highlights: ["highlight one", "highlight two", "highlight three"],
          risk: seed.risk,
        },
      },
      nonEmptyPaths: [
        "data.posterOrDeck",
        "data.elevatorPitch",
        "data.highlights",
        "data.risk",
      ],
      validate: (value) => {
        const data = isRecord(value.data) ? value.data : null;
        const highlights = Array.isArray(data?.highlights) ? data.highlights : [];
        const elevatorPitch =
          typeof data?.elevatorPitch === "string" ? data.elevatorPitch.trim() : "";
        if (Array.from(elevatorPitch).length > 100) {
          return "elevatorPitch must be 100 characters or fewer.";
        }
        if (highlights.length !== 3) {
          return "highlights must contain exactly 3 items.";
        }
        return null;
      },
    });
  }

  for (const submissionId of Object.values(SUBMISSION_BY_TEAM)) {
    await executeActionSpec(context, {
      stepKey: `act-5-lock-${submissionId}`,
      actorId: "host-01",
      instruction: `Lock the finished team submission ${submissionId}.`,
      example: {
        action: "lock_submission",
        submissionId,
      },
    });
  }

  await waitForStage(context, "act-6-human-review");
};

const runAct6 = async (context: RuntimeContext): Promise<void> => {
  await executeActionSpec(context, {
    stepKey: "act-6-host-broadcast",
    actorId: "host-01",
    instruction: "Broadcast that the activity has entered the public human review window.",
    example: {
      action: "broadcast",
    },
    nonEmptyPaths: ["message"],
  });
  await executeActionSpec(context, {
    stepKey: "act-6-viewer-02-bet",
    actorId: "viewer-02",
    instruction:
      "Place one finals-style bet on team-1 with amount 5 and a short stance.",
    example: {
      action: "bet",
      targetType: "team",
      targetId: "team-1",
      amount: 5,
    },
    nonEmptyPaths: ["stance"],
  });
  await executeActionSpec(context, {
    stepKey: "act-6-viewer-01-reaction",
    actorId: "viewer-01",
    instruction:
      "React to team-2's deck reveal with a strong positive reaction and a short note.",
    example: {
      action: "reaction",
      reaction: "fire",
      targetTeamId: "team-2",
    },
    nonEmptyPaths: ["note"],
  });
  await executeActionSpec(
    context,
    createTalkSpec(
      "act-6-talk-contestant-02",
      "contestant-02",
      "Say one short line defending your team's project during the public review.",
    ),
  );
  await executeActionSpec(context, {
    stepKey: "act-6-viewer-03-vote",
    actorId: "viewer-03",
    instruction:
      "Cast a review-room momentum vote for team-1 with value 3 and a short note.",
    example: {
      action: "vote",
      targetType: "team",
      targetId: "team-1",
      value: 3,
    },
    nonEmptyPaths: ["note"],
  });
  await executeActionSpec(context, {
    stepKey: "act-6-host-transition",
    actorId: "host-01",
    instruction: "Review is done. Advance to act-7-ai-judging.",
    example: {
      action: "transition_stage",
      targetStageId: "act-7-ai-judging",
    },
  });
  await waitForStage(context, "act-7-ai-judging");
};

const runAct7 = async (context: RuntimeContext): Promise<void> => {
  for (const judgeId of ["judge-01", "judge-02", "judge-03"]) {
    for (const [submissionId, score] of Object.entries(JUDGE_SCORE_PLAN)) {
      const teamId =
        submissionId === "submission-1"
          ? "team-1"
          : submissionId === "submission-2"
            ? "team-2"
            : "team-3";
      await executeActionSpec(context, {
        stepKey: `act-7-${judgeId}-${submissionId}`,
        actorId: judgeId,
        instruction:
          `Submit one formal structured score for ${submissionId}. Use score ${score}. The favorite annotation must be ${teamId}. The mostAbsurd annotation must name one contestant id directly.`,
        example: {
          action: "submit_score",
          submissionId,
          score,
        },
        promptSkeleton: {
          action: "submit_score",
          submissionId,
          score,
          reason: "one short judging reason",
          annotations: {
            favorite: teamId,
            mostAbsurd: "contestant-01",
          },
        },
        nonEmptyPaths: [
          "reason",
          "annotations.favorite",
          "annotations.mostAbsurd",
        ],
        validate: (value) => {
          const annotations = isRecord(value.annotations) ? value.annotations : null;
          if (annotations?.favorite !== teamId) {
            return `favorite annotation must be ${teamId}.`;
          }
          const mostAbsurd =
            typeof annotations?.mostAbsurd === "string"
              ? annotations.mostAbsurd.trim()
              : "";
          if (!mostAbsurd.startsWith("contestant-")) {
            return "mostAbsurd must be a contestant id.";
          }
          return null;
        },
      });
    }
  }
  await waitForStage(context, "act-8-awards");
};

const runAct8 = async (context: RuntimeContext): Promise<void> => {
  await executeActionSpec(context, {
    stepKey: "act-8-host-broadcast",
    actorId: "host-01",
    instruction: "Broadcast a short dramatic pre-award line before the champion reveal.",
    example: {
      action: "broadcast",
    },
    nonEmptyPaths: ["message"],
  });

  const snapshotPayload = await fetchHostSnapshot(context);
  const mostAbsurdWinner = detectMostAbsurdWinner(snapshotPayload.snapshot);
  await executeActionSpec(context, {
    stepKey: "act-8-host-award",
    actorId: "host-01",
    instruction:
      `Grant the authoritative Most Absurd award to ${mostAbsurdWinner}. Keep the label exactly "Most Absurd" and provide a short reason.`,
    example: {
      action: "grant_award",
      awardId: "most-absurd",
      entityId: mostAbsurdWinner,
      label: "Most Absurd",
    },
    nonEmptyPaths: ["reason"],
  });
  await executeActionSpec(context, {
    stepKey: "act-8-viewer-03-vote",
    actorId: "viewer-03",
    instruction:
      "Cast one audience champion vote for team-1 with value 2 and a short note.",
    example: {
      action: "vote",
      targetType: "team",
      targetId: "team-1",
      value: 2,
    },
    nonEmptyPaths: ["note"],
  });
  await executeActionSpec(context, {
    stepKey: "act-8-host-transition",
    actorId: "host-01",
    instruction: "Move the activity into act-9-co-creation.",
    example: {
      action: "transition_stage",
      targetStageId: "act-9-co-creation",
    },
  });
  await waitForStage(context, "act-9-co-creation");
};

const runAct9 = async (context: RuntimeContext): Promise<void> => {
  for (const contestantId of Object.keys(TEAM_BY_CONTESTANT)) {
    await executeActionSpec(context, {
      stepKey: `act-9-move-quiet-${contestantId}`,
      actorId: "host-01",
      instruction: `Move ${contestantId} into quiet-orbit for the co-creation round.`,
      example: {
        action: "move_entity",
        entityId: contestantId,
        toRoomId: "quiet-orbit",
      },
    });
  }

  for (const [contestantId, poemPlan] of Object.entries(POEM_BY_ACTOR)) {
    await executeActionSpec(context, {
      stepKey: `act-9-submit-${contestantId}`,
      actorId: contestantId,
      instruction:
        `Submit a personal poem as ${poemPlan.submissionId}. Use data.poem and optional data.moodAtSubmission.`,
      example: {
        action: "submit",
        submissionId: poemPlan.submissionId,
      },
      promptSkeleton: {
        action: "submit",
        submissionId: poemPlan.submissionId,
        data: {
          poem: "one short poem",
          moodAtSubmission: "one mood phrase",
        },
      },
      nonEmptyPaths: ["data.poem", "data.moodAtSubmission"],
    });
    await executeActionSpec(context, {
      stepKey: `act-9-draw-${contestantId}`,
      actorId: contestantId,
      instruction:
        `Submit one draw action using color ${poemPlan.color}, x=${poemPlan.x}, y=${poemPlan.y}, and poemSubmissionId=${poemPlan.submissionId}.`,
      example: {
        action: "draw",
        entityId: contestantId,
      },
      promptSkeleton: {
        action: "draw",
        entityId: contestantId,
        data: {
          color: poemPlan.color,
          x: poemPlan.x,
          y: poemPlan.y,
          poemSubmissionId: poemPlan.submissionId,
        },
      },
      validate: (value) => {
        const data = isRecord(value.data) ? value.data : null;
        if (!data) {
          return "draw data is required.";
        }
        if (
          data.color !== poemPlan.color ||
          data.x !== poemPlan.x ||
          data.y !== poemPlan.y ||
          data.poemSubmissionId !== poemPlan.submissionId
        ) {
          return "draw data must match the assigned co-creation slot.";
        }
        return null;
      },
    });
  }

  for (const contestantId of Object.keys(TEAM_BY_CONTESTANT)) {
    await executeActionSpec(context, {
      stepKey: `act-9-move-main-${contestantId}`,
      actorId: "host-01",
      instruction:
        `Move ${contestantId} back to main-stage before the final open mic.`,
      example: {
        action: "move_entity",
        entityId: contestantId,
        toRoomId: "main-stage",
      },
    });
  }

  await executeActionSpec(context, {
    stepKey: "act-9-host-transition",
    actorId: "host-01",
    instruction: "Transition the authority stage into act-10-open-mic.",
    example: {
      action: "transition_stage",
      targetStageId: "act-10-open-mic",
    },
  });
  await waitForStage(context, "act-10-open-mic");
};

const runAct10 = async (context: RuntimeContext): Promise<void> => {
  await executeActionSpec(context, {
    stepKey: "act-10-host-broadcast",
    actorId: "host-01",
    instruction:
      "Broadcast a short line opening the final open mic and inviting the room to close the night.",
    example: {
      action: "broadcast",
    },
    nonEmptyPaths: ["message"],
  });
  for (const contestantId of Object.keys(TEAM_BY_CONTESTANT)) {
    await executeActionSpec(
      context,
      createTalkSpec(
        `act-10-talk-${contestantId}`,
        contestantId,
        "Say one short closing line about what the night became.",
      ),
    );
  }

  const snapshotPayload = await fetchHostSnapshot(context);
  const winner = detectWinner(snapshotPayload.snapshot);
  await executeActionSpec(context, {
    stepKey: "act-10-host-finish",
    actorId: "host-01",
    instruction:
      `Finish the activity with settlementMode=winner, winningTargetType=team, winningTargetId=${winner.winningTargetId}, and a short note about the full autonomous landing.`,
    example: {
      action: "finish_activity",
      settlementMode: "winner",
      winningTargetType: winner.winningTargetType,
      winningTargetId: winner.winningTargetId,
    },
    nonEmptyPaths: ["note"],
  });
};

const runCurrentStage = async (
  context: RuntimeContext,
  stageId: string,
): Promise<void> => {
  if (stageId === "act-1-intro") {
    await runAct1(context);
    return;
  }
  if (stageId === "act-2-preference") {
    await runAct2(context);
    return;
  }
  if (stageId === "act-3-assignment") {
    await runAct3(context);
    return;
  }
  if (stageId === "act-4-discussion") {
    await runAct4(context);
    return;
  }
  if (stageId === "act-5-submission") {
    await runAct5(context);
    return;
  }
  if (stageId === "act-6-human-review") {
    await runAct6(context);
    return;
  }
  if (stageId === "act-7-ai-judging") {
    await runAct7(context);
    return;
  }
  if (stageId === "act-8-awards") {
    await runAct8(context);
    return;
  }
  if (stageId === "act-9-co-creation") {
    await runAct9(context);
    return;
  }
  if (stageId === "act-10-open-mic") {
    await runAct10(context);
    return;
  }
  throw new Error(`Unsupported current stage ${stageId}.`);
};

export const runTheFoolAutonomy = async (
  options: AutonomyOptions = {},
): Promise<void> => {
  const orchestratorAuth = resolveLocalOrchestratorAuth();
  const logger = options.logger ?? console;
  const activityRunId = options.activityRunId ?? "activity-run-01";
  const runId = `the-fool-autonomy-${Date.now()}`;
  const ledgerDir =
    options.ledgerDir ??
    path.join(repoRoot, ".autonomy", activityRunId);
  const ledgerPath = path.join(ledgerDir, "state.json");

  const docs = await loadDocs();
  const clients = new Map<string, OrchestratorRpcClient>();
  for (const role of AUTONOMOUS_ROLES) {
    const client = new OrchestratorRpcClient(
      orchestratorAuth.baseUrl,
      orchestratorAuth.token,
      role.actorId,
      role.actorRole,
    );
    await client.connect();
    clients.set(role.actorId, client);
  }

  const context: RuntimeContext = {
    activityRunId,
    logger,
    ledgerPath,
    state: await loadState(ledgerPath, runId),
    docs,
    clients,
  };
  await saveState(context);

  try {
    for (let guard = 0; guard < 24; guard += 1) {
      const snapshotPayload = await fetchHostSnapshot(context);
      const activityRun = snapshotPayload.snapshot.activityRun;
      const currentStageId = activityRun?.currentStageId;
      logger.log(
        `[autonomy] status=${activityRun?.status ?? "unknown"} stage=${currentStageId ?? "none"} lastSequence=${snapshotPayload.snapshot.lastSequence ?? 0}`,
      );
      if (activityRun?.status === "finished") {
        await updateLastSeen(context, "host-01", snapshotPayload);
        return;
      }
      if (!currentStageId) {
        throw new Error("Authoritative activity is missing currentStageId.");
      }
      await runCurrentStage(context, currentStageId);
    }
    throw new Error("Autonomy loop exceeded guard limit before finish.");
  } finally {
    for (const client of clients.values()) {
      client.close();
    }
  }
};
