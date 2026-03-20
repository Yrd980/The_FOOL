import {
  THE_FOOL_V1_TEMPLATE_ID,
  theFoolV1ActivityPackage,
} from "./theFoolV1";

export { THE_FOOL_V1_TEMPLATE_ID, theFoolV1ActivityPackage } from "./theFoolV1";

export const BUILTIN_ACTIVITY_PACKAGE_IDS = [THE_FOOL_V1_TEMPLATE_ID] as const;

export const ensureActivityPackagesRegistered = (): void => {
  void theFoolV1ActivityPackage;
};
