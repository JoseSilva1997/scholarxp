// Owns transient practice-room interaction state so orchestration code can stay focused
// on composing hooks instead of managing optimistic drafts, attempt overlays, and timers.
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ModuleUnitPracticeRoomResponse,
  PracticeAttemptSnapshot,
  PracticeQuestion,
  PracticeQuestionUnit,
} from '@scholarxp/api-contracts';
import {
  applySubmittedAttemptOverrides,
  readQuestionOptions,
  readSelectedOptionIndex,
} from './practiceRoomDerivedState';

type LastAttemptResult = 'first-try-correct' | 'incorrect';

export type ActivePracticeQuestion = {
  question: PracticeQuestion;
};

type UsePracticeRoomInteractionStateParams = {
  room: ModuleUnitPracticeRoomResponse['practiceRoom'] | null;
  activeSessionId: string | null;
  selectedQuestionUnitIndex: number;
  isRoomReadOnly: boolean;
};

type UsePracticeRoomInteractionStateResult = {
  roomWithLocalAttempts: ModuleUnitPracticeRoomResponse['practiceRoom'] | null;
  activeQuestionUnit: PracticeQuestionUnit | null;
  activeQuestion: ActivePracticeQuestion | null;
  activeQuestionOptions: Array<{ optionText: string }>;
  selectedOptionIndex: number | null;
  hasActiveOptionOverride: boolean;
  lastAttemptResult: LastAttemptResult | null;
  activeContentIdRef: React.RefObject<number | null>;
  activeContentViewStartMsRef: React.RefObject<number | null>;
  selectOption: (contentId: number, optionIndex: number) => void;
  clearSelectedOptionOverride: (contentId: number) => void;
  recordSubmittedAttempt: (
    contentId: number,
    attempt: PracticeAttemptSnapshot | null,
  ) => void;
  updateLastAttemptResult: (
    contentId: number,
    result: LastAttemptResult | null,
  ) => void;
};

