import { THE_FOOL_V1_TEMPLATE_ID } from "./activities/theFoolV1/constants";

export interface LocalPlatformBootstrapConfig {
  defaultActivityRunId: string;
  defaultTemplateId: string;
}

export const resolveLocalPlatformBootstrapConfig = ({
  activityRunId,
  templateId,
}: {
  activityRunId?: string | null;
  templateId?: string | null;
}): LocalPlatformBootstrapConfig => {
  const resolvedActivityRunId = activityRunId?.trim();
  const resolvedTemplateId = templateId?.trim();
  if (!resolvedActivityRunId) {
    throw new Error("OPENCLAW_ACTIVITY_RUN_ID is required.");
  }
  if (!resolvedTemplateId) {
    throw new Error(
      `OPENCLAW_ACTIVITY_TEMPLATE_ID is required. Expected ${THE_FOOL_V1_TEMPLATE_ID} for The Fool.`,
    );
  }
  return {
    defaultActivityRunId: resolvedActivityRunId,
    defaultTemplateId: resolvedTemplateId,
  };
};
