// Encapsulates practice-room route orchestration so the page component can stay presentational.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  ModuleUnitPracticeRoomResponse,
  PracticeSessionType,
  PracticeAttemptSnapshot,
  PracticeQuestion,
  PracticeQuestionUnit,
  StudentAnswer,
  SubmitAttemptPayload,
} from '@scholarxp/api-contracts';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../../api/get-display-error';
import { useAuth } from '../../../context/AuthContext';
import { logError } from '../../../utils/logger';
import {
  useCloseModuleUnitPracticeSessionMutation,
  useModuleUnitPracticeRoomQuery,
  useSubmitModuleUnitPracticeAttemptMutation,
} from '../../queries/usePracticeRoomQueries';
import { useModuleDetailQuery } from '../../queries/useModulesQueries';
import { useModuleProgressAnimation } from './useModuleProgressAnimation';
import { useSessionLifecycle } from './useSessionLifecycle';
import {
  usePracticeRoomPersistence,
  isUuidString,
} from './usePracticeRoomPersistence';

type UsePracticeRoomPageStateParams = {
  moduleIdParam: string | undefined;
  unitIdParam: string | undefined;
};

type ActiveQuestion = {
  question: PracticeQuestion;
};

// Minimal question-data shape used to render selectable options in the current practice-room panel.
type QuestionDataWithOptions = {
  options: Array<{ optionText: string }>;
  trueOption?: { isCorrect: boolean; explanation?: string };
  falseOption?: { isCorrect: boolean; explanation?: string };
};

type QuestionUnitNav = {
  canGoPrevious: boolean;
  canGoNext: boolean;
};

