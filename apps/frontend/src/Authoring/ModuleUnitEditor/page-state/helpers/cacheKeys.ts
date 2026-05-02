// Builds cache keys for per-question and per-variant form snapshots used across editor hooks.
// Identifies cached form state for a question's core content.
export const coreCacheKey = (questionId: string) => `${questionId}-core`;

// Identifies cached form state for a specific variant under a question.
export const variantCacheKey = (questionId: string, variantId: string) =>
  `${questionId}-variant-${variantId}`;
