export const RECOMMEND_EVERYONE_PRIORITY_BONUS = 1_000_000;
export const MAX_RECOMMENDATION_BOOST_PERCENT = 2_147_483_647;

export function normalizeRecommendationBoostPercent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(MAX_RECOMMENDATION_BOOST_PERCENT, Math.max(0, Math.trunc(numeric)));
}

export function recommendationBoostMultiplier(boostPercent: unknown) {
  return 1 + normalizeRecommendationBoostPercent(boostPercent) / 100;
}

export function calculateCompanyRecommendationScore(input: {
  baseScore: number;
  boostPercent: unknown;
  recommendForEveryone?: boolean;
}) {
  const baseScore = Math.max(0, Number.isFinite(input.baseScore) ? input.baseScore : 0);
  const boostedScore = Math.round(baseScore * recommendationBoostMultiplier(input.boostPercent));
  return input.recommendForEveryone ? boostedScore + RECOMMEND_EVERYONE_PRIORITY_BONUS : boostedScore;
}