export function usePracticeRoomPageState({
  moduleIdParam,
  unitIdParam,
}: UsePracticeRoomPageStateParams) {
  const { applyStudentExpReward } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();

  const parsedModuleId = useMemo(() => {
    if (!moduleIdParam) return null;
    const value = Number(moduleIdParam);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [moduleIdParam]);

  const parsedUnitId = useMemo(() => {
    if (!unitIdParam) return null;
    const value = Number(unitIdParam);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [unitIdParam]);
  const requestedSessionId = parsePracticeRoomSessionIdQuery(
    searchParams.get('sessionId'),
  );
  const requestedQuestionUnitId = parsePracticeRoomQuestionUnitIdQuery(
    searchParams.get('questionId'),
  );

  const practiceRoomQuery = useModuleUnitPracticeRoomQuery(
    parsedModuleId,
    parsedUnitId,
    requestedSessionId,
  );
  const submitAttemptMutation = useSubmitModuleUnitPracticeAttemptMutation(
    parsedModuleId,
    parsedUnitId,
  );
  const closeSessionMutation = useCloseModuleUnitPracticeSessionMutation(
    parsedModuleId,
    parsedUnitId,
  );
  const moduleDetailQuery = useModuleDetailQuery(parsedModuleId);
  const moduleUnitRoom = practiceRoomQuery.data?.practiceRoom ?? null;
  const moduleDetail = moduleDetailQuery.data ?? null;
  const {
    moduleProgress,
    moduleExpGainIndicator,
    showLevelUp,
    isProgressInitialized,
    applyExpAward,
  } = useModuleProgressAnimation({ moduleDetail, moduleId: parsedModuleId });
  const { initialSelection, persistSelection, storageKey } = usePracticeRoomPersistence({
    moduleId: parsedModuleId,
    unitId: parsedUnitId,
  });

  const [selectedQuestionUnitIndexBySessionId, setSelectedQuestionUnitIndexBySessionId] =
    useState<Record<string, number>>(
      () =>
        initialSelection
          ? {
              [initialSelection.sessionId]:
                initialSelection.selectedQuestionUnitIndex,
            }
          : {},
    );
  const [unlockedHintByContentIdBySessionId, setUnlockedHintByContentIdBySessionId] =
    useState<Record<string, Record<number, boolean>>>(
      () =>
        initialSelection
          ? {
              [initialSelection.sessionId]:
                initialSelection.unlockedHintByContentId,
            }
          : {},
    );
  const [submittedByContentIdBySessionId, setSubmittedByContentIdBySessionId] =
    useState<Record<string, Record<number, boolean>>>(
      () =>
        initialSelection
          ? {
              [initialSelection.sessionId]:
                initialSelection.submittedByContentId,
            }
          : {},
    );
  const selectedQuestionUnitIndex = useMemo(
    () =>
      moduleUnitRoom
        ? selectedQuestionUnitIndexBySessionId[moduleUnitRoom.sessionId] ?? 0
        : 0,
    [moduleUnitRoom, selectedQuestionUnitIndexBySessionId],
  );
  const [selectedOptionOverrideByContentId, setSelectedOptionOverrideByContentId] =
    useState<Record<number, number>>({});
  const [submittedAttemptByContentId, setSubmittedAttemptByContentId] = useState<
    Record<number, PracticeAttemptSnapshot | null>
  >({});
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const activeContentIdRef = useRef<number | null>(null);
  const activeContentViewStartMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!practiceRoomQuery.error) return;
    if (shouldLogApiError(practiceRoomQuery.error)) {
      logError(practiceRoomQuery.error, {
        feature: 'practice-room',
        action: 'load',
        moduleId: parsedModuleId,
        unitId: parsedUnitId,
      });
    }
  }, [parsedModuleId, parsedUnitId, practiceRoomQuery.error]);

  useEffect(() => {
    if (!moduleDetailQuery.error) return;
    if (shouldLogApiError(moduleDetailQuery.error)) {
      logError(moduleDetailQuery.error, {
        feature: 'practice-room',
        action: 'load-module-progress',
        moduleId: parsedModuleId,
      });
    }
  }, [moduleDetailQuery.error, parsedModuleId]);

  useEffect(() => {
    if (!moduleUnitRoom) {
      return;
    }
    if (requestedSessionId === moduleUnitRoom.sessionId) {
      return;
    }
    // Keep session id in the URL so browser reload resumes the same backend practice session.
    const nextSearchParams = new URLSearchParams(searchParamsString);
    nextSearchParams.set('sessionId', String(moduleUnitRoom.sessionId));
    setSearchParams(nextSearchParams, { replace: true });
  }, [
    moduleUnitRoom,
    requestedSessionId,
    searchParamsString,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!moduleUnitRoom || requestedQuestionUnitId === null) {
      return;
    }
    const targetQuestionIndex = moduleUnitRoom.questions.findIndex(
      (questionUnit) => questionUnit.questionUnitId === requestedQuestionUnitId,
    );
    if (targetQuestionIndex < 0) {
      return;
    }
    // Defer state sync to the next frame to satisfy hook linting while preserving deep-link behavior.
    const frameId = requestAnimationFrame(() => {
      setSelectedQuestionUnitIndexBySessionId((previousValue) => {
        if (previousValue[moduleUnitRoom.sessionId] === targetQuestionIndex) {
          return previousValue;
        }
        return {
          ...previousValue,
          [moduleUnitRoom.sessionId]: targetQuestionIndex,
        };
      });
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [moduleUnitRoom, requestedQuestionUnitId]);

  useEffect(() => {
    if (storageKey === null || !moduleUnitRoom) {
      return;
    }
    const sessionId = moduleUnitRoom.sessionId;
    // Persist the question position per session so a brand-new practice session starts at question one.
    persistSelection({
      sessionId,
      selectedQuestionUnitIndex,
      unlockedHintByContentId:
        unlockedHintByContentIdBySessionId[sessionId] ?? {},
      submittedByContentId: submittedByContentIdBySessionId[sessionId] ?? {},
    });
  }, [
    moduleUnitRoom,
    persistSelection,
    storageKey,
    selectedQuestionUnitIndex,
    submittedByContentIdBySessionId,
    unlockedHintByContentIdBySessionId,
  ]);

  const roomWithLocalAttempts = useMemo(() => {
    if (!moduleUnitRoom) {
      return null;
    }

    return {
      ...moduleUnitRoom,
      questions: moduleUnitRoom.questions.map((questionUnit) =>
        applySubmittedAttemptOverrides(
          questionUnit,
          submittedAttemptByContentId,
        ),
      ),
    } satisfies ModuleUnitPracticeRoomResponse['practiceRoom'];
  }, [moduleUnitRoom, submittedAttemptByContentId]);
  // Backend-owned completion state makes answer interactions read-only when students open completed units.
  const sessionType: PracticeSessionType =
    roomWithLocalAttempts?.sessionType ?? PracticeSessionTypeValues.practiceRoom;
  // Session type is the canonical mode; isReadOnly remains as a compatibility guard while APIs transition.
  const isRoomReadOnly =
    roomWithLocalAttempts?.isReadOnly === true ||
    sessionType === PracticeSessionTypeValues.viewAnswers;

  useSessionLifecycle({
    sessionId: roomWithLocalAttempts?.sessionId ?? null,
    moduleId: parsedModuleId,
    unitId: parsedUnitId,
    closeSession: closeSessionMutation.mutate,
  });

  const seededOptionByContentId = useMemo(() => {
    if (!roomWithLocalAttempts) return {};

    // Seed option selections from latest core attempts to preserve continuity across room reloads.
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

  const activeQuestion = useMemo<ActiveQuestion | null>(() => {
    if (!activeQuestionUnit) return null;
    return {
      question: activeQuestionUnit.coreQuestion.questionContent,
    };
  }, [activeQuestionUnit]);

  const activeQuestionOptions = useMemo(() => {
    if (!activeQuestion) return [];
    return readQuestionOptions(activeQuestion.question.questionData);
  }, [activeQuestion]);

  const questionUnitNav = useMemo<QuestionUnitNav>(() => {
    if (!roomWithLocalAttempts || roomWithLocalAttempts.questions.length === 0) {
      return { canGoPrevious: false, canGoNext: false };
    }
    return {
      canGoPrevious: selectedQuestionUnitIndex > 0,
      canGoNext:
        selectedQuestionUnitIndex < roomWithLocalAttempts.questions.length - 1,
    };
  }, [roomWithLocalAttempts, selectedQuestionUnitIndex]);

  const pageError = useMemo(() => {
    if (!parsedModuleId || !parsedUnitId) {
      return 'Practice room not found. Please check the link and try again.';
    }
    if (moduleDetailQuery.error) {
      return getDisplayErrorMessage(moduleDetailQuery.error, {
        fallbackMessage:
          'We could not load this practice room right now. Please try again.',
      });
    }
    if (practiceRoomQuery.error) {
      return getDisplayErrorMessage(practiceRoomQuery.error, {
        fallbackMessage:
          'We could not load this practice room right now. Please try again.',
      });
    }
    return null;
  }, [moduleDetailQuery.error, parsedModuleId, parsedUnitId, practiceRoomQuery.error]);

  // Note: module progress animation (server sync, rAF loop, level-up celebration)
  // is managed by useModuleProgressAnimation above.

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

  const unlockedHintByContentId = useMemo(
    () =>
      moduleUnitRoom
        ? unlockedHintByContentIdBySessionId[moduleUnitRoom.sessionId] ?? {}
        : {},
    [moduleUnitRoom, unlockedHintByContentIdBySessionId],
  );
  const submittedByContentId = useMemo(
    () =>
      moduleUnitRoom
        ? submittedByContentIdBySessionId[moduleUnitRoom.sessionId] ?? {}
        : {},
    [moduleUnitRoom, submittedByContentIdBySessionId],
  );

  useEffect(() => {
    if (!activeQuestion) {
      return;
    }
    const activeContentId = activeQuestion.question.id;
    if (activeContentIdRef.current === activeContentId) {
      return;
    }
    // View-duration timing starts when a concrete content item becomes active, not when the room first opens.
    activeContentIdRef.current = activeContentId;
    activeContentViewStartMsRef.current = Date.now();
  }, [activeQuestion]);

  const selectQuestionUnit = (index: number) => {
    if (!roomWithLocalAttempts || roomWithLocalAttempts.questions.length === 0) {
      return;
    }
    const clampedIndex = Math.max(
      0,
      Math.min(index, roomWithLocalAttempts.questions.length - 1),
    );
    setSelectedQuestionUnitIndexBySessionId((previousValue) => ({
      ...previousValue,
      [roomWithLocalAttempts.sessionId]: clampedIndex,
    }));
  };

  const selectOption = (contentId: number, optionIndex: number) => {
    if (isRoomReadOnly) {
      return;
    }
    setSelectedOptionOverrideByContentId((previousValue) => ({
      ...previousValue,
      [contentId]: optionIndex,
    }));
  };

  const unlockHintForContent = (contentId: number) => {
    if (!roomWithLocalAttempts || isRoomReadOnly) {
      return;
    }
    const sessionId = roomWithLocalAttempts.sessionId;
    // Hints unlock once per content id and remain available so XP rules can treat unlock as a single event.
    setUnlockedHintByContentIdBySessionId((previousValue) => ({
      ...previousValue,
      [sessionId]: {
        ...(previousValue[sessionId] ?? {}),
        [contentId]: true,
      },
    }));
  };

  const isActiveHintUnlocked = activeQuestion
    ? Boolean(unlockedHintByContentId[activeQuestion.question.id])
    : false;
  const hasSubmittedActiveQuestion = activeQuestion
    ? Boolean(submittedByContentId[activeQuestion.question.id])
    : false;
  // Persisted feedback should be suppressed once the learner starts a new draft selection.
  const hasActiveOptionOverride = activeQuestion
    ? Object.prototype.hasOwnProperty.call(
        selectedOptionOverrideByContentId,
        activeQuestion.question.id,
      )
    : false;
  const isActiveQuestionIncorrect =
    activeQuestionUnit?.coreQuestion.lastAttempt?.isCorrect === false;
  const showTryAgainButton = hasSubmittedActiveQuestion && isActiveQuestionIncorrect;

  const goToPreviousQuestionUnit = () => {
    if (!questionUnitNav.canGoPrevious) return;
    if (!roomWithLocalAttempts) return;
    const sessionId = roomWithLocalAttempts.sessionId;
    setSelectedQuestionUnitIndexBySessionId((previousValue) => ({
      ...previousValue,
      [sessionId]: Math.max(0, (previousValue[sessionId] ?? 0) - 1),
    }));
  };

  const goToNextQuestionUnit = () => {
    if (!roomWithLocalAttempts || !questionUnitNav.canGoNext) return;
    const sessionId = roomWithLocalAttempts.sessionId;
    setSelectedQuestionUnitIndexBySessionId((previousValue) => ({
      ...previousValue,
      [sessionId]: Math.min(
        roomWithLocalAttempts.questions.length - 1,
        (previousValue[sessionId] ?? 0) + 1,
      ),
    }));
  };

  const canSubmitAttempt =
    Boolean(roomWithLocalAttempts && activeQuestionUnit && activeQuestion) &&
    !isRoomReadOnly &&
    selectedOptionIndex !== null &&
    !hasSubmittedActiveQuestion &&
    !submitAttemptMutation.isPending;

  const submitActiveQuestionAttempt = async () => {
    if (
      !roomWithLocalAttempts ||
      !activeQuestionUnit ||
      !activeQuestion ||
      isRoomReadOnly ||
      selectedOptionIndex === null ||
      hasSubmittedActiveQuestion
    ) {
      return;
    }

    const studentAnswer: StudentAnswer = {
      selectedOptionIndex,
    };
    // Local evaluation is used only for immediate optimistic UI; backend remains the source of truth for persisted correctness.
    const optimisticIsCorrect = isSelectedOptionCorrect(
      activeQuestion.question,
      selectedOptionIndex,
    );
    const nowMs = Date.now();
    const viewStartedAtMs =
      activeContentIdRef.current === activeQuestion.question.id &&
      activeContentViewStartMsRef.current !== null
        ? activeContentViewStartMsRef.current
        : nowMs;
    const payload: SubmitAttemptPayload = {
      moduleUnitId: roomWithLocalAttempts.moduleUnitId,
      questionUnitId: activeQuestionUnit.questionUnitId,
      questionContentId: activeQuestion.question.id,
      sessionId: roomWithLocalAttempts.sessionId,
      // MVP uses view duration (content shown -> submit). Later we can add interaction-duration as a second metric.
      timeTakenMs: Math.max(0, nowMs - viewStartedAtMs),
      hintUnlocked: isActiveHintUnlocked,
      studentAnswer,
    };

    setSubmitErrorMessage(null);

    try {
      const submitResponse = await submitAttemptMutation.mutateAsync(payload);
      if (submitResponse.moduleExpAwarded > 0) {
        // Delegate the animation target update, double-count guard, and level-up celebration
        // to the progress hook so the submit handler stays focused on attempt business logic.
        applyExpAward(submitResponse.moduleExpAwarded, moduleDetail);
      }
      if (submitResponse.studentExpAwarded > 0) {
        // Updating auth cache immediately keeps header avatar progress in sync with the in-room reward feedback.
        applyStudentExpReward(submitResponse.studentExpAwarded);
      }
      setSubmittedAttemptByContentId((previousValue) => ({
        ...previousValue,
        [activeQuestion.question.id]: {
          studentAnswer,
          isCorrect: optimisticIsCorrect,
        },
      }));
      const sessionId = roomWithLocalAttempts.sessionId;
      setSubmittedByContentIdBySessionId((previousValue) => ({
        ...previousValue,
        [sessionId]: {
          ...(previousValue[sessionId] ?? {}),
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
    if (!activeQuestion || !roomWithLocalAttempts) {
      return;
    }
    const sessionId = roomWithLocalAttempts.sessionId;
    // Clearing local submit locks lets students immediately retry after an incorrect attempt while preserving seeded selection.
    setSubmittedByContentIdBySessionId((previousValue) => {
      const nextSessionValue = { ...(previousValue[sessionId] ?? {}) };
      delete nextSessionValue[activeQuestion.question.id];
      return {
        ...previousValue,
        [sessionId]: nextSessionValue,
      };
    });
    setSubmittedAttemptByContentId((previousValue) => {
      const nextValue = { ...previousValue };
      delete nextValue[activeQuestion.question.id];
      return nextValue;
    });
    setSubmitErrorMessage(null);
  };

  return {
    parsedModuleId,
    parsedUnitId,
    room: roomWithLocalAttempts,
    moduleProgress,
    moduleExpGainIndicator,
    showLevelUp,
    isLoading:
      practiceRoomQuery.isPending ||
      (moduleDetailQuery.isPending && !isProgressInitialized),
    sessionType,
    pageError,
    submitErrorMessage,
    isSubmittingAttempt: submitAttemptMutation.isPending,
    isRoomReadOnly,
    canSubmitAttempt,
    selectedQuestionUnitIndex,
    activeQuestionUnit,
    activeQuestion,
    activeQuestionOptions,
    questionUnitNav,
    selectedOptionIndex,
    hasSubmittedActiveQuestion,
    hasActiveOptionOverride,
    showTryAgainButton,
    selectQuestionUnit,
    selectOption,
    isActiveHintUnlocked,
    unlockHintForContent,
    tryAgainActiveQuestion,
    submitActiveQuestionAttempt,
    goToPreviousQuestionUnit,
    goToNextQuestionUnit,
  };
}

// Apply local submissions over server snapshots so completion bars update instantly while query refetch catches up.
function applySubmittedAttemptOverrides(
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

// Student-answer payloads differ by question type; this helper safely extracts MCQ/true-false indexes when available.
function readSelectedOptionIndex(
  studentAnswer: unknown,
): number | null {
  if (!studentAnswer || typeof studentAnswer !== 'object') {
    return null;
  }
  const candidate = studentAnswer as { selectedOptionIndex?: unknown };
  if (typeof candidate.selectedOptionIndex !== 'number') {
    return null;
  }
  return candidate.selectedOptionIndex;
}

// Render only option-based questions for now; unknown question schemas return an empty list safely.
function readQuestionOptions(
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

// Frontend uses question authoring metadata to compute correctness until backend grading/explanation flow is introduced.
function isSelectedOptionCorrect(
  question: PracticeQuestion,
  selectedOptionIndex: number,
): boolean {
  if (!question.questionData || typeof question.questionData !== 'object') {
    return false;
  }

  const questionData = question.questionData as QuestionDataWithOptions;
  if (question.type === 'mcq') {
    const candidate = questionData as { correctOptionIndex?: unknown };
    return candidate.correctOptionIndex === selectedOptionIndex;
  }

  if (question.type === 'true-false') {
    if (selectedOptionIndex === 0) {
      return questionData.trueOption?.isCorrect === true;
    }
    if (selectedOptionIndex === 1) {
      return questionData.falseOption?.isCorrect === true;
    }
  }

  return false;
}

function parsePracticeRoomSessionIdQuery(
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

function parsePracticeRoomQuestionUnitIdQuery(
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
