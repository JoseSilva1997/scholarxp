// Shared account progression utilities so backend and frontend derive level state from one canonical formula.
export type AccountLevelProgress = {
  level: number;
  currentLevelExp: number;
  nextLevelExpRequired: number;
  xpToNextLevel: number;
  progressPercent: number;
};

// Uses the product curve rule: total XP at level N starts at floor(100 * (N - 1)^1.5).
export function getLevelStartExp(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level));
  return Math.floor(100 * Math.pow(normalizedLevel - 1, 1.5));
}

// Inverts the level-start curve so any total XP can deterministically map to a level.
export function getLevelFromTotalExp(totalExp: number): number {
  const normalizedTotalExp = Math.max(0, Math.floor(totalExp));
  return Math.floor(Math.pow(normalizedTotalExp / 100, 2 / 3)) + 1;
}

// Derives level, in-level XP, and percentage snapshot from a single total XP source of truth.
export function getProgressWithinLevel(totalExp: number): AccountLevelProgress {
  const normalizedTotalExp = Math.max(0, Math.floor(totalExp));
  const level = getLevelFromTotalExp(normalizedTotalExp);
  const levelStartExp = getLevelStartExp(level);
  const nextLevelStartExp = getLevelStartExp(level + 1);
  const currentLevelExp = normalizedTotalExp - levelStartExp;
  const nextLevelExpRequired = Math.max(1, nextLevelStartExp - levelStartExp);
  const xpToNextLevel = Math.max(0, nextLevelStartExp - normalizedTotalExp);
  const progressPercent = Math.max(
    0,
    Math.min(100, (currentLevelExp / nextLevelExpRequired) * 100),
  );

  return {
    level,
    currentLevelExp,
    nextLevelExpRequired,
    xpToNextLevel,
    progressPercent,
  };
}
