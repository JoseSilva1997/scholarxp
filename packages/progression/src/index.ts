// Shared account progression utilities so backend and frontend derive level state from one canonical formula.
export * from './cosmetics';

export type AccountLevelProgress = {
  level: number;
  currentLevelExp: number;
  nextLevelExpRequired: number;
  xpToNextLevel: number;
  progressPercent: number;
};

// Product rule: account progression is capped at level 100.
export const MAX_ACCOUNT_LEVEL = 100;

// Uses the product curve rule: total XP at level N starts at floor(100 * (N - 1)^1.5).
export function getLevelStartExp(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level));
  return Math.floor(100 * Math.pow(normalizedLevel - 1, 1.5));
}

// Inverts the level-start curve so any total XP can deterministically map to a level.
export function getLevelFromTotalExp(totalExp: number): number {
  const normalizedTotalExp = Math.max(0, Math.floor(totalExp));
  // Start from the closed-form inverse, then correct around boundaries because level starts are floored integers.
  let derivedLevel = Math.floor(Math.pow(normalizedTotalExp / 100, 2 / 3)) + 1;
  derivedLevel = Math.max(1, Math.min(MAX_ACCOUNT_LEVEL, derivedLevel));

  // If inverse landed below an exact threshold, move up until next threshold is above total XP.
  while (
    derivedLevel < MAX_ACCOUNT_LEVEL &&
    getLevelStartExp(derivedLevel + 1) <= normalizedTotalExp
  ) {
    derivedLevel += 1;
  }

  // If inverse overshot due to rounding/flooring artifacts, move down until level start fits total XP.
  while (derivedLevel > 1 && getLevelStartExp(derivedLevel) > normalizedTotalExp) {
    derivedLevel -= 1;
  }

  return derivedLevel;
}

// Derives level, in-level XP, and percentage snapshot from a single total XP source of truth.
export function getProgressWithinLevel(totalExp: number): AccountLevelProgress {
  const normalizedTotalExp = Math.max(0, Math.floor(totalExp));
  const level = getLevelFromTotalExp(normalizedTotalExp);
  // Clamp cap-state progress to full so UI bars/labels stay stable once max level is reached.
  if (level >= MAX_ACCOUNT_LEVEL) {
    const levelStartExp = getLevelStartExp(MAX_ACCOUNT_LEVEL);
    const nextLevelStartExp = getLevelStartExp(MAX_ACCOUNT_LEVEL + 1);
    const nextLevelExpRequired = Math.max(1, nextLevelStartExp - levelStartExp);

    return {
      level: MAX_ACCOUNT_LEVEL,
      currentLevelExp: nextLevelExpRequired,
      nextLevelExpRequired,
      xpToNextLevel: 0,
      progressPercent: 100,
    };
  }

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
