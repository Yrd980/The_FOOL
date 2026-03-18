import {
  registerActivityPackage,
  type ActivityPackage,
} from "../platform/activityRegistry";
import type {
  ScoreAnnotations,
  SubmissionData,
  SubmissionSchema,
  StageTemplate,
  WorldProjection,
} from "../platform/contracts";

export const THE_FOOL_V1_TEMPLATE_ID = "the-fool-v1";

export const THE_FOOL_SCORE_ANNOTATION_KEYS = {
  favorite: "favorite",
  mostAbsurd: "mostAbsurd",
} as const;

export interface TeamProjectSubmissionData extends Record<string, unknown> {
  posterOrDeck: string;
  elevatorPitch: string;
  highlights: [string, string, string];
  risk: string;
}

const countCodePoints = (value: string): number => Array.from(value).length;

const normalizeRequiredString = (
  rawData: SubmissionData,
  key: string,
): string => {
  const value = rawData[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`payload.data.${key} must be a non-empty string.`);
  }

  return value.trim();
};

const normalizeOptionalString = (
  rawData: SubmissionData,
  key: string,
): string | undefined => {
  const value = rawData[key];
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`payload.data.${key} must be a non-empty string when provided.`);
  }

  return value.trim();
};

const theFoolStageTemplates: StageTemplate[] = [
  {
    id: "act-1-intro",
    name: "自我介绍",
    durationSec: 300,
    allowedActions: ["talk", "reaction", "bet", "query"],
  },
  {
    id: "act-2-preference",
    name: "组队偏好",
    durationSec: 240,
    allowedActions: ["talk", "query"],
  },
  {
    id: "act-3-assignment",
    name: "组织龙虾分组",
    durationSec: 180,
    allowedActions: ["broadcast", "talk", "query"],
  },
  {
    id: "act-4-discussion",
    name: "队内讨论",
    durationSec: 900,
    allowedActions: ["move", "talk", "broadcast", "query"],
  },
  {
    id: "act-5-submission",
    name: "项目提交",
    durationSec: 420,
    allowedActions: [
      "submit",
      "update_submission",
      "open_submission",
      "lock_submission",
      "query",
    ],
    submissionSchemaIds: ["team-project-v1"],
  },
  {
    id: "act-6-human-review",
    name: "人类观赛点评",
    durationSec: 480,
    allowedActions: ["broadcast", "talk", "reaction", "bet"],
  },
  {
    id: "act-7-ai-judging",
    name: "AI 评委评审",
    durationSec: 300,
    allowedActions: ["score", "talk", "query"],
  },
  {
    id: "act-8-awards",
    name: "颁奖",
    durationSec: 240,
    allowedActions: ["broadcast", "grant_award", "query"],
  },
  {
    id: "act-9-co-creation",
    name: "全体共创艺术品",
    durationSec: 600,
    allowedActions: ["submit", "draw", "talk", "query"],
    submissionSchemaIds: ["personal-poem-v1"],
  },
  {
    id: "act-10-open-mic",
    name: "人类观众感想点评",
    durationSec: 300,
    allowedActions: ["talk", "broadcast"],
  },
];

const theFoolSubmissionSchemas: SubmissionSchema[] = [
  {
    id: "team-project-v1",
    fields: [
      { key: "posterOrDeck", type: "file", required: true },
      { key: "elevatorPitch", type: "text", required: true },
      { key: "highlights", type: "json", required: true },
      { key: "risk", type: "text", required: true },
    ],
  },
  {
    id: "personal-poem-v1",
    fields: [
      { key: "poem", type: "text", required: true },
      { key: "moodAtSubmission", type: "text", required: false },
    ],
  },
];

const theFoolWorld: WorldProjection = {
  rooms: [
    { id: "main-stage", label: "Main Stage" },
    { id: "team-room-1", label: "Team Room 1" },
    { id: "team-room-2", label: "Team Room 2" },
    { id: "team-room-3", label: "Team Room 3" },
    { id: "quiet-orbit", label: "Quiet Orbit" },
  ],
  teams: [
    {
      id: "team-1",
      memberIds: ["contestant-01", "contestant-02"],
      roomId: "team-room-1",
    },
    {
      id: "team-2",
      memberIds: ["contestant-03", "contestant-04"],
      roomId: "team-room-2",
    },
    {
      id: "team-3",
      memberIds: ["contestant-05", "contestant-06"],
      roomId: "team-room-3",
    },
  ],
  entities: [
    { id: "contestant-01", kind: "agent", roomId: "main-stage" },
    { id: "contestant-02", kind: "agent", roomId: "main-stage" },
    { id: "contestant-03", kind: "agent", roomId: "main-stage" },
    { id: "contestant-04", kind: "agent", roomId: "main-stage" },
    { id: "contestant-05", kind: "agent", roomId: "main-stage" },
    { id: "contestant-06", kind: "agent", roomId: "main-stage" },
    { id: "host-01", kind: "host", roomId: "main-stage" },
  ],
};

const theFoolSkillBindings = [
  {
    role: "agent",
    docId: "skill.md",
    version: "0.1.0",
  },
  {
    role: "agent",
    docId: "heartbeat.md",
    version: "0.1.0",
  },
];

const findTheFoolSubmissionSchema = (
  schemaId: string,
): SubmissionSchema | undefined =>
  theFoolSubmissionSchemas.find((schema) => schema.id === schemaId);

const assertAllowedSubmissionKeys = (
  schema: SubmissionSchema,
  rawData: SubmissionData,
): void => {
  const allowedKeys = new Set(schema.fields.map((field) => field.key));
  const unknownKeys = Object.keys(rawData).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(
      `payload.data contains unsupported fields: ${unknownKeys.join(", ")}.`,
    );
  }
};

