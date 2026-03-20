import type {
  ActivityPresentationAdapter,
  ActivitySubmissionPresentationContext,
} from "../../platform/activityRegistry";
import type {
  SubmissionData,
  SubmissionSchema,
} from "../../platform/contracts";
import { theFoolSubmissionSchemas } from "./definition";

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

const pickSubmissionField = (
  data: SubmissionData | null | undefined,
  key: string,
): string | null =>
  data && typeof data[key] === "string" && data[key].trim().length > 0
    ? data[key].trim()
    : null;

export const theFoolPresentationAdapter: ActivityPresentationAdapter = {
  summarizeSubmissionLeadLine: ({
    data,
  }: ActivitySubmissionPresentationContext): string | null => {
    const poem = pickSubmissionField(data, "poem");
    if (poem) {
      return poem;
    }

    const elevatorPitch = pickSubmissionField(data, "elevatorPitch");
    if (elevatorPitch) {
      return elevatorPitch;
    }

    const highlights = Array.isArray(data?.highlights)
      ? data.highlights.find(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        ) ?? null
      : null;
    if (highlights) {
      return highlights.trim();
    }

    return (
      pickSubmissionField(data, "risk") ??
      pickSubmissionField(data, "posterOrDeck")
    );
  },
};
