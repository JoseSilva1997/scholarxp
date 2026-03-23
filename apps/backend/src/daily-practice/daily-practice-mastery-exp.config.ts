// Tunable configuration for mastery XP awarded during daily practice spaced repetition.
// Stage pools are defined as integers to avoid IEEE 754 float rounding issues (e.g., 0.35 * 700 = 244.999...).
export const MASTERY_EXP_CONFIG = {
  TOTAL_POOL: 700,

  // Integer XP budget per stage. Must sum to TOTAL_POOL.
  // ~15% / ~50% / ~35% split; adjust values directly when tuning.
  STAGE_POOLS: {
    encountered: 105,
    graduated: 350,
    retained: 245,
  },

  // Minimum FSRS stability (in days) required for the "retained" stage.
  // A stability of 7 means ~90% recall probability after 7 days.
  RETAINED_STABILITY_THRESHOLD: 7.0,
} as const;

export type MasteryStage = keyof typeof MASTERY_EXP_CONFIG.STAGE_POOLS;
