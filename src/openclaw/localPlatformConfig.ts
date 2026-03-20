import { THE_FOOL_V1_TEMPLATE_ID } from "./activities/theFoolV1/constants";

export interface LocalPlatformBootstrapConfig {
  defaultActivityRunId: string;
  defaultTemplateId: string;
}

export const DEFAULT_LOCAL_PLATFORM_BOOTSTRAP_CONFIG: LocalPlatformBootstrapConfig = {
  defaultActivityRunId: "activity-run-01",
  defaultTemplateId: THE_FOOL_V1_TEMPLATE_ID,
};

export const resolveLocalPlatformBootstrapConfig = ({
  activityRunId,
  templateId,
}: {
  activityRunId?: string | null;
  templateId?: string | null;
} = {}): LocalPlatformBootstrapConfig => ({
  defaultActivityRunId:
    activityRunId?.trim() || DEFAULT_LOCAL_PLATFORM_BOOTSTRAP_CONFIG.defaultActivityRunId,
  defaultTemplateId:
    templateId?.trim() || DEFAULT_LOCAL_PLATFORM_BOOTSTRAP_CONFIG.defaultTemplateId,
});
