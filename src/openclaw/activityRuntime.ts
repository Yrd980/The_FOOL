import "./activities";
import {
  getActivityPackage,
  tryGetActivityPackage,
  type ActivityPackage,
} from "./platform/activityRegistry";
import type { ScoreAnnotations, WorldProjection } from "./platform/contracts";

export interface ActivityRoomCatalog {
  packageId: string;
  fallbackRoomId: string;
  roomIds: string[];
  aliasMap: Record<string, string>;
  labels: Record<string, string>;
}

const readInlineScoreAnnotations = (
  record: Record<string, unknown>,
): ScoreAnnotations => {
  const annotations = record.annotations;
  if (
    typeof annotations !== "object" ||
    annotations === null ||
    Array.isArray(annotations)
  ) {
    return {};
  }

  return Object.entries(annotations).reduce<ScoreAnnotations>(
    (result, [key, value]) => {
      if (typeof value === "string" && value.trim().length > 0) {
        result[key] = value.trim();
      }
      return result;
    },
    {},
  );
};

const normalizeRoomAlias = (room: string): string =>
  room.trim().toLowerCase().replace(/[\s_]+/g, "-");

const applyActivityRoomAliases = (
  aliasMap: Record<string, string>,
  aliases: Array<{ roomId: string; aliases: string[] }>,
): void => {
  for (const aliasEntry of aliases) {
    aliasMap[normalizeRoomAlias(aliasEntry.roomId)] = aliasEntry.roomId;
    for (const alias of aliasEntry.aliases) {
      aliasMap[normalizeRoomAlias(alias)] = aliasEntry.roomId;
    }
  }
};

export const buildWorldRoomCatalog = ({
  world,
  activityPackageId,
  fallbackRoomId,
}: {
  world: WorldProjection;
  activityPackageId?: string | null;
  fallbackRoomId?: string | null;
}): ActivityRoomCatalog => {
  const activityPackage = tryGetActivityPackage(activityPackageId);
  const resolvedFallbackRoomId =
    fallbackRoomId?.trim() ||
    activityPackage?.metadata?.rooms?.fallbackRoomId?.trim() ||
    world.rooms.at(-1)?.id ||
    "room";
  const roomIds = world.rooms.map((room) => room.id);
  const labels = world.rooms.reduce<Record<string, string>>((result, room) => {
    result[room.id] = room.label?.trim() || room.id;
    return result;
  }, {});
  const aliasMap = roomIds.reduce<Record<string, string>>((result, roomId) => {
    result[normalizeRoomAlias(roomId)] = roomId;
    return result;
  }, {});

  applyActivityRoomAliases(aliasMap, activityPackage?.metadata?.rooms?.aliases ?? []);

  return {
    packageId:
      activityPackage?.id ?? activityPackageId?.trim() ?? "authority-world",
    fallbackRoomId: resolvedFallbackRoomId,
    roomIds,
    aliasMap,
    labels,
  };
};

export const tryResolveActivityPackage = (
  activityPackageId?: string | null,
): ActivityPackage | undefined => tryGetActivityPackage(activityPackageId);

export const tryResolveActivityPackageId = ({
  templateId,
  previewStageId,
}: {
  templateId?: string | null;
  previewStageId?: string | null;
} = {}): string | null => {
  const templateActivityPackage = tryGetActivityPackage(templateId);
  void previewStageId;

  if (templateActivityPackage) {
    return templateActivityPackage.id;
  }

  return null;
};

export const resolveActivityPackageId = ({
  templateId,
  previewStageId,
}: {
  templateId?: string | null;
  previewStageId?: string | null;
} = {}): string | null => {
  return tryResolveActivityPackageId({ templateId, previewStageId });
};

export const tryBuildBootstrapRoomCatalog = (
  activityPackageId?: string | null,
): ActivityRoomCatalog | null => {
  const activityPackage = tryResolveActivityPackage(activityPackageId);
  if (!activityPackage) {
    return null;
  }

  return buildWorldRoomCatalog({
    world: activityPackage.bootstrap.world,
    activityPackageId: activityPackage.id,
    fallbackRoomId: activityPackage.metadata?.rooms?.fallbackRoomId,
  });
};

export const tryBuildActivityRoomCatalog = (
  activityPackageId?: string | null,
  authorityWorld?: WorldProjection | null,
): ActivityRoomCatalog | null => {
  const activityPackage = tryResolveActivityPackage(activityPackageId);
  if (!authorityWorld) {
    return null;
  }

  return buildWorldRoomCatalog({
    world: authorityWorld,
    activityPackageId: activityPackage?.id ?? activityPackageId,
    fallbackRoomId: activityPackage?.metadata?.rooms?.fallbackRoomId,
  });
};

export const getActivityScoreAnnotationKeys = (
  activityPackageId?: string | null,
): string[] => tryResolveActivityPackage(activityPackageId)?.scoreConfig?.requiredAnnotations ?? [];

export const extractActivityScoreAnnotations = (
  record: Record<string, unknown>,
  activityPackageId?: string | null,
): ScoreAnnotations => {
  const activityPackage = tryResolveActivityPackage(activityPackageId);
  return {
    ...(activityPackage?.scoreConfig?.extractLegacyAnnotations?.(record) ?? {}),
    ...readInlineScoreAnnotations(record),
  };
};

export const normalizeActivityScoreAnnotations = (
  record: Record<string, unknown>,
  activityPackageId?: string | null,
): ScoreAnnotations => {
  const activityPackage = tryResolveActivityPackage(activityPackageId);
  const annotations = extractActivityScoreAnnotations(record, activityPackageId);
  return activityPackage?.scoreConfig?.normalizeAnnotations
    ? activityPackage.scoreConfig.normalizeAnnotations(annotations)
    : annotations;
};

export const getActivityStageTemplate = ({
  activityPackageId,
  stageId,
}: {
  activityPackageId?: string | null;
  stageId: string;
}) =>
  tryResolveActivityPackage(activityPackageId)?.stageTemplates.find(
    (stageTemplate) => stageTemplate.id === stageId,
  );

export {
  getActivityPackage,
};
