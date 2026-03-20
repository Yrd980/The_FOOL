import type {
  ActivityCliCompatAdapter,
  ActivityPresentationAdapter,
} from "../../platform/activityRegistry";
import type { ScoreAnnotations } from "../../platform/contracts";
import { THE_FOOL_SCORE_ANNOTATION_KEYS } from "./constants";

export const normalizeTheFoolScoreAnnotations = (
  annotations: ScoreAnnotations,
): ScoreAnnotations => {
  const favorite =
    annotations[THE_FOOL_SCORE_ANNOTATION_KEYS.favorite]?.trim() ?? "";
  const mostAbsurd =
    annotations[THE_FOOL_SCORE_ANNOTATION_KEYS.mostAbsurd]?.trim() ?? "";

  if (!favorite || !mostAbsurd) {
    throw new Error(
      "submit_score requires non-empty favorite and mostAbsurd annotations.",
    );
  }

  return {
    [THE_FOOL_SCORE_ANNOTATION_KEYS.favorite]: favorite,
    [THE_FOOL_SCORE_ANNOTATION_KEYS.mostAbsurd]: mostAbsurd,
  };
};

export const extractTheFoolLegacyScoreAnnotations = (
  record: Record<string, unknown>,
): ScoreAnnotations => {
  const favoriteValue = record[THE_FOOL_SCORE_ANNOTATION_KEYS.favorite];
  const mostAbsurdValue = record[THE_FOOL_SCORE_ANNOTATION_KEYS.mostAbsurd];
  const favorite =
    typeof favoriteValue === "string"
      ? favoriteValue.trim()
      : "";
  const mostAbsurd =
    typeof mostAbsurdValue === "string"
      ? mostAbsurdValue.trim()
      : "";

  return {
    ...(favorite
      ? { [THE_FOOL_SCORE_ANNOTATION_KEYS.favorite]: favorite }
      : {}),
    ...(mostAbsurd
      ? { [THE_FOOL_SCORE_ANNOTATION_KEYS.mostAbsurd]: mostAbsurd }
      : {}),
  };
};

export const theFoolScorePresentationAdapter: ActivityPresentationAdapter = {
  summarizeScoreAnnotations: (annotations: ScoreAnnotations): string | null => {
    const favorite = annotations.favorite?.trim();
    const mostAbsurd = annotations.mostAbsurd?.trim();
    const pieces = [
      favorite ? `favorite: ${favorite}` : null,
      mostAbsurd ? `mostAbsurd: ${mostAbsurd}` : null,
    ].filter((value): value is string => Boolean(value));

    return pieces.length > 0 ? pieces.join(" · ") : null;
  },
};

export const theFoolCliCompatAdapter: ActivityCliCompatAdapter = {
  scoreAnnotationOptions: [
    {
      canonicalKey: THE_FOOL_SCORE_ANNOTATION_KEYS.favorite,
      optionNames: ["favorite"],
      description: "--favorite <text>",
    },
    {
      canonicalKey: THE_FOOL_SCORE_ANNOTATION_KEYS.mostAbsurd,
      optionNames: ["most-absurd", "weirdest", "absurd"],
      description:
        "--most-absurd <text> (aliases --weirdest / --absurd)",
    },
  ],
};
