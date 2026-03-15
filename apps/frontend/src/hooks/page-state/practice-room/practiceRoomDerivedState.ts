// Centralizes pure practice-room derivation helpers so page-state orchestration can stay
// focused on wiring hooks together while tests cover business rules in isolation.
import type {
  PracticeAttemptSnapshot,
  PracticeQuestionRewardState,
  PracticeQuestionUnit,
} from '@scholarxp/api-contracts';
import { isUuidString } from './usePracticeRoomPersistence';

// Minimal question-data shape used to render selectable options in the current practice-room panel.
export type QuestionDataWithOptions = {
  options: Array<{ optionText: string }>;
  trueOption?: { isCorrect: boolean; explanation?: string };
  falseOption?: { isCorrect: boolean; explanation?: string };
};

export type QuestionRewardIndicator = {
  baseQuestionExpStatus: 'available' | 'already_earned';
  firstAttemptBonusStatus: 'available' | 'already_earned' | 'lost';
  isBaseQuestionExpAvailable: boolean;
  isFirstAttemptBonusAvailable: boolean;
  isFirstAttemptBonusLost: boolean;
};

export type StreakTierIndicatorState = 'inactive' | 'active' | 'claimed';

export type StreakRewardIndicators = {
  isEligibleForStreakRewards: boolean;
  thresholds: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  claimedTiers: number[];
  tierStates: {
    tier1: StreakTierIndicatorState;
    tier2: StreakTierIndicatorState;
    tier3: StreakTierIndicatorState;
  };
};

export type FirstTryBonusStatus = 'available' | 'earned' | 'lost';

type LastAttemptResult = 'first-try-correct' | 'incorrect' | null;

export type QuestionUnitNav = {
  canGoPrevious: boolean;
  canGoNext: boolean;
};

// Apply local submissions over server snapshots so completion bars update instantly while query refetch catches up.
export function applySubmittedAttemptOverrides(
  questionUnit: PracticeQuestionUnit,
  submittedAttemptByContentId: Record<number, PracticeAttemptSnapshot | null>,
): PracticeQuestionUnit {
  const coreContentId = questionUnit.coreQuestion.questionContent.id;
  const hasCoreAttemptOverride = Object.prototype.hasOwnProperty.call(
    submittedAttemptByContentId,
    coreContentId,
  );
  const coreAttemptOverride = submittedAttemptByContentId[coreContentId];
  const coreQuestion = {
    ...questionUnit.coreQuestion,
    lastAttempt: hasCoreAttemptOverride
      ? coreAttemptOverride
      : questionUnit.coreQuestion.lastAttempt,
  };

  // Navbar status must represent the latest core attempt outcome, not historical correctness.
  const hasCorrectAttempt = coreQuestion.lastAttempt?.isCorrect === true ? true : null;

  return {
    ...questionUnit,
    hasCorrectAttempt,
    coreQuestion,
  };
}

// Student-answer payloads differ by question type; this helper safely extracts
// MCQ/true-false selectedOptionIndex values when available.
export function readSelectedOptionIndex(studentAnswer: unknown): number | null {
  if (!studentAnswer || typeof studentAnswer !== 'object') {
    return null;
  }
  const candidate = studentAnswer as { selectedOptionIndex?: unknown };
  if (typeof candidate.selectedOptionIndex !== 'number') {
    return null;
  }
  return candidate.selectedOptionIndex;
}

// Normalise question data into a flat option list for rendering.
// Unknown or unsupported question schemas return an empty list safely.
export function readQuestionOptions(
  questionData: unknown,
): Array<{ optionText: string }> {
  if (!questionData || typeof questionData !== 'object') {
    return [];
  }

  const candidate = questionData as Partial<QuestionDataWithOptions>;
  if (!Array.isArray(candidate.options)) {
    // New true/false payloads do not store free-form option text; labels are fixed for rendering.
    if (
      candidate.trueOption &&
      typeof candidate.trueOption === 'object' &&
      candidate.falseOption &&
      typeof candidate.falseOption === 'object'
    ) {
      return [{ optionText: 'True' }, { optionText: 'False' }];
    }
    return [];
  }

  return candidate.options.filter(
    (option): option is { optionText: string } =>
      Boolean(option) &&
      typeof option === 'object' &&
      typeof option.optionText === 'string',
  );
}

// URL query-param parsers validate user-controlled strings before they become query inputs.
export function parsePracticeRoomSessionIdQuery(
  sessionIdParam: string | null,
): string | null {
  if (!sessionIdParam) {
    return null;
  }
  if (!isUuidString(sessionIdParam)) {
    return null;
  }
  return sessionIdParam;
}

export function parsePracticeRoomQuestionUnitIdQuery(
  questionIdParam: string | null,
): number | null {
  if (!questionIdParam) {
    return null;
  }
  const parsedQuestionId = Number(questionIdParam);
  if (!Number.isInteger(parsedQuestionId) || parsedQuestionId <= 0) {
    return null;
  }
  return parsedQuestionId;
}

