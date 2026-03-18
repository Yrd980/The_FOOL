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
  normalizeAnnotations?: (annotations: ScoreAnnotations) => ScoreAnnotations;
}

export interface ActivityPackage {
  id: string;
  initialStageId: string | null;
  stageTemplates: StageTemplate[];
  submissionSchemas: SubmissionSchema[];
  skillBindings: SkillBinding[];
  world: WorldProjection;
  normalizeSubmissionData: (
    schemaId: string,
    rawData: SubmissionData,
  ) => SubmissionData;
  inferSubmissionTeamId?: (submissionId: string) => string | undefined;
  scoreConfig?: ActivityScoreConfig;
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

export const listActivityPackages = (): ActivityPackage[] =>
  [...activityPackages.values()];
