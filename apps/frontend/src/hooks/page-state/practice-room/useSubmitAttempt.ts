// Manages everything related to sending an answer for the active question in
// a practice room. This includes assembling the API payload, handling the
// mutation result, updating local state optimistically, and providing helpers
// for retrying a question. Placing all of this logic here keeps
// `usePracticeRoomPageState` simpler and lets tests target submission rules
// in isolation.
import { useEffect, useRef, useState } from 'react';
import type {
  PracticeAttemptSnapshot,
  PracticeQuestionUnit,
  StudentAnswer,
  SubmitAttemptPayload,
  SubmitAttemptResponse,
} from '@scholarxp/api-contracts';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../../api/get-display-error';
import { logError } from '../../../utils/logger';
import type { ProgressModuleDetail, ExpBreakdown } from './useModuleProgressAnimation';
import type { ActivePracticeQuestion } from './usePracticeRoomInteractionState';

type FirstTryBonusStatus = 'available' | 'earned' | 'lost';

// Parameters are almost entirely derived from the parent page state; this
// hook never mutates them except via the two setter callbacks at the bottom.
// keeping the shape explicit helps unit tests feed realistic props during
// failure scenarios.

type UseSubmitAttemptParams = {
  // Active room/question context — all read-only inputs from the parent.
  room: {
    sessionId: string;
    moduleUnitId: number;
    questions: PracticeQuestionUnit[];
  } | null;
  activeQuestionUnit: PracticeQuestionUnit | null;
  activeQuestion: ActivePracticeQuestion | null;
  isRoomReadOnly: boolean;
  selectedOptionIndex: number | null;
  isActiveHintUnlocked: boolean;
  // Timing refs shared with the view-duration tracking effect in the parent.
  activeContentIdRef: React.RefObject<number | null>;
  activeContentViewStartMsRef: React.RefObject<number | null>;
  // TanStack mutation surface — only the minimum the hook actually needs.
  mutateAsync: (payload: SubmitAttemptPayload) => Promise<SubmitAttemptResponse>;
  isPending: boolean;
  // XP callbacks supplied by parent hooks.
  applyExpAward: (breakdown: ExpBreakdown, detail: ProgressModuleDetail | null) => void;
  moduleDetail: ProgressModuleDetail | null;
  // Query/cache synchronization is injected so callers can defer global UI updates
  // during the unit-completion celebration without changing mutation ownership.
  syncAttemptSuccessEffects: (response: SubmitAttemptResponse) => Promise<void>;
  // Streak callback: called after every successful submission with both the live streak
  // and the all-time session high. Optional so callers that don't display streak can omit it.
  updateCurrentStreak?: (currentStreak: number, highestStreak: number) => void;
  // Accuracy callback: called after every submission to update the first-try accuracy indicator.
  // 'first-try-correct' when firstAttemptBonus > 0, 'incorrect' when the attempt was wrong.
  // `null` clears stale state (used when a retry becomes correct but not first-try).
  // Optional so callers that don't show the indicator can omit it.
  updateLastAttemptResult?: (
    contentId: number,
    result: 'first-try-correct' | 'incorrect' | null,
  ) => void;
  // Resolved first-try bonus state for the active question before this submit.
  // This lets submit handling preserve earned/lost states across retries instead
  // of incorrectly tying the indicator to latest answer correctness.
  activeFirstTryBonusStatus: FirstTryBonusStatus;
  // Clears the transient local draft selection after a successful submission so
  // UI feedback switches back to the just-submitted attempt snapshot.
  clearSelectedOptionOverride?: (contentId: number) => void;
  // Records that a question has now been submitted for this specific session so
  // reload-resume behavior and button locking stay aligned with backend progress.
  markQuestionSubmitted: (sessionId: string, contentId: number) => void;
  // Records the latest attempt snapshot for a question so optimistic UI can
  // update immediately without exposing state-shape details to this hook.
  recordSubmittedAttempt: (
    contentId: number,
    attempt: PracticeAttemptSnapshot | null,
  ) => void;
  // Completion celebration is page-level UI, so this hook only reports the event
  // and leaves modal timing/dismissal policy to the parent page-state hook.
  onModuleUnitCompleted?: (input: {
    moduleExpBreakdown: ExpBreakdown;
    submitResponse: SubmitAttemptResponse;
  }) => void;
  // Retry/view-answer rooms should never replay the first-time completion celebration.
  shouldCelebrateModuleUnitCompletion?: boolean;
  // For error logging context only.
  parsedModuleId: number | null;
  parsedUnitId: number | null;
};

type UseSubmitAttemptResult = {
  submitErrorMessage: string | null;
  // Proxied from isPending so callers don't need to maintain a separate ref.
  isSubmittingAttempt: boolean;
  canSubmitAttempt: boolean;
  submitActiveQuestionAttempt: () => Promise<void>;
};

const SUBMIT_COOLDOWN_MS = 1_000;

