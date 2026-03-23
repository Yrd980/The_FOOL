import {
  normalizeControlConfigValue,
  type CommandEnvelope,
  type OrchestratorEventQuery,
  type SubmitScorePayload,
} from "../../src/openclaw/control";
import { fail, readCommandConfirmation, USAGE } from "./support";

export const parsePayloadJson = (source: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(source);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return fail("Payload JSON must be an object.");
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    return fail(`Invalid payload JSON: ${(error as Error).message}`);
  }
};

export const parseLongOptions = (
  rawArgs: string[],
): {
  positional: string[];
  options: Record<string, string>;
} => {
  const positional: string[] = [];
  const options: Record<string, string> = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }

    const optionName = value.slice(2);
    const nextValue = rawArgs[index + 1];
    if (!optionName || !nextValue || nextValue.startsWith("--")) {
      fail(`Missing value for option ${value}.\n\n${USAGE}`);
    }

    options[optionName] = nextValue;
    index += 1;
  }

  return { positional, options };
};

export const readCommandConfirmationOption = (
  options: Record<string, string>,
) => readCommandConfirmation(normalizeControlConfigValue(options.confirm));

export const readOptionInteger = (
  options: Record<string, string>,
  key: string,
): number | undefined => {
  const rawValue = options[key];
  if (rawValue === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fail(`--${key} must be a non-negative integer.`);
  }

  return parsed;
};

export const readPositiveOptionNumber = (
  options: Record<string, string>,
  key: string,
): number | undefined => {
  const rawValue = options[key];
  if (rawValue === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`--${key} must be a positive number.`);
  }

  return parsed;
};

export const readPositiveNumericOption = (
  options: Record<string, string>,
  key: string,
): number | undefined => {
  const rawValue = options[key];
  if (rawValue === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`--${key} must be a positive number.`);
  }

  return parsed;
};

export const parseEventQueryArgs = (
  commandName: "events" | "replay" | "scores",
  rawArgs: string[],
): {
  activityRunId: string;
  query: OrchestratorEventQuery & { activityRunId: string };
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId] = positional;
  if (!activityRunId) {
    fail(USAGE);
  }

  const query: OrchestratorEventQuery & { activityRunId: string } = {
    activityRunId,
    afterSequence: readOptionInteger(options, "after-sequence"),
    fromSequence: readOptionInteger(options, "from-sequence"),
    toSequence: readOptionInteger(options, "to-sequence"),
    limit: readOptionInteger(options, "limit"),
  };

  if (
    query.afterSequence !== undefined &&
    query.fromSequence !== undefined
  ) {
    fail(
      `${commandName} accepts --after-sequence or --from-sequence, not both.`,
    );
  }

  return {
    activityRunId,
    query,
  };
};

export const parseSubmissionCommandArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  submissionId: string;
  data: Record<string, unknown>;
} => {
  const { positional } = parseLongOptions(rawArgs);
  const [activityRunId, submissionId, payloadJson] = positional;
  if (!activityRunId || !submissionId || !payloadJson) {
    fail(USAGE);
  }

  return {
    activityRunId,
    submissionId,
    data: parsePayloadJson(payloadJson),
  };
};

const parseAnnotationsJson = (source: string): Record<string, string> => {
  const parsed = parsePayloadJson(source);
  return Object.entries(parsed).reduce<Record<string, string>>(
    (result, [key, value]) => {
      if (typeof value === "string" && value.trim().length > 0) {
        result[key] = value.trim();
      }
      return result;
    },
    {},
  );
};

export const parseSubmitScoreArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  scorePayload: SubmitScorePayload;
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, submissionId, scoreInput] = positional;
  if (!activityRunId || !submissionId || !scoreInput) {
    fail(USAGE);
  }

  const score = Number.parseInt(scoreInput, 10);
  if (!Number.isFinite(score) || score < 1 || score > 10) {
    fail("submit-score requires <score-1..10>.");
  }

  const reason = options.reason?.trim();
  const annotationsFromJson = options["annotations-json"]?.trim()
    ? parseAnnotationsJson(options["annotations-json"])
    : {};

  if (!reason) {
    fail("submit-score requires --reason <text>.");
  }

  const annotations = annotationsFromJson;

  if (Object.keys(annotations).length === 0) {
    fail(
      "submit-score requires score annotations. Use --annotations-json '{\"key\":\"value\"}'.",
    );
  }

  return {
    activityRunId,
    scorePayload: {
      submissionId,
      score,
      reason,
      annotations,
    },
  };
};

