export type AccountLevelProgress = {
  level: number;
  currentLevelExp: number;
  nextLevelExpRequired: number;
  xpToNextLevel: number;
  progressPercent: number;
};

// Level start follows product rule: TotalXP(level) = 100 * (level - 1)^1.5.
export function getLevelStartExp(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level));
  return Math.floor(100 * Math.pow(normalizedLevel - 1, 1.5));
}

// Inverts the level-start formula so account progression derives from one canonical total XP value.
export function getLevelFromTotalExp(totalExp: number): number {
  const normalizedTotalExp = Math.max(0, Math.floor(totalExp));
  return Math.floor(Math.pow(normalizedTotalExp / 100, 2 / 3)) + 1;
}

// Derives current progress within level so frontend consumers do not replicate formula logic.
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
