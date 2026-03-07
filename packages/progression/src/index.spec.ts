// Role: verifies shared progression utilities enforce level-cap semantics for all consumers.
import { describe, expect, it } from 'vitest';
import {
  getLevelFromTotalExp,
  getLevelStartExp,
  getProgressWithinLevel,
  MAX_ACCOUNT_LEVEL,
} from './index';

describe('Shared Progression Level Cap', () => {
  it('caps derived level at 100 for very large total XP', () => {
    expect(getLevelFromTotalExp(Number.MAX_SAFE_INTEGER)).toBe(MAX_ACCOUNT_LEVEL);
  });

  it('returns level 100 at the exact level-100 start threshold', () => {
    const levelHundredStartExp = getLevelStartExp(MAX_ACCOUNT_LEVEL);
    expect(getLevelFromTotalExp(levelHundredStartExp)).toBe(MAX_ACCOUNT_LEVEL);
  });

  it('returns level 99 immediately before the level-100 threshold', () => {
    const levelHundredStartExp = getLevelStartExp(MAX_ACCOUNT_LEVEL);
    expect(getLevelFromTotalExp(levelHundredStartExp - 1)).toBe(MAX_ACCOUNT_LEVEL - 1);
  });

  it('returns capped progress when total XP exceeds level-100 threshold', () => {
    const capProgress = getProgressWithinLevel(Number.MAX_SAFE_INTEGER);

    expect(capProgress.level).toBe(MAX_ACCOUNT_LEVEL);
    expect(capProgress.xpToNextLevel).toBe(0);
    expect(capProgress.progressPercent).toBe(100);
    expect(capProgress.currentLevelExp).toBe(capProgress.nextLevelExpRequired);
  });
});