export function usePracticeRoomInteractionState({
  room,
  activeSessionId,
  selectedQuestionUnitIndex,
  isRoomReadOnly,
}: UsePracticeRoomInteractionStateParams): UsePracticeRoomInteractionStateResult {
  // Draft selections only exist client-side while a learner is interacting with the
  // current session; they should not survive into a newly created backend session.
  const [selectedOptionOverrideByContentId, setSelectedOptionOverrideByContentId] =
    useState<Record<number, number>>({});
  const [submittedAttemptByContentId, setSubmittedAttemptByContentId] = useState<
    Record<number, PracticeAttemptSnapshot | null>
  >({});
  const [lastAttemptResultByContentId, setLastAttemptResultByContentId] = useState<
    Record<number, LastAttemptResult>
  >({});

  // Timing refs stay outside render state so submit handling can read accurate
  // view durations without causing rerenders during normal question navigation.
  const activeContentIdRef = useRef<number | null>(null);
  const activeContentViewStartMsRef = useRef<number | null>(null);
  const previousSessionIdRef = useRef<string | null>(null);

  // Clear transient state when the backend rotates the active session so stale
  // draft selections and optimistic snapshots never bleed into a new session.
  useEffect(() => {
    if (activeSessionId === null) {
      return;
    }
    const previousSessionId = previousSessionIdRef.current;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (previousSessionId !== null && previousSessionId !== activeSessionId) {
      timeoutId = setTimeout(() => {
        setSelectedOptionOverrideByContentId({});
        setSubmittedAttemptByContentId({});
        setLastAttemptResultByContentId({});
      }, 0);
    }
    previousSessionIdRef.current = activeSessionId;
    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeSessionId]);

  // Merge optimistic local attempt snapshots over the server payload so answer
  // correctness and progress UI update immediately after submit.
  const roomWithLocalAttempts = useMemo(() => {
    if (!room) {
      return null;
    }
    return {
      ...room,
      questions: room.questions.map((questionUnit) =>
        applySubmittedAttemptOverrides(questionUnit, submittedAttemptByContentId),
      ),
    } satisfies ModuleUnitPracticeRoomResponse['practiceRoom'];
  }, [room, submittedAttemptByContentId]);

  // Server attempts seed the initial option selection while allowing the learner's
  // in-progress draft choice to override it until they submit.
  const seededOptionByContentId = useMemo(() => {
    if (!roomWithLocalAttempts) {
      return {};
    }
    const seededSelection: Record<number, number> = {};
    for (const questionUnit of roomWithLocalAttempts.questions) {
      const coreAttemptSelection = readSelectedOptionIndex(
        questionUnit.coreQuestion.lastAttempt?.studentAnswer,
      );
      if (coreAttemptSelection !== null) {
        seededSelection[questionUnit.coreQuestion.questionContent.id] =
          coreAttemptSelection;
      }
    }
    return seededSelection;
  }, [roomWithLocalAttempts]);

  const selectedOptionByContentId = useMemo(
    () => ({
      ...seededOptionByContentId,
      ...selectedOptionOverrideByContentId,
    }),
    [seededOptionByContentId, selectedOptionOverrideByContentId],
  );

  const activeQuestionUnit = useMemo<PracticeQuestionUnit | null>(() => {
    if (!roomWithLocalAttempts || roomWithLocalAttempts.questions.length === 0) {
      return null;
    }
    const clampedSelectedIndex = Math.max(
      0,
      Math.min(selectedQuestionUnitIndex, roomWithLocalAttempts.questions.length - 1),
    );
    return (
      roomWithLocalAttempts.questions[clampedSelectedIndex] ??
      roomWithLocalAttempts.questions[0]
    );
  }, [roomWithLocalAttempts, selectedQuestionUnitIndex]);

  const activeQuestion = useMemo<ActivePracticeQuestion | null>(() => {
    if (!activeQuestionUnit) {
      return null;
    }
    return {
      question: activeQuestionUnit.coreQuestion.questionContent,
    };
  }, [activeQuestionUnit]);

  const activeQuestionOptions = useMemo(() => {
    if (!activeQuestion) {
      return [];
    }
    return readQuestionOptions(activeQuestion.question.questionData);
  }, [activeQuestion]);

  // Timing starts when a question first becomes active, not when the room loads.
  useEffect(() => {
    if (!activeQuestion) {
      return;
    }
    const activeContentId = activeQuestion.question.id;
    if (activeContentIdRef.current === activeContentId) {
      return;
    }
    activeContentIdRef.current = activeContentId;
    activeContentViewStartMsRef.current = Date.now();
  }, [activeQuestion]);

  // Clamp the selected option to currently renderable choices so stale overrides
  // cannot point past the available option list.
  const selectedOptionIndex = useMemo(() => {
    if (!activeQuestion) {
      return null;
    }
    const persistedSelection = selectedOptionByContentId[activeQuestion.question.id];
    if (
      typeof persistedSelection !== 'number' ||
      persistedSelection < 0 ||
      persistedSelection >= activeQuestionOptions.length
    ) {
      return null;
    }
    return persistedSelection;
  }, [activeQuestion, activeQuestionOptions.length, selectedOptionByContentId]);

  const hasActiveOptionOverride = activeQuestion
    ? Object.prototype.hasOwnProperty.call(
        selectedOptionOverrideByContentId,
        activeQuestion.question.id,
      )
    : false;

  const selectOption = (contentId: number, optionIndex: number) => {
    if (isRoomReadOnly) {
      return;
    }
    setSelectedOptionOverrideByContentId((previousValue) => ({
      ...previousValue,
      [contentId]: optionIndex,
    }));
  };

  const clearSelectedOptionOverride = (contentId: number) => {
    setSelectedOptionOverrideByContentId((previous) => {
      if (!Object.prototype.hasOwnProperty.call(previous, contentId)) {
        return previous;
      }
      const next = { ...previous };
      delete next[contentId];
      return next;
    });
  };

  const recordSubmittedAttempt = (
    contentId: number,
    attempt: PracticeAttemptSnapshot | null,
  ) => {
    setSubmittedAttemptByContentId((previous) => ({
      ...previous,
      [contentId]: attempt,
    }));
  };

  const updateLastAttemptResult = (
    contentId: number,
    result: LastAttemptResult | null,
  ) => {
    setLastAttemptResultByContentId((previous) => {
      if (result === null) {
        const next = { ...previous };
        delete next[contentId];
        return next;
      }
      return { ...previous, [contentId]: result };
    });
  };

  return {
    roomWithLocalAttempts,
    activeQuestionUnit,
    activeQuestion,
    activeQuestionOptions,
    selectedOptionIndex,
    hasActiveOptionOverride,
    lastAttemptResult: activeQuestion
      ? (lastAttemptResultByContentId[activeQuestion.question.id] ?? null)
      : null,
    activeContentIdRef,
    activeContentViewStartMsRef,
    selectOption,
    clearSelectedOptionOverride,
    recordSubmittedAttempt,
    updateLastAttemptResult,
  };
}
