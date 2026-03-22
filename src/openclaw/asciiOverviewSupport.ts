import type { OrchestratorStageTemplate } from "./orchestratorQueryClient";

export const ASCII_IDLE_LABEL = "idle";
export const DEFAULT_TEAM_TRAIL_LIMIT = 3;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const readString = (
  record: Record<string, unknown> | undefined,
  ...keys: string[]
): string | null => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

export const readStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];

export const readNumber = (
  record: Record<string, unknown> | undefined,
  ...keys: string[]
): number | null => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
};

export const formatClockLabel = (timestamp: number | null | undefined): string => {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "unknown";
  }

  const date = new Date(timestamp);
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":");
};

export const formatDateTimeLabel = (timestamp: number | null | undefined): string => {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "unknown";
  }

  const date = new Date(timestamp);
  const day = [
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `${day} ${formatClockLabel(timestamp)}`;
};

export const formatDurationLabel = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.round(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
    ].join(":");
  }

  return [
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
};

export const formatTeamLabel = (teamId: string): string => {
  const match = teamId.match(/^team-(\d+)$/);
  return match ? `Team ${match[1]}` : teamId;
};

export const formatEntityLabel = (entityId: string): string => {
  const match = entityId.match(/^contestant-(\d+)$/);
  return match ? `contestant-${match[1]}` : entityId;
};

export const formatStageLabel = (
  stageId: string | null,
  stageTemplate?: OrchestratorStageTemplate,
): string => {
  if (!stageId) {
    return "pending";
  }

  if (stageTemplate?.allowedActions?.length) {
    return `${stageId} [${stageTemplate.allowedActions.join(", ")}]`;
  }

  return stageId;
};

export const formatStageTitle = (stageTemplate: OrchestratorStageTemplate): string =>
  stageTemplate.name ? `${stageTemplate.id} (${stageTemplate.name})` : stageTemplate.id;

export const unique = <T>(items: T[]): T[] => [...new Set(items)];
