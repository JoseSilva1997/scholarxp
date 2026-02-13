// Encapsulates practice-room route orchestration so the page component can stay presentational.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  ModuleUnitPracticeRoomResponse,
  PracticeAttemptSnapshot,
  PracticeQuestion,
  PracticeQuestionUnit,
  StudentAnswer,
  SubmitAttemptPayload,
} from '@scholarxp/api-contracts';
import { MODULE_EXP_MAX, PRACTICE_MODES } from '@scholarxp/constants';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import { useAuth } from '../../context/AuthContext';
import { logError } from '../../utils/logger';
import {
  useModuleUnitPracticeRoomQuery,
  useSubmitModuleUnitPracticeAttemptMutation,
} from '../queries/usePracticeRoomQueries';
import { useModuleDetailQuery } from '../queries/useModulesQueries';

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

type ModuleProgress = {
  level: number;
  currentExp: number;
  expPercent: number;
};
type ModuleProgressAnimationSnapshot = {
  totalExp: number;
  expMax: number;
};

type QuestionUnitNav = {
  canGoPrevious: boolean;
  canGoNext: boolean;
};

type PracticeRoomQuestionSelectionPersistence = {
  sessionId: string;
  selectedQuestionUnitIndex: number;
  unlockedHintByContentId: Record<number, boolean>;
  submittedByContentId: Record<number, boolean>;
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

  const practiceRoomQuery = useModuleUnitPracticeRoomQuery(
    parsedModuleId,
    parsedUnitId,
    requestedSessionId,
  );
  const submitAttemptMutation = useSubmitModuleUnitPracticeAttemptMutation(
    parsedModuleId,
    parsedUnitId,
  );
  const moduleDetailQuery = useModuleDetailQuery(parsedModuleId);
  const moduleUnitRoom = practiceRoomQuery.data?.practiceRoom ?? null;
  const moduleDetail = moduleDetailQuery.data ?? null;
  const questionSelectionPersistenceKey = useMemo(
    () =>
      buildPracticeRoomQuestionSelectionStorageKey({
        moduleId: parsedModuleId,
        unitId: parsedUnitId,
      }),
    [parsedModuleId, parsedUnitId],
  );
  const persistedQuestionSelection = useMemo(
    () =>
      questionSelectionPersistenceKey === null
        ? null
        : readPracticeRoomQuestionSelectionPersistence(
            questionSelectionPersistenceKey,
          ),
    [questionSelectionPersistenceKey],
  );

  const [selectedQuestionUnitIndexBySessionId, setSelectedQuestionUnitIndexBySessionId] =
    useState<Record<string, number>>(
      () =>
        persistedQuestionSelection
          ? {
              [persistedQuestionSelection.sessionId]:
                persistedQuestionSelection.selectedQuestionUnitIndex,
            }
          : {},
    );
  const [unlockedHintByContentIdBySessionId, setUnlockedHintByContentIdBySessionId] =
    useState<Record<string, Record<number, boolean>>>(
      () =>
        persistedQuestionSelection
          ? {
              [persistedQuestionSelection.sessionId]:
                persistedQuestionSelection.unlockedHintByContentId,
            }
          : {},
    );
  const [submittedByContentIdBySessionId, setSubmittedByContentIdBySessionId] =
    useState<Record<string, Record<number, boolean>>>(
      () =>
        persistedQuestionSelection
          ? {
              [persistedQuestionSelection.sessionId]:
                persistedQuestionSelection.submittedByContentId,
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
  const [moduleProgressAnimation, setModuleProgressAnimation] =
    useState<ModuleProgressAnimationSnapshot | null>(null);
  const [displayedModuleTotalExp, setDisplayedModuleTotalExp] = useState<
    number | null
  >(null);
  const moduleProgressAnimationFrameRef = useRef<number | null>(null);
  const moduleProgressSyncFrameRef = useRef<number | null>(null);
  const moduleProgressScopeRef = useRef<string | null>(null);
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

  useEffect(
    () => () => {
      if (moduleProgressAnimationFrameRef.current !== null) {
        cancelAnimationFrame(moduleProgressAnimationFrameRef.current);
      }
      if (moduleProgressSyncFrameRef.current !== null) {
        cancelAnimationFrame(moduleProgressSyncFrameRef.current);
      }
    },
    [],
  );

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
    if (questionSelectionPersistenceKey === null || !moduleUnitRoom) {
      return;
    }
    const sessionId = moduleUnitRoom.sessionId;
    // Persist the question position per session so a brand-new practice session starts at question one.
    writePracticeRoomQuestionSelectionPersistence(
      questionSelectionPersistenceKey,
      {
        sessionId,
        selectedQuestionUnitIndex,
        unlockedHintByContentId:
          unlockedHintByContentIdBySessionId[sessionId] ?? {},
        submittedByContentId: submittedByContentIdBySessionId[sessionId] ?? {},
      },
    );
  }, [
    moduleUnitRoom,
    questionSelectionPersistenceKey,
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

  useEffect(() => {
    if (!moduleDetail || !parsedModuleId) {
      return;
    }

    const expMax =
      moduleDetail.expMax && moduleDetail.expMax > 0
        ? moduleDetail.expMax
        : MODULE_EXP_MAX;
    const currentExp = moduleDetail.currentExp ?? 0;
    const level = moduleDetail.userModuleLevel;

    if (level === undefined) {
      return;
    }

    const scopeKey = String(parsedModuleId);
    const serverTotalExp = toModuleTotalExp(level, currentExp, expMax);
    const isNewScope = moduleProgressScopeRef.current !== scopeKey;
    const hasNoAnimationSnapshot = moduleProgressAnimation === null;
    const shouldSyncFromServer =
      isNewScope ||
      hasNoAnimationSnapshot ||
      serverTotalExp > moduleProgressAnimation.totalExp;

    if (!shouldSyncFromServer) {
      return;
    }

    moduleProgressScopeRef.current = scopeKey;
    // Deferring state updates avoids sync effect-write churn while still keeping progress tied to latest server truth.
    if (moduleProgressSyncFrameRef.current !== null) {
      cancelAnimationFrame(moduleProgressSyncFrameRef.current);
    }
    moduleProgressSyncFrameRef.current = requestAnimationFrame(() => {
      setModuleProgressAnimation({
        totalExp: serverTotalExp,
        expMax,
      });
      setDisplayedModuleTotalExp(serverTotalExp);
      moduleProgressSyncFrameRef.current = null;
    });
  }, [moduleDetail, moduleProgressAnimation, parsedModuleId]);

  useEffect(() => {
    if (!moduleProgressAnimation) {
      return;
    }
    if (displayedModuleTotalExp === null) {
      moduleProgressAnimationFrameRef.current = requestAnimationFrame(() => {
        setDisplayedModuleTotalExp(moduleProgressAnimation.totalExp);
        moduleProgressAnimationFrameRef.current = null;
      });
      return;
    }
    if (displayedModuleTotalExp === moduleProgressAnimation.totalExp) {
      return;
    }

    const animationDistance = Math.abs(
      moduleProgressAnimation.totalExp - displayedModuleTotalExp,
    );
    const animationDurationMs = Math.max(
      250,
      Math.min(900, animationDistance * 12),
    );
    const animationStart = displayedModuleTotalExp;
    const animationDelta = moduleProgressAnimation.totalExp - animationStart;
    const startedAt = performance.now();

    if (moduleProgressAnimationFrameRef.current !== null) {
      cancelAnimationFrame(moduleProgressAnimationFrameRef.current);
    }

    // The bar and XP text should move together so learners can immediately perceive gained progress.
    const step = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / animationDurationMs);
      const easedProgress = easeOutCubic(progress);
      const nextValue = Math.round(animationStart + animationDelta * easedProgress);
      setDisplayedModuleTotalExp(nextValue);

      if (progress < 1) {
        moduleProgressAnimationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      moduleProgressAnimationFrameRef.current = null;
    };

    moduleProgressAnimationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (moduleProgressAnimationFrameRef.current !== null) {
        cancelAnimationFrame(moduleProgressAnimationFrameRef.current);
      }
    };
  }, [displayedModuleTotalExp, moduleProgressAnimation]);

  const moduleProgress = useMemo<ModuleProgress | null>(() => {
    if (!moduleDetail || moduleDetail.userModuleLevel === undefined) {
      return null;
    }

    const expMax =
      moduleDetail.expMax && moduleDetail.expMax > 0
        ? moduleDetail.expMax
        : MODULE_EXP_MAX;
    const fallbackTotalExp = toModuleTotalExp(
      moduleDetail.userModuleLevel,
      moduleDetail.currentExp ?? 0,
      expMax,
    );
    const animatedTotalExp = displayedModuleTotalExp ?? fallbackTotalExp;
    const derivedProgress = fromModuleTotalExp(animatedTotalExp, expMax);
    const currentExp = derivedProgress.currentExp;
    const expPercent =
      expMax > 0 ? Math.min(100, Math.round((currentExp / expMax) * 100)) : 0;

    return {
      level: derivedProgress.level,
      currentExp,
      expPercent,
    };
  }, [displayedModuleTotalExp, moduleDetail]);

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
    setSelectedOptionOverrideByContentId((previousValue) => ({
      ...previousValue,
      [contentId]: optionIndex,
    }));
  };

  const unlockHintForContent = (contentId: number) => {
    if (!roomWithLocalAttempts) {
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
    selectedOptionIndex !== null &&
    !hasSubmittedActiveQuestion &&
    !submitAttemptMutation.isPending;

  const submitActiveQuestionAttempt = async () => {
    if (
      !roomWithLocalAttempts ||
      !activeQuestionUnit ||
      !activeQuestion ||
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
      practiceMode: PRACTICE_MODES.PRACTICE_ROOM,
      // MVP uses view duration (content shown -> submit). Later we can add interaction-duration as a second metric.
      timeTakenMs: Math.max(0, nowMs - viewStartedAtMs),
      hintUnlocked: isActiveHintUnlocked,
      studentAnswer,
    };

    setSubmitErrorMessage(null);
    try {
      const submitResponse = await submitAttemptMutation.mutateAsync(payload);
      if (submitResponse.moduleExpAwarded > 0) {
        setModuleProgressAnimation((previousValue) => {
          const expMax =
            moduleDetail?.expMax && moduleDetail.expMax > 0
              ? moduleDetail.expMax
              : MODULE_EXP_MAX;
          const fallbackTotalExp =
            moduleDetail && moduleDetail.userModuleLevel !== undefined
              ? toModuleTotalExp(
                  moduleDetail.userModuleLevel,
                  moduleDetail.currentExp ?? 0,
                  expMax,
                )
              : null;
          const currentTotalExp =
            previousValue?.totalExp ??
            displayedModuleTotalExp ??
            fallbackTotalExp;

          if (currentTotalExp === null) {
            return previousValue;
          }

          return {
            totalExp: currentTotalExp + submitResponse.moduleExpAwarded,
            expMax,
          };
        });
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
    isLoading:
      practiceRoomQuery.isPending ||
      moduleDetailQuery.isPending ||
      submitAttemptMutation.isPending,
    pageError,
    submitErrorMessage,
    isSubmittingAttempt: submitAttemptMutation.isPending,
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

function toModuleTotalExp(level: number, currentExp: number, expMax: number) {
  // Total-exp normalization lets us animate across level boundaries without special-case branching.
  return Math.max(0, level - 1) * expMax + Math.max(0, currentExp);
}

function fromModuleTotalExp(totalExp: number, expMax: number) {
  if (expMax <= 0) {
    return {
      level: 1,
      currentExp: 0,
    };
  }

  const safeTotalExp = Math.max(0, totalExp);
  return {
    level: Math.floor(safeTotalExp / expMax) + 1,
    currentExp: safeTotalExp % expMax,
  };
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
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

function buildPracticeRoomQuestionSelectionStorageKey(params: {
  moduleId: number | null;
  unitId: number | null;
}): string | null {
  if (!params.moduleId || !params.unitId) {
    return null;
  }
  return `practice-room-question-selection-v1:${params.moduleId}:${params.unitId}`;
}

function readPracticeRoomQuestionSelectionPersistence(
  storageKey: string,
): PracticeRoomQuestionSelectionPersistence | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue =
      JSON.parse(rawValue) as Partial<PracticeRoomQuestionSelectionPersistence>;
    if (
      typeof parsedValue.sessionId !== 'string' ||
      !isUuidString(parsedValue.sessionId)
    ) {
      return null;
    }
    if (
      typeof parsedValue.selectedQuestionUnitIndex !== 'number' ||
      parsedValue.selectedQuestionUnitIndex < 0
    ) {
      return null;
    }
    const unlockedHintByContentId = sanitizePersistedBooleanByContentId(
      parsedValue.unlockedHintByContentId,
    );
    const submittedByContentId = sanitizePersistedBooleanByContentId(
      parsedValue.submittedByContentId,
    );
    return {
      sessionId: parsedValue.sessionId,
      selectedQuestionUnitIndex: parsedValue.selectedQuestionUnitIndex,
      unlockedHintByContentId,
      submittedByContentId,
    };
  } catch {
    return null;
  }
}

function writePracticeRoomQuestionSelectionPersistence(
  storageKey: string,
  value: PracticeRoomQuestionSelectionPersistence,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value));
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

function isUuidString(value: string): boolean {
  // UUID validation keeps URL and local persistence aligned with backend session-id constraints.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function sanitizePersistedBooleanByContentId(
  value: unknown,
): Record<number, boolean> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const sanitized: Record<number, boolean> = {};
  for (const [rawContentId, rawFlag] of Object.entries(value)) {
    const contentId = Number(rawContentId);
    if (!Number.isInteger(contentId) || contentId <= 0) {
      continue;
    }
    if (typeof rawFlag !== 'boolean') {
      continue;
    }
    sanitized[contentId] = rawFlag;
  }
  return sanitized;
}
