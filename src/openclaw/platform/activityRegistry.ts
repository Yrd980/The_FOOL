import type {
  ScoreAnnotations,
  SkillBinding,
  StageTemplate,
  SubmissionData,
  SubmissionSchema,
  WorldProjection,
} from "./contracts";

export interface ActivityScoreConfig {
  allowedStageIds?: string[];
  requiredAnnotations?: string[];
  extractLegacyAnnotations?: (
    record: Record<string, unknown>,
  ) => ScoreAnnotations;
  normalizeAnnotations?: (annotations: ScoreAnnotations) => ScoreAnnotations;
}

export interface ActivitySubmissionPresentationContext {
  schemaId?: string | null;
  data: SubmissionData | null | undefined;
}

export interface ActivityCliCompatOptionDefinition {
  canonicalKey: string;
  optionNames: string[];
  description?: string;
}

export interface ActivityPresentationAdapter {
  summarizeSubmissionLeadLine?: (
    context: ActivitySubmissionPresentationContext,
  ) => string | null;
  summarizeScoreAnnotations?: (annotations: ScoreAnnotations) => string | null;
}

export interface ActivityCliCompatAdapter {
  scoreAnnotationOptions?: ActivityCliCompatOptionDefinition[];
}

export interface ActivityRoomAliasDefinition {
  roomId: string;
  aliases: string[];
}

export interface ActivityRoomConfig {
  fallbackRoomId?: string;
  aliases?: ActivityRoomAliasDefinition[];
}

export interface ActivityBootstrapSeed {
  world: WorldProjection;
}

export interface ActivityPackage {
  id: string;
  initialStageId: string | null;
  stageTemplates: StageTemplate[];
  submissionSchemas: SubmissionSchema[];
  skillBindings: SkillBinding[];
  bootstrap: ActivityBootstrapSeed;
  normalizeSubmissionData: (
    schemaId: string,
    rawData: SubmissionData,
  ) => SubmissionData;
  inferSubmissionTeamId?: (submissionId: string) => string | undefined;
  scoreConfig?: ActivityScoreConfig;
  roomConfig?: ActivityRoomConfig;
  presentationAdapter?: ActivityPresentationAdapter;
  cliCompat?: ActivityCliCompatAdapter;
}

const activityPackages = new Map<string, ActivityPackage>();

export const registerActivityPackage = <TPackage extends ActivityPackage>(
  activityPackage: TPackage,
): TPackage => {
  activityPackages.set(activityPackage.id, activityPackage);
  return activityPackage;
};

export const getActivityPackage = (activityPackageId: string): ActivityPackage => {
  const activityPackage = activityPackages.get(activityPackageId);
  if (!activityPackage) {
    throw new Error(`Unknown activity package ${activityPackageId}.`);
  }
  return activityPackage;
};

export const tryGetActivityPackage = (
  activityPackageId: string | null | undefined,
): ActivityPackage | undefined => {
  if (!activityPackageId) {
    return undefined;
  }

  return activityPackages.get(activityPackageId);
};

export const findActivityPackageByStageId = (
  stageId: string,
): ActivityPackage | undefined =>
  [...activityPackages.values()].find((activityPackage) =>
    activityPackage.stageTemplates.some((stageTemplate) => stageTemplate.id === stageId),
  );

export const listActivityPackages = (): ActivityPackage[] =>
  [...activityPackages.values()];
