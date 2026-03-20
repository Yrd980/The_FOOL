export {
  THE_FOOL_SCORE_ANNOTATION_KEYS,
  THE_FOOL_V1_TEMPLATE_ID,
} from "./theFoolV1/constants";
export { theFoolV1ActivityPackage } from "./theFoolV1/package";
export {
  extractTheFoolLegacyScoreAnnotations,
  normalizeTheFoolScoreAnnotations,
} from "./theFoolV1/scoring";
export {
  inferTheFoolSubmissionTeamId,
  normalizeTheFoolSubmissionData,
  normalizeTheFoolTeamProjectSubmissionData,
  type TeamProjectSubmissionData,
} from "./theFoolV1/submission";