export const parseAudienceScopeOption = (
  value: string | undefined,
): "room" | "team" | "global" | undefined => {
  const normalized = normalizeControlConfigValue(value);
  if (
    normalized === undefined ||
    normalized === "room" ||
    normalized === "team" ||
    normalized === "global"
  ) {
    return normalized;
  }

  fail("--audience-scope must be room, team, or global.");
};

export const parseTalkArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  message: string;
  roomId?: string;
  targetEntityId?: string;
  audienceScope?: "room" | "team" | "global";
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, ...messageParts] = positional;
  const message = messageParts.join(" ").trim();
  if (!activityRunId || !message) {
    fail(USAGE);
  }

  return {
    activityRunId,
    message,
    roomId: normalizeControlConfigValue(options["room-id"]),
    targetEntityId: normalizeControlConfigValue(options["target-entity-id"]),
    audienceScope: parseAudienceScopeOption(options["audience-scope"]),
  };
};

export const parseBroadcastArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  message: string;
  roomId?: string;
  teamId?: string;
  audienceScope?: "room" | "team" | "global";
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, ...messageParts] = positional;
  const message = messageParts.join(" ").trim();
  if (!activityRunId || !message) {
    fail(USAGE);
  }

  return {
    activityRunId,
    message,
    roomId: normalizeControlConfigValue(options["room-id"]),
    teamId: normalizeControlConfigValue(options["team-id"]),
    audienceScope: parseAudienceScopeOption(options["audience-scope"]),
  };
};

export const parseReactionArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  reaction: string;
  note?: string;
  roomId?: string;
  targetEntityId?: string;
  targetTeamId?: string;
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, reaction, ...noteParts] = positional;
  if (!activityRunId || !reaction) {
    fail(USAGE);
  }

  const noteFromPositional = noteParts.join(" ").trim();
  return {
    activityRunId,
    reaction,
    note:
      normalizeControlConfigValue(options.note) ??
      (noteFromPositional || undefined),
    roomId: normalizeControlConfigValue(options["room-id"]),
    targetEntityId: normalizeControlConfigValue(options["target-entity-id"]),
    targetTeamId: normalizeControlConfigValue(options["target-team-id"]),
  };
};

export const parseBetArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  targetType: "team" | "entity" | "submission";
  targetId: string;
  roomId?: string;
  amount?: number;
  odds?: number;
  stance?: string;
  note?: string;
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, targetTypeInput, targetId] = positional;
  if (!activityRunId || !targetTypeInput || !targetId) {
    fail(USAGE);
  }

  const targetType = normalizeControlConfigValue(targetTypeInput);
  if (
    targetType !== "team" &&
    targetType !== "entity" &&
    targetType !== "submission"
  ) {
    fail("bet requires <team|entity|submission> as the target type.");
  }

  return {
    activityRunId,
    targetType: targetType as "team" | "entity" | "submission",
    targetId,
    roomId: normalizeControlConfigValue(options["room-id"]),
    amount: readOptionInteger(options, "amount"),
    odds: readPositiveNumericOption(options, "odds"),
    stance: normalizeControlConfigValue(options.stance),
    note: normalizeControlConfigValue(options.note),
  };
};

export const parseVoteArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  targetType: "team" | "entity" | "submission";
  targetId: string;
  roomId?: string;
  value?: number;
  note?: string;
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, targetTypeInput, targetId] = positional;
  if (!activityRunId || !targetTypeInput || !targetId) {
    fail(USAGE);
  }

  const targetType = normalizeControlConfigValue(targetTypeInput);
  if (
    targetType !== "team" &&
    targetType !== "entity" &&
    targetType !== "submission"
  ) {
    fail("vote requires <team|entity|submission> as the target type.");
  }

  return {
    activityRunId,
    targetType: targetType as "team" | "entity" | "submission",
    targetId,
    roomId: normalizeControlConfigValue(options["room-id"]),
    value: readOptionInteger(options, "value"),
    note: normalizeControlConfigValue(options.note),
  };
};

