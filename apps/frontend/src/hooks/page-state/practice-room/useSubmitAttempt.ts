// Owns the submit-attempt lifecycle for a single practice-room question: building
// the payload, invoking the mutation, applying optimistic local state, and surfacing
// error messages. Also owns tryAgainActiveQuestion so all submission-state concerns
// are co-located and the main page-state hook stays focused on orchestration.
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

type ActiveQuestion = {
  question: PracticeQuestion;
};

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
  applyStudentExpReward: (exp: number) => void;
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
  applyStudentExpReward,
  setSubmittedAttemptByContentId,
  setSubmittedByContentIdBySessionId,
  parsedModuleId,
  parsedUnitId,
}: UseSubmitAttemptParams): UseSubmitAttemptResult {
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  const canSubmitAttempt =
    Boolean(room && activeQuestionUnit && activeQuestion) &&
    !isRoomReadOnly &&
    selectedOptionIndex !== null &&
    !hasSubmittedActiveQuestion &&
    !isPending;

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
      if (submitResponse.moduleExpAwarded > 0) {
        // Delegate the animation target update, double-count guard, and level-up
        // celebration to the progress hook so this handler stays focused on
        // attempt business logic.
        applyExpAward(submitResponse.moduleExpAwarded, moduleDetail);
      }
      if (submitResponse.studentExpAwarded > 0) {
        // Updating auth cache immediately keeps header avatar progress in sync
        // with the in-room reward feedback.
        applyStudentExpReward(submitResponse.studentExpAwarded);
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

