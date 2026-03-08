// Manages everything related to sending an answer for the active question in
// a practice room. This includes assembling the API payload, handling the
// mutation result, updating local state optimistically, and providing helpers
// for retrying a question. Placing all of this logic here keeps
// `usePracticeRoomPageState` simpler and lets tests target submission rules
// in isolation.
import { useState } from 'react';
import type {
  PracticeAttemptSnapshot,
  PracticeQuestion,
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

// lightweight wrapper so callers only need to provide the question
// itself (not the entire unit).
type ActiveQuestion = {
  question: PracticeQuestion;
};

// Parameters are almost entirely derived from the parent page state; this
// hook never mutates them except via the two setter callbacks at the bottom.
// keeping the shape explicit helps unit tests feed realistic props during
// failure scenarios.

type UseSubmitAttemptParams = {
  // Active room/question context — all read-only inputs from the parent.
  room: { sessionId: string; moduleUnitId: number } | null;
  activeQuestionUnit: PracticeQuestionUnit | null;
  activeQuestion: ActiveQuestion | null;
  isRoomReadOnly: boolean;
  selectedOptionIndex: number | null;
  hasSubmittedActiveQuestion: boolean;
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
  // Streak callback: called after every successful submission with both the live streak
  // and the all-time session high. Optional so callers that don't display streak can omit it.
  updateCurrentStreak?: (currentStreak: number, highestStreak: number) => void;
  // Accuracy callback: called after every submission to update the first-try accuracy indicator.
  // 'first-try-correct' when firstAttemptBonus > 0, 'incorrect' when the attempt was wrong.
  // Optional so callers that don't show the indicator can omit it.
  updateLastAttemptResult?: (contentId: number, result: 'first-try-correct' | 'incorrect') => void;
  // Called by tryAgainActiveQuestion to clear the last-attempt result so the indicator
  // returns to neutral while the student retries — prevents a stale red/green from persisting.
  clearLastAttemptResult?: (contentId: number) => void;
  // State setters for attempt tracking — also used by tryAgainActiveQuestion.
  setSubmittedAttemptByContentId: React.Dispatch<
    React.SetStateAction<Record<number, PracticeAttemptSnapshot | null>>
  >;
  setSubmittedByContentIdBySessionId: React.Dispatch<
    React.SetStateAction<Record<string, Record<number, boolean>>>
  >;
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
  tryAgainActiveQuestion: () => void;
};

export function useSubmitAttempt({
  room,
  activeQuestionUnit,
  activeQuestion,
  isRoomReadOnly,
  selectedOptionIndex,
  hasSubmittedActiveQuestion,
  isActiveHintUnlocked,
  activeContentIdRef,
  activeContentViewStartMsRef,
  mutateAsync,
  isPending,
  applyExpAward,
  moduleDetail,
  updateCurrentStreak,
  updateLastAttemptResult,
  clearLastAttemptResult,
  setSubmittedAttemptByContentId,
  setSubmittedByContentIdBySessionId,
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

  // derived boolean that encapsulates all guard conditions preventing
  // a submission; keeps callers simple (no need to recompute this logic
  // themselves when disabling buttons).
  const canSubmitAttempt =
    Boolean(room && activeQuestionUnit && activeQuestion) &&
    !isRoomReadOnly &&
    selectedOptionIndex !== null &&
    !hasSubmittedActiveQuestion &&
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
      hasSubmittedActiveQuestion
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
      const breakdown = buildExpBreakdown(submitResponse);
      if (breakdown.total > 0) {
        // Delegate the animation target update, double-count guard, and level-up
        // celebration to the progress hook so this handler stays focused on
        // attempt business logic.
        applyExpAward(breakdown, moduleDetail);
      }
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
      // correct), red if the attempt was wrong. Correct retries are not reported so the
      // indicator stays neutral — it only ever turns green on a genuine first-try win.
      if (updateLastAttemptResult !== undefined) {
        if (submitResponse.awards.firstAttemptBonus > 0) {
          updateLastAttemptResult(activeQuestion.question.id, 'first-try-correct');
        } else if (!submitResponse.hasCorrectAttempt) {
          updateLastAttemptResult(activeQuestion.question.id, 'incorrect');
        }
      }
      setSubmittedAttemptByContentId((previous) => ({
        ...previous,
        [activeQuestion.question.id]: {
          studentAnswer,
          // Use backend-returned correctness as the authoritative value;
          isCorrect: submitResponse.hasCorrectAttempt,
        },
      }));
      setSubmittedByContentIdBySessionId((previous) => ({
        ...previous,
        [room.sessionId]: {
          ...(previous[room.sessionId] ?? {}),
          [activeQuestion.question.id]: true,
        },
      }));
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

  // allows the student to retry the same question. we only clear the
  // local locks which prevent repeat submits; this leaves the selected
  // answer intact so UI doesn't jump around while they reconsider.
  const tryAgainActiveQuestion = () => {
    if (!activeQuestion || !room) {
      return;
    }
    const { sessionId } = room;
    // Clearing local submit locks lets students immediately retry after an
    // incorrect attempt while preserving seeded selection.
    // clearLastAttemptResult preserves 'incorrect' state so the red target
    // persists through retries; it only resets 'first-try-correct' to neutral.
    clearLastAttemptResult?.(activeQuestion.question.id);
    setSubmittedByContentIdBySessionId((previous) => {
      const nextSessionValue = { ...(previous[sessionId] ?? {}) };
      delete nextSessionValue[activeQuestion.question.id];
      return { ...previous, [sessionId]: nextSessionValue };
    });
    setSubmittedAttemptByContentId((previous) => {
      const next = { ...previous };
      delete next[activeQuestion.question.id];
      return next;
    });
    setSubmitErrorMessage(null);
  };

  return {
    submitErrorMessage,
    isSubmittingAttempt: isPending,
    canSubmitAttempt,
    submitActiveQuestionAttempt,
    tryAgainActiveQuestion,
  };
}
