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
import type { ProgressModuleDetail } from './useModuleProgressAnimation';

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
  applyExpAward: (awarded: number, detail: ProgressModuleDetail | null) => void;
  moduleDetail: ProgressModuleDetail | null;
  // Streak callback: called after every successful submission with the live session streak.
  // Optional so callers that don't display streak don't have to provide it.
  updateCurrentStreak?: (streak: number) => void;
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
  setSubmittedAttemptByContentId,
  setSubmittedByContentIdBySessionId,
  parsedModuleId,
  parsedUnitId,
}: UseSubmitAttemptParams): UseSubmitAttemptResult {
  // Keep module progression updates derived from a single rewards payload contract.
  const getModuleExpFromAwards = (response: SubmitAttemptResponse): number =>
    response.awards.baseQuestionExp +
    response.awards.firstAttemptBonus +
    response.awards.streakBonus;

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
      const moduleExpAwarded = getModuleExpFromAwards(submitResponse);
      if (moduleExpAwarded > 0) {
        // Delegate the animation target update, double-count guard, and level-up
        // celebration to the progress hook so this handler stays focused on
        // attempt business logic.
        applyExpAward(moduleExpAwarded, moduleDetail);
      }
      // Relay the server-computed streak to the parent so it can update the
      // StreakIndicator without maintaining a separate server call.
      if (updateCurrentStreak !== undefined && submitResponse.currentStreak !== undefined) {
        updateCurrentStreak(submitResponse.currentStreak);
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