// `hasCorrectAttempt` is historical ("ever correct") and can stay true after a new
// incorrect retry. For UI that reflects the latest submission, derive correctness
// from backend-owned award reasons when available.
function resolveLatestAttemptCorrectness(response: SubmitAttemptResponse): boolean {
  const baseReason = response.awardReasons?.baseQuestionExp;
  if (baseReason === 'incorrect') {
    return false;
  }
  if (baseReason === 'awarded' || baseReason === 'already_earned') {
    return true;
  }
  // Backward-compatible fallback for payloads that do not include award reasons.
  return response.hasCorrectAttempt;
}

// Completion should trigger only when this submission leaves no unsolved questions.
// rewardState stays authoritative for "already solved before a later retry" cases.
function didModuleUnitCompleteOnSubmit(input: {
  questions: PracticeQuestionUnit[];
  activeQuestionUnitId: number;
  latestAttemptIsCorrect: boolean;
}): boolean {
  if (!input.latestAttemptIsCorrect) {
    return false;
  }

  return input.questions.every((questionUnit) => {
    if (questionUnit.questionUnitId === input.activeQuestionUnitId) {
      return true;
    }

    return (
      questionUnit.rewardState?.baseQuestionExpStatus === 'already_earned' ||
      questionUnit.hasCorrectAttempt === true ||
      questionUnit.coreQuestion.lastAttempt?.isCorrect === true
    );
  });
}

// Converts a stable first-try status into the local override representation.
function mapFirstTryStatusToLocalResult(
  status: FirstTryBonusStatus,
): 'first-try-correct' | 'incorrect' | null {
  if (status === 'earned') {
    return 'first-try-correct';
  }
  if (status === 'lost') {
    return 'incorrect';
  }
  return null;
}

// Determines the next first-try indicator state from backend-owned reason codes
// and current status so retries never overwrite historical earned/lost outcomes.
function resolveNextFirstTryLocalResult(input: {
  response: SubmitAttemptResponse;
  latestAttemptIsCorrect: boolean;
  currentStatus: FirstTryBonusStatus;
}): 'first-try-correct' | 'incorrect' | null {
  const firstTryReason = input.response.awardReasons?.firstAttemptBonus;
  if (firstTryReason === 'awarded' || firstTryReason === 'already_earned') {
    return 'first-try-correct';
  }
  if (firstTryReason === 'incorrect') {
    return input.currentStatus === 'earned' ? 'first-try-correct' : 'incorrect';
  }
  if (firstTryReason === 'hint_used') {
    // Hint on first submit forfeits first-try bonus, but should not override an already-earned state.
    return input.currentStatus === 'earned' ? 'first-try-correct' : 'incorrect';
  }
  if (firstTryReason === 'not_first_try') {
    return mapFirstTryStatusToLocalResult(input.currentStatus);
  }

  // Fallback for payloads without award reasons.
  if (input.response.awards.firstAttemptBonus > 0) {
    return 'first-try-correct';
  }
  if (input.currentStatus === 'available') {
    return input.latestAttemptIsCorrect ? 'first-try-correct' : 'incorrect';
  }
  return mapFirstTryStatusToLocalResult(input.currentStatus);
}

