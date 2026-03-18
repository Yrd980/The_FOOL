import "./activities";
import {
  findActivityPackageByStageId,
  getActivityPackage,
  getDefaultActivityPackage,
  tryGetActivityPackage,
  type ActivityPackage,
} from "./platform/activityRegistry";
import type { ScoreAnnotations } from "./platform/contracts";

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

const buildActivityRoomCatalogFromPackage = (
  activityPackage: ActivityPackage,
): ActivityRoomCatalog => {
  const fallbackRoomId =
    activityPackage.metadata?.rooms?.fallbackRoomId?.trim() ||
    activityPackage.world.rooms.at(-1)?.id ||
    "room";
  const roomIds = activityPackage.world.rooms.map((room) => room.id);
  const labels = activityPackage.world.rooms.reduce<Record<string, string>>(
    (result, room) => {
      result[room.id] = room.label?.trim() || room.id;
      return result;
    },
    {},
  );
  const aliasMap = roomIds.reduce<Record<string, string>>((result, roomId) => {
    result[normalizeRoomAlias(roomId)] = roomId;
    return result;
  }, {});

  for (const aliasEntry of activityPackage.metadata?.rooms?.aliases ?? []) {
    aliasMap[normalizeRoomAlias(aliasEntry.roomId)] = aliasEntry.roomId;
    for (const alias of aliasEntry.aliases) {
      aliasMap[normalizeRoomAlias(alias)] = aliasEntry.roomId;
    }
  }

  return {
    packageId: activityPackage.id,
    fallbackRoomId,
    roomIds,
    aliasMap,
    labels,
  };
};

export const resolveActivityPackage = (
  activityPackageId?: string | null,
): ActivityPackage =>
  tryGetActivityPackage(activityPackageId) ?? getDefaultActivityPackage();

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
  if (
    previewStageId &&
    templateActivityPackage?.stageTemplates.some(
      (stageTemplate) => stageTemplate.id === previewStageId,
    )
  ) {
    return templateActivityPackage.id;
  }

  if (previewStageId) {
    const previewActivityPackage = findActivityPackageByStageId(previewStageId);
    if (previewActivityPackage) {
      return previewActivityPackage.id;
    }
  }

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
} = {}): string => {
  return (
    tryResolveActivityPackageId({
      templateId,
      previewStageId,
    }) ?? getDefaultActivityPackage().id
  );
};

export const buildActivityRoomCatalog = (
  activityPackageId?: string | null,
): ActivityRoomCatalog =>
  buildActivityRoomCatalogFromPackage(resolveActivityPackage(activityPackageId));

export const tryBuildActivityRoomCatalog = (
  activityPackageId?: string | null,
): ActivityRoomCatalog | null => {
  const activityPackage = tryResolveActivityPackage(activityPackageId);
  return activityPackage ? buildActivityRoomCatalogFromPackage(activityPackage) : null;
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
  resolveActivityPackage(activityPackageId).stageTemplates.find(
    (stageTemplate) => stageTemplate.id === stageId,
  );

export {
  findActivityPackageByStageId,
  getActivityPackage,
  getDefaultActivityPackage,
};
