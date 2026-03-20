import {
  registerActivityPackage,
  type ActivityPackage,
} from "../../platform/activityRegistry";
import { THE_FOOL_SCORE_ANNOTATION_KEYS, THE_FOOL_V1_TEMPLATE_ID } from "./constants";
import {
  theFoolScorePresentationAdapter,
  normalizeTheFoolScoreAnnotations,
  extractTheFoolLegacyScoreAnnotations,
  theFoolCliCompatAdapter,
} from "./scoring";
import {
  inferTheFoolSubmissionTeamId,
  normalizeTheFoolSubmissionData,
  theFoolPresentationAdapter,
} from "./submission";
import {
  theFoolSkillBindings,
  theFoolStageTemplates,
  theFoolSubmissionSchemas,
  theFoolWorld,
} from "./definition";
import { theFoolRoomConfig } from "./rooms";

export const theFoolV1ActivityPackage: ActivityPackage = registerActivityPackage({
  id: THE_FOOL_V1_TEMPLATE_ID,
  initialStageId: "act-1-intro",
  stageTemplates: theFoolStageTemplates,
  submissionSchemas: theFoolSubmissionSchemas,
  skillBindings: theFoolSkillBindings,
  bootstrap: {
    world: theFoolWorld,
  },
  roomConfig: theFoolRoomConfig,
  presentationAdapter: {
    ...theFoolPresentationAdapter,
    ...theFoolScorePresentationAdapter,
  },
  cliCompat: theFoolCliCompatAdapter,
  normalizeSubmissionData: normalizeTheFoolSubmissionData,
  inferSubmissionTeamId: inferTheFoolSubmissionTeamId,
  scoreConfig: {
    allowedStageIds: ["act-7-ai-judging"],
    requiredAnnotations: [
      THE_FOOL_SCORE_ANNOTATION_KEYS.favorite,
      THE_FOOL_SCORE_ANNOTATION_KEYS.mostAbsurd,
    ],
    extractLegacyAnnotations: extractTheFoolLegacyScoreAnnotations,
    normalizeAnnotations: normalizeTheFoolScoreAnnotations,
  },
});