export function useSubmitAttempt({
  room,
  activeQuestionUnit,
  activeQuestion,
  isRoomReadOnly,
  selectedOptionIndex,
  isActiveHintUnlocked,
  activeContentIdRef,
  activeContentViewStartMsRef,
  mutateAsync,
  isPending,
  applyExpAward,
  moduleDetail,
  syncAttemptSuccessEffects,
  updateCurrentStreak,
  updateLastAttemptResult,
  activeFirstTryBonusStatus,
  clearSelectedOptionOverride,
  markQuestionSubmitted,
  recordSubmittedAttempt,
  onModuleUnitCompleted,
  shouldCelebrateModuleUnitCompletion = false,
  parsedModuleId,
  parsedUnitId,
}: UseSubmitAttemptParams): UseSubmitAttemptResult {
  // Build a structured XP breakdown from the awards payload so `applyExpAward` can
  // expose each source (base, first-attempt, streak) to the indicator UI.
  const buildExpBreakdown = (response: SubmitAttemptResponse): ExpBreakdown => {
    const { baseQuestionExp, firstAttemptBonus, streakBonus } = response.awards;
    return {
      base: baseQuestionExp,
      firstAttemptBonus,
      streakBonus,
      total: baseQuestionExp + firstAttemptBonus + streakBonus,
    };
  };

  // holds any error returned when the submission fails; surfaced to UI.
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  // Cooldown blocks rapid repeat submissions after a successful attempt to
  // reduce accidental double-submits and high-frequency spam.
  const [isSubmitCooldownActive, setIsSubmitCooldownActive] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current !== null) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const startSubmitCooldown = () => {
    setIsSubmitCooldownActive(true);
    if (cooldownTimerRef.current !== null) {
      clearTimeout(cooldownTimerRef.current);
    }
    cooldownTimerRef.current = setTimeout(() => {
      setIsSubmitCooldownActive(false);
      cooldownTimerRef.current = null;
    }, SUBMIT_COOLDOWN_MS);
  };

  // derived boolean that encapsulates all guard conditions preventing
  // a submission; keeps callers simple (no need to recompute this logic
  // themselves when disabling buttons).
  const canSubmitAttempt =
    Boolean(room && activeQuestionUnit && activeQuestion) &&
    !isRoomReadOnly &&
    selectedOptionIndex !== null &&
    !isSubmitCooldownActive &&
    !isPending;

  // called when user presses the submit button. it re-checks guard
  // conditions (defensive in case callers forget) then builds the
  // payload including view duration and hint state.
  const submitActiveQuestionAttempt = async () => {
    if (
      !room ||
      !activeQuestionUnit ||
      !activeQuestion ||
      isRoomReadOnly ||
      selectedOptionIndex === null ||
      isSubmitCooldownActive
    ) {
      return;
    }

    const studentAnswer: StudentAnswer = { selectedOptionIndex };
    const nowMs = Date.now();
    const viewStartedAtMs =
      activeContentIdRef.current === activeQuestion.question.id &&
      activeContentViewStartMsRef.current !== null
        ? activeContentViewStartMsRef.current
        : nowMs;

    const payload: SubmitAttemptPayload = {
      moduleUnitId: room.moduleUnitId,
      questionUnitId: activeQuestionUnit.questionUnitId,
      questionContentId: activeQuestion.question.id,
      sessionId: room.sessionId,
      // MVP uses view duration (content shown → submit). Interaction-duration can
      // be added as a second metric later.
      timeTakenMs: Math.max(0, nowMs - viewStartedAtMs),
      hintUnlocked: isActiveHintUnlocked,
      studentAnswer,
    };

    setSubmitErrorMessage(null);

    try {
      const submitResponse = await mutateAsync(payload);
      const latestAttemptIsCorrect =
        resolveLatestAttemptCorrectness(submitResponse);
      const breakdown = buildExpBreakdown(submitResponse);
      const hasCompletedModuleUnit =
        shouldCelebrateModuleUnitCompletion &&
        didModuleUnitCompleteOnSubmit({
          questions: room.questions,
          activeQuestionUnitId: activeQuestionUnit.questionUnitId,
          latestAttemptIsCorrect,
        });
      // Relay both streak values to the parent so StreakIndicator can show
      // pip state without a separate server call. Both values must be present;
      // if either is absent (e.g. older API version) the callback is skipped.
      if (
        updateCurrentStreak !== undefined &&
        submitResponse.currentStreak !== undefined &&
        submitResponse.highestStreak !== undefined
      ) {
        updateCurrentStreak(submitResponse.currentStreak, submitResponse.highestStreak);
      }
      // Inform the accuracy indicator: green if firstAttemptBonus was awarded (first-try
      // correct), red if first-try was missed. Retries preserve earned/lost state;
      // they must not rebind the indicator to latest answer correctness.
      if (updateLastAttemptResult !== undefined) {
        const nextFirstTryResult = resolveNextFirstTryLocalResult({
          response: submitResponse,
          latestAttemptIsCorrect,
          currentStatus: activeFirstTryBonusStatus,
        });
        updateLastAttemptResult(activeQuestion.question.id, nextFirstTryResult);
      }
      recordSubmittedAttempt(activeQuestion.question.id, {
        studentAnswer,
        // Track latest-attempt correctness so nav/status UI reflects this submit.
        isCorrect: latestAttemptIsCorrect,
      });
      markQuestionSubmitted(room.sessionId, activeQuestion.question.id);
      clearSelectedOptionOverride?.(activeQuestion.question.id);
      startSubmitCooldown();
      if (hasCompletedModuleUnit && onModuleUnitCompleted) {
        onModuleUnitCompleted({
          moduleExpBreakdown: breakdown,
          submitResponse,
        });
        return;
      }
      if (breakdown.total > 0) {
        // Delegate the animation target update, double-count guard, and level-up
        // celebration to the progress hook so this handler stays focused on
        // attempt business logic.
        applyExpAward(breakdown, moduleDetail);
      }
      void syncAttemptSuccessEffects(submitResponse);
    } catch (error) {
      const message = getDisplayErrorMessage(error, {
        fallbackMessage:
          'We could not submit your answer right now. Please try again.',
      });
      setSubmitErrorMessage(message);
      if (shouldLogApiError(error)) {
        logError(error, {
          feature: 'practice-room',
          action: 'submit-attempt',
          moduleId: parsedModuleId,
          unitId: parsedUnitId,
        });
      }
    }
  };

  return {
    submitErrorMessage,
    isSubmittingAttempt: isPending,
    canSubmitAttempt,
    submitActiveQuestionAttempt,
  };
}
