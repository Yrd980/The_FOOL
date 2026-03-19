import {
  THE_FOOL_V1_TEMPLATE_ID,
  theFoolV1ActivityPackage,
} from "./theFoolV1";

export { THE_FOOL_V1_TEMPLATE_ID, theFoolV1ActivityPackage } from "./theFoolV1";

/**
 * Only used for local dev bootstrap when no explicit template ID is configured.
 * Must NOT be consumed at runtime by shared helpers, renderers, or the
 * orchestrator's non-bootstrap paths.
 */
export const BOOTSTRAP_REFERENCE_ACTIVITY_TEMPLATE_ID = THE_FOOL_V1_TEMPLATE_ID;

export const ensureActivityPackagesRegistered = (): void => {
  void theFoolV1ActivityPackage;
};