// Reward-state defaults keep UI indicator rendering deterministic even when
// older API responses omit the new rewardState field.
export function buildQuestionRewardIndicator(
  rewardState: PracticeQuestionRewardState | undefined,
): QuestionRewardIndicator {
  const normalizedRewardState = rewardState ?? {
    baseQuestionExpStatus: 'available',
    firstAttemptBonusStatus: 'available',
  };
  return {
    ...normalizedRewardState,
    isBaseQuestionExpAvailable:
      normalizedRewardState.baseQuestionExpStatus === 'available',
    isFirstAttemptBonusAvailable:
      normalizedRewardState.firstAttemptBonusStatus === 'available',
    isFirstAttemptBonusLost:
      normalizedRewardState.firstAttemptBonusStatus === 'lost',
  };
}

// Mapping once by question-unit id avoids repeated array scans when page code
// needs both active-question and nav-level indicator lookups.
export function buildQuestionRewardIndicatorMap(
  questions: PracticeQuestionUnit[],
): Record<number, QuestionRewardIndicator> {
  const result: Record<number, QuestionRewardIndicator> = {};
  for (const question of questions) {
    result[question.questionUnitId] = buildQuestionRewardIndicator(
      question.rewardState,
    );
  }
  return result;
}

// Keeps prev/next button state derived from the same room-length rules everywhere
// so navigation UI does not have to duplicate clamping logic.
export function buildQuestionUnitNav(input: {
  totalQuestions: number;
  selectedQuestionUnitIndex: number;
}): QuestionUnitNav {
  if (input.totalQuestions <= 0) {
    return { canGoPrevious: false, canGoNext: false };
  }

  return {
    canGoPrevious: input.selectedQuestionUnitIndex > 0,
    canGoNext: input.selectedQuestionUnitIndex < input.totalQuestions - 1,
  };
}

// Derives first-try-bonus status from optimistic local state first, then backend
// reward snapshots, so the UI stays responsive without duplicating reward rules.
export function resolveFirstTryBonusStatus(input: {
  hasActiveQuestion: boolean;
  lastAttemptResult: LastAttemptResult;
  rewardIndicator: QuestionRewardIndicator | null;
  isHintUnlocked: boolean;
}): FirstTryBonusStatus {
  if (!input.hasActiveQuestion) {
    return 'available';
  }
  if (input.lastAttemptResult === 'first-try-correct') {
    return 'earned';
  }
  if (input.lastAttemptResult === 'incorrect') {
    return 'lost';
  }
  if (input.rewardIndicator?.firstAttemptBonusStatus === 'already_earned') {
    return 'earned';
  }
  if (input.rewardIndicator?.firstAttemptBonusStatus === 'lost') {
    return 'lost';
  }
  // Hint unlock forfeits first-try bonus before submit, so the indicator should
  // reflect the assisted state immediately rather than waiting for the API round-trip.
  if (input.isHintUnlocked) {
    return 'lost';
  }
  return 'available';
}

// Derives UI-tier state from session streak + lifetime claim state without
// requiring the UI layer to duplicate reward math.
export function buildStreakRewardIndicators(input: {
  totalQuestions: number;
  currentStreak: number;
  claimedTiers: number[];
}): StreakRewardIndicators {
  const isEligibleForStreakRewards = input.totalQuestions >= 4;
  const thresholds = resolveStreakThresholds(input.totalQuestions);
  if (!isEligibleForStreakRewards) {
    return {
      isEligibleForStreakRewards: false,
      thresholds,
      claimedTiers: input.claimedTiers,
      tierStates: {
        tier1: 'inactive',
        tier2: 'inactive',
        tier3: 'inactive',
      },
    };
  }

  const claimedTierSet = new Set(input.claimedTiers);
  return {
    isEligibleForStreakRewards: true,
    thresholds,
    claimedTiers: input.claimedTiers,
    tierStates: {
      tier1: resolveStreakTierIndicatorState(
        input.currentStreak,
        thresholds.tier1,
        claimedTierSet.has(1),
      ),
      tier2: resolveStreakTierIndicatorState(
        input.currentStreak,
        thresholds.tier2,
        claimedTierSet.has(2),
      ),
      tier3: resolveStreakTierIndicatorState(
        input.currentStreak,
        thresholds.tier3,
        claimedTierSet.has(3),
      ),
    },
  };
}

// Keep thresholds aligned with backend ExpCalculationService so indicator states
// and reward behavior remain consistent.
function resolveStreakThresholds(totalQuestions: number) {
  return {
    tier1: Math.max(3, Math.ceil(totalQuestions * 0.3)),
    tier2: Math.max(3, Math.ceil(totalQuestions * 0.5)),
    tier3: Math.max(3, totalQuestions),
  };
}

function resolveStreakTierIndicatorState(
  currentStreak: number,
  threshold: number,
  isClaimed: boolean,
): StreakTierIndicatorState {
  if (isClaimed) {
    return 'claimed';
  }
  if (currentStreak >= threshold) {
    return 'active';
  }
  return 'inactive';
}