export const normalizeTheFoolTeamProjectSubmissionData = ({
  posterOrDeck,
  elevatorPitch,
  highlights,
  risk,
}: TeamProjectSubmissionData): TeamProjectSubmissionData => {
  const normalizedPosterOrDeck = posterOrDeck.trim();
  const normalizedElevatorPitch = elevatorPitch.trim();
  const normalizedRisk = risk.trim();
  const normalizedHighlights = highlights.map((entry) => entry.trim()) as [
    string,
    string,
    string,
  ];

  if (!normalizedPosterOrDeck) {
    throw new Error("posterOrDeck is required.");
  }

  if (!normalizedElevatorPitch) {
    throw new Error("elevatorPitch is required.");
  }

  if (countCodePoints(normalizedElevatorPitch) > 100) {
    throw new Error("elevatorPitch must be 100 characters or fewer.");
  }

  if (normalizedHighlights.some((entry) => entry.length === 0)) {
    throw new Error("highlights must contain exactly 3 non-empty strings.");
  }

  if (!normalizedRisk) {
    throw new Error("risk is required.");
  }

  return {
    posterOrDeck: normalizedPosterOrDeck,
    elevatorPitch: normalizedElevatorPitch,
    highlights: normalizedHighlights,
    risk: normalizedRisk,
  };
};

export const normalizeTheFoolSubmissionData = (
  schemaId: string,
  rawData: SubmissionData,
): SubmissionData => {
  const schema = findTheFoolSubmissionSchema(schemaId);
  if (!schema) {
    throw new Error(`Unknown submission schema ${schemaId}.`);
  }

  assertAllowedSubmissionKeys(schema, rawData);

  if (schemaId === "team-project-v1") {
    const posterOrDeck = normalizeRequiredString(rawData, "posterOrDeck");
    const elevatorPitch = normalizeRequiredString(rawData, "elevatorPitch");
    if (countCodePoints(elevatorPitch) > 100) {
      throw new Error("payload.data.elevatorPitch must be 100 characters or fewer.");
    }

    const rawHighlights = rawData.highlights;
    if (
      !Array.isArray(rawHighlights) ||
      rawHighlights.length !== 3 ||
      rawHighlights.some(
        (entry) => typeof entry !== "string" || entry.trim().length === 0,
      )
    ) {
      throw new Error(
        "payload.data.highlights must contain exactly 3 non-empty strings.",
      );
    }

    const [firstHighlight, secondHighlight, thirdHighlight] = rawHighlights.map(
      (entry) => entry.trim(),
    ) as [string, string, string];
    const risk = normalizeRequiredString(rawData, "risk");

    return {
      posterOrDeck,
      elevatorPitch,
      highlights: [firstHighlight, secondHighlight, thirdHighlight],
      risk,
    };
  }

  if (schemaId === "personal-poem-v1") {
    const poem = normalizeRequiredString(rawData, "poem");
    const moodAtSubmission = normalizeOptionalString(rawData, "moodAtSubmission");

    return {
      poem,
      ...(moodAtSubmission ? { moodAtSubmission } : {}),
    };
  }

  const normalizedData: SubmissionData = {};
  for (const field of schema.fields) {
    const fieldValue = rawData[field.key];
    if (fieldValue === undefined || fieldValue === null) {
      if (field.required) {
        throw new Error(`payload.data.${field.key} is required.`);
      }
      continue;
    }

    if (
      field.type === "text" ||
      field.type === "file" ||
      field.type === "link"
    ) {
      normalizedData[field.key] = normalizeRequiredString(rawData, field.key);
      continue;
    }

    normalizedData[field.key] = structuredClone(fieldValue);
  }

  return normalizedData;
};

export const inferTheFoolSubmissionTeamId = (
  submissionId: string,
): string | undefined => {
  const numericSuffix = submissionId.match(/(\d+)$/)?.[1];
  if (!numericSuffix) {
    return undefined;
  }

  const normalized = Number.parseInt(numericSuffix, 10);
  return Number.isFinite(normalized) ? `team-${normalized}` : undefined;
};

export const normalizeTheFoolScoreAnnotations = (
  annotations: ScoreAnnotations,
): ScoreAnnotations => {
  const favorite =
    annotations[THE_FOOL_SCORE_ANNOTATION_KEYS.favorite]?.trim() ?? "";
  const mostAbsurd =
    annotations[THE_FOOL_SCORE_ANNOTATION_KEYS.mostAbsurd]?.trim() ?? "";

  if (!favorite || !mostAbsurd) {
    throw new Error(
      "submit_score requires non-empty favorite and mostAbsurd annotations.",
    );
  }

  return {
    [THE_FOOL_SCORE_ANNOTATION_KEYS.favorite]: favorite,
    [THE_FOOL_SCORE_ANNOTATION_KEYS.mostAbsurd]: mostAbsurd,
  };
};

export const theFoolV1ActivityPackage: ActivityPackage = registerActivityPackage({
  id: THE_FOOL_V1_TEMPLATE_ID,
  initialStageId: "act-1-intro",
  stageTemplates: theFoolStageTemplates,
  submissionSchemas: theFoolSubmissionSchemas,
  skillBindings: theFoolSkillBindings,
  world: theFoolWorld,
  normalizeSubmissionData: normalizeTheFoolSubmissionData,
  inferSubmissionTeamId: inferTheFoolSubmissionTeamId,
  scoreConfig: {
    allowedStageIds: ["act-7-ai-judging"],
    requiredAnnotations: [
      THE_FOOL_SCORE_ANNOTATION_KEYS.favorite,
      THE_FOOL_SCORE_ANNOTATION_KEYS.mostAbsurd,
    ],
    normalizeAnnotations: normalizeTheFoolScoreAnnotations,
  },
});