export const parseFinishArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  settlementMode: "winner" | "push";
  winningTargetType?: "team" | "entity" | "submission";
  winningTargetId?: string;
  note?: string;
  confirmation?: CommandEnvelope["confirmation"];
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, targetTypeInput, targetId] = positional;
  if (!activityRunId || !targetTypeInput) {
    fail(USAGE);
  }

  const normalizedTargetType = normalizeControlConfigValue(targetTypeInput);
  if (normalizedTargetType === "push") {
    return {
      activityRunId,
      settlementMode: "push",
      note: normalizeControlConfigValue(options.note),
      confirmation: readCommandConfirmationOption(options),
    };
  }

  if (
    normalizedTargetType !== "team" &&
    normalizedTargetType !== "entity" &&
    normalizedTargetType !== "submission"
  ) {
    fail("finish requires <team|entity|submission|push> as the settlement target.");
  }

  if (!targetId) {
    fail("finish requires a target id unless the settlement mode is push.");
  }

  return {
    activityRunId,
    settlementMode: "winner",
    winningTargetType: normalizedTargetType as "team" | "entity" | "submission",
    winningTargetId: targetId,
    note: normalizeControlConfigValue(options.note),
    confirmation: readCommandConfirmationOption(options),
  };
};

export const parseStartTimerArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  stageId: string;
  durationSec: number;
} => {
  const [activityRunId, stageId, durationSecInput] = rawArgs;
  if (!activityRunId || !stageId || !durationSecInput) {
    fail(USAGE);
  }

  const durationSec = Number.parseInt(durationSecInput, 10);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    fail("Duration must be a positive integer in seconds.");
  }

  return {
    activityRunId,
    stageId,
    durationSec,
  };
};

export const parseGrantAwardArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  awardId: string;
  entityId: string;
  label?: string;
  reason?: string;
  confirmation?: CommandEnvelope["confirmation"];
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, awardId, entityId, label, ...reasonParts] = positional;
  if (!activityRunId || !awardId || !entityId) {
    fail(USAGE);
  }

  return {
    activityRunId,
    awardId,
    entityId,
    label,
    reason: reasonParts.join(" ").trim() || undefined,
    confirmation: readCommandConfirmationOption(options),
  };
};

export const parseDrawArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  entityId: string;
  drawData: Record<string, unknown>;
} => {
  const [activityRunId, entityId, drawDataJson] = rawArgs;
  if (!activityRunId || !entityId || !drawDataJson) {
    fail(USAGE);
  }

  return {
    activityRunId,
    entityId,
    drawData: parsePayloadJson(drawDataJson),
  };
};

export const parseMoveEntityArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  entityId: string;
  toRoomId: string;
  kind?: string;
  confirmation?: CommandEnvelope["confirmation"];
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, entityId, toRoomId, kind] = positional;
  if (!activityRunId || !entityId || !toRoomId) {
    fail(USAGE);
  }

  return {
    activityRunId,
    entityId,
    toRoomId,
    kind: kind || undefined,
    confirmation: readCommandConfirmationOption(options),
  };
};

export const parseAssignTeamArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  teamId: string;
  memberIds?: string[];
  roomId?: string;
  confirmation?: CommandEnvelope["confirmation"];
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId, teamId] = positional;
  if (!activityRunId || !teamId) {
    fail(USAGE);
  }

  const membersRaw = normalizeControlConfigValue(options.members);
  return {
    activityRunId,
    teamId,
    memberIds: membersRaw
      ? membersRaw.split(",").map((id) => id.trim()).filter(Boolean)
      : undefined,
    roomId: normalizeControlConfigValue(options["room-id"]),
    confirmation: readCommandConfirmationOption(options),
  };
};

export const parseAsciiArgs = (
  rawArgs: string[],
): {
  activityRunId: string;
  limit: number;
  watchSeconds?: number;
} => {
  const { positional, options } = parseLongOptions(rawArgs);
  const [activityRunId] = positional;
  if (!activityRunId) {
    fail(USAGE);
  }

  return {
    activityRunId,
    limit: readOptionInteger(options, "limit") ?? 12,
    watchSeconds: readPositiveOptionNumber(options, "watch"),
  };
};
