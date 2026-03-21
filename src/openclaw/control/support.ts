import type { ActivityRoomCatalog } from "../activityRuntime";
import type {
  CommandEnvelope,
  MessageAudienceScope,
} from "../platform/contracts";

interface ControlRoomResolutionOptions {
  roomCatalog?: ActivityRoomCatalog | null;
}

export const normalizeAlias = (room: string): string =>
  room.trim().toLowerCase().replace(/[\s_]+/g, "-");

export const resolveRoomCatalog = (
  _activityPackageId?: string | null,
  options?: ControlRoomResolutionOptions,
) => options?.roomCatalog ?? null;

export const normalizeAgentId = (agentId: string): string => {
  const normalized = agentId.trim();
  if (!normalized) {
    throw new Error("Agent id is required.");
  }
  return normalized;
};

export const hasWrappingQuotes = (value: string): boolean =>
  value.length >= 2 &&
  ((value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")));

export const normalizeRequiredText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
};

export const normalizeOptionalText = (value?: string): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

export const normalizeAudienceScope = (
  value: MessageAudienceScope | undefined,
): MessageAudienceScope | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === "room" || value === "team" || value === "global") {
    return value;
  }

  throw new Error("Audience scope must be room, team, or global.");
};

export const readNonEmptyPayloadString = (
  payload: Record<string, unknown>,
  key: string,
): string | null => {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
};

export type {
  ActivityRoomCatalog,
  CommandEnvelope,
  ControlRoomResolutionOptions,
};
