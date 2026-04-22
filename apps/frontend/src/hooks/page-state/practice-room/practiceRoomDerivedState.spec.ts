// Verifies pure practice-room derivation helpers so the main page-state hook can
// delegate business-rule transforms without carrying that logic inline.
import { describe, expect, it } from 'vitest';
import type {
  PracticeAttemptSnapshot,
  PracticeQuestion,
  PracticeQuestionUnit,
} from '@scholarxp/api-contracts';
import {
  buildQuestionUnitNav,
  applySubmittedAttemptOverrides,
  buildQuestionRewardIndicator,
  buildQuestionRewardIndicatorMap,
  buildStreakRewardIndicators,
  parsePracticeRoomQuestionUnitIdQuery,
  parsePracticeRoomSessionIdQuery,
  readQuestionOptions,
  readSelectedOptionIndex,
  resolveFirstTryBonusStatus,
} from './practiceRoomDerivedState';

function buildQuestion(
  overrides: Partial<PracticeQuestion> = {},
): PracticeQuestion {
  return {
    id: 100,
    type: 'mcq',
    questionStem: 'Question stem',
    questionData: {
      // Match the shared MCQ contract exactly so this fixture stays aligned
      // with the tuple-based question DTO used by production code.
      options: [
        { optionText: 'Alpha', explanation: undefined },
        { optionText: 'Beta', explanation: undefined },
        { optionText: 'Gamma', explanation: undefined },
        { optionText: 'Delta', explanation: undefined },
      ],
      correctOptionIndex: 0,
    } as PracticeQuestion['questionData'],
    hint: null,
    ...overrides,
  };
}

function buildQuestionUnit(
  overrides: Partial<PracticeQuestionUnit> = {},
): PracticeQuestionUnit {
  return {
    questionUnitId: 11,
    position: 1,
    hasCorrectAttempt: null,
    coreQuestion: {
      questionId: 11,
      questionContent: buildQuestion(),
      lastAttempt: null,
    },
    ...overrides,
  };
}

