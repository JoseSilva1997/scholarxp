// Builds cache keys for per-question and per-variant form snapshots used across editor hooks.
export const coreCacheKey = (questionId: string) => `${questionId}-core`;

export const variantCacheKey = (questionId: string, variantId: string) =>
  `${questionId}-variant-${variantId}`;
