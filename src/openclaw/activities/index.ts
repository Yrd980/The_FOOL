import {
  THE_FOOL_V1_TEMPLATE_ID,
  theFoolV1ActivityPackage,
} from "./theFoolV1";

export { THE_FOOL_V1_TEMPLATE_ID, theFoolV1ActivityPackage } from "./theFoolV1";

export const DEFAULT_REFERENCE_ACTIVITY_TEMPLATE_ID = THE_FOOL_V1_TEMPLATE_ID;

export const ensureActivityPackagesRegistered = (): void => {
  void theFoolV1ActivityPackage;
};