describe('practiceRoomDerivedState', () => {
  it('parses only valid practice-room query params', () => {
    expect(
      parsePracticeRoomSessionIdQuery('11111111-1111-4111-8111-111111111111'),
    ).toBe('11111111-1111-4111-8111-111111111111');
    expect(parsePracticeRoomSessionIdQuery('bad-session')).toBeNull();
    expect(parsePracticeRoomSessionIdQuery(null)).toBeNull();

    expect(parsePracticeRoomQuestionUnitIdQuery('12')).toBe(12);
    expect(parsePracticeRoomQuestionUnitIdQuery('0')).toBeNull();
    expect(parsePracticeRoomQuestionUnitIdQuery('abc')).toBeNull();
    expect(parsePracticeRoomQuestionUnitIdQuery(null)).toBeNull();
  });

  it('reads selectedOptionIndex only from supported student-answer payloads', () => {
    expect(readSelectedOptionIndex({ selectedOptionIndex: 2 })).toBe(2);
    expect(readSelectedOptionIndex({ selectedOptionIndex: '2' })).toBeNull();
    expect(readSelectedOptionIndex({})).toBeNull();
    expect(readSelectedOptionIndex(null)).toBeNull();
  });

  it('normalizes MCQ and true-false question data into renderable options', () => {
    expect(
      readQuestionOptions({
        options: [{ optionText: 'One' }, { optionText: 'Two' }, { bad: true }],
      }),
    ).toEqual([{ optionText: 'One' }, { optionText: 'Two' }]);

    expect(
      readQuestionOptions({
        trueOption: { isCorrect: true, explanation: 'Because' },
        falseOption: { isCorrect: false, explanation: 'Nope' },
      }),
    ).toEqual([{ optionText: 'True' }, { optionText: 'False' }]);

    expect(readQuestionOptions({ unsupported: true })).toEqual([]);
  });

  it('overlays submitted attempts onto the server question snapshot', () => {
    const questionUnit = buildQuestionUnit();
    const overrideAttempt: PracticeAttemptSnapshot = {
      studentAnswer: { selectedOptionIndex: 1 },
      isCorrect: true,
    };

    const updatedQuestionUnit = applySubmittedAttemptOverrides(questionUnit, {
      100: overrideAttempt,
    });

    expect(updatedQuestionUnit.coreQuestion.lastAttempt).toEqual(overrideAttempt);
    expect(updatedQuestionUnit.hasCorrectAttempt).toBe(true);
  });

  it('exposes reward indicators with deterministic defaults and map lookups', () => {
    expect(buildQuestionRewardIndicator(undefined)).toEqual({
      baseQuestionExpStatus: 'available',
      firstAttemptBonusStatus: 'available',
      isBaseQuestionExpAvailable: true,
      isFirstAttemptBonusAvailable: true,
      isFirstAttemptBonusLost: false,
    });

    const byQuestionUnitId = buildQuestionRewardIndicatorMap([
      buildQuestionUnit({
        questionUnitId: 21,
        rewardState: {
          baseQuestionExpStatus: 'already_earned',
          firstAttemptBonusStatus: 'lost',
        },
      }),
    ]);

    expect(byQuestionUnitId[21]).toEqual({
      baseQuestionExpStatus: 'already_earned',
      firstAttemptBonusStatus: 'lost',
      isBaseQuestionExpAvailable: false,
      isFirstAttemptBonusAvailable: false,
      isFirstAttemptBonusLost: true,
    });
  });

  it('builds question navigation flags from question count and selected index', () => {
    expect(
      buildQuestionUnitNav({ totalQuestions: 0, selectedQuestionUnitIndex: 0 }),
    ).toEqual({
      canGoPrevious: false,
      canGoNext: false,
    });

    expect(
      buildQuestionUnitNav({ totalQuestions: 4, selectedQuestionUnitIndex: 0 }),
    ).toEqual({
      canGoPrevious: false,
      canGoNext: true,
    });

    expect(
      buildQuestionUnitNav({ totalQuestions: 4, selectedQuestionUnitIndex: 3 }),
    ).toEqual({
      canGoPrevious: true,
      canGoNext: false,
    });
  });

  it('resolves first-try bonus status from local overrides, backend reward state, and hint unlocks', () => {
    expect(
      resolveFirstTryBonusStatus({
        hasActiveQuestion: false,
        lastAttemptResult: null,
        rewardIndicator: null,
        isHintUnlocked: false,
      }),
    ).toBe('available');

    expect(
      resolveFirstTryBonusStatus({
        hasActiveQuestion: true,
        lastAttemptResult: 'first-try-correct',
        rewardIndicator: null,
        isHintUnlocked: false,
      }),
    ).toBe('earned');

    expect(
      resolveFirstTryBonusStatus({
        hasActiveQuestion: true,
        lastAttemptResult: null,
        rewardIndicator: {
          baseQuestionExpStatus: 'available',
          firstAttemptBonusStatus: 'lost',
          isBaseQuestionExpAvailable: true,
          isFirstAttemptBonusAvailable: false,
          isFirstAttemptBonusLost: true,
        },
        isHintUnlocked: false,
      }),
    ).toBe('lost');

    expect(
      resolveFirstTryBonusStatus({
        hasActiveQuestion: true,
        lastAttemptResult: null,
        rewardIndicator: null,
        isHintUnlocked: true,
      }),
    ).toBe('lost');
  });

  it('derives streak indicator tiers from eligibility, streak, and claimed rewards', () => {
    expect(
      buildStreakRewardIndicators({
        totalQuestions: 3,
        currentStreak: 3,
        claimedTiers: [],
      }),
    ).toEqual({
      isEligibleForStreakRewards: false,
      thresholds: { tier1: 3, tier2: 3, tier3: 3 },
      claimedTiers: [],
      tierStates: {
        tier1: 'inactive',
        tier2: 'inactive',
        tier3: 'inactive',
      },
    });

    expect(
      buildStreakRewardIndicators({
        totalQuestions: 10,
        currentStreak: 5,
        claimedTiers: [1],
      }),
    ).toEqual({
      isEligibleForStreakRewards: true,
      thresholds: { tier1: 3, tier2: 5, tier3: 10 },
      claimedTiers: [1],
      tierStates: {
        tier1: 'claimed',
        tier2: 'active',
        tier3: 'inactive',
      },
    });
  });
});
