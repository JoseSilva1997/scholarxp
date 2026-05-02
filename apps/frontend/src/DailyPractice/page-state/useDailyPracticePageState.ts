// Encapsulates DailyPracticePage orchestration in a presenter-style custom hook so the route can stay focused on rendering.
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  DailyPracticeProgress,
  DailyPracticeQuestionItem,
  DailyPracticeTodayResponse,
  PracticeAttemptSnapshot,
  StudentAnswer,
} from '@scholarxp/api-contracts';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '@/shared/api/get-display-error';
import { logError } from '@/utils/logger';
import {
  useCloseDailyPracticeSessionMutation,
  useSubmitDailyPracticeAttemptMutation,
  useTodayDailyPracticeQuery,
} from '@/DailyPractice/queries/useDailyPracticeQueries';
import { useModuleDetailQuery } from '@/Authoring/queries/useModulesQueries';
import { buildQuestionUnitNav, parsePracticeRoomSessionIdQuery, readQuestionOptions, readSelectedOptionIndex } from '@/Practice-Room/page-state/practiceRoomDerivedState';
import { parsePositiveIntegerParam } from '@/Practice-Room/page-state/practiceRoomPageStateUtils';
import { useModuleProgressAnimation, type ExpBreakdown } from '@/shared/hooks/page-state/useModuleProgressAnimation';

type UseDailyPracticePageStateParams = {
  moduleIdParam: string | undefined;
};

type LocalQuestionOverride = {
  lastAttempt: PracticeAttemptSnapshot;
  hasCorrectAttempt: boolean | null;
};

type SetScopedValue<T> = {
  setId: string | null;
  value: T;
};

type ActiveDailyPracticeQuestion = {
  question: DailyPracticeQuestionItem['coreQuestion']['questionContent'];
};

type UseDailyPracticePageStateResult = {
  parsedModuleId: number | null;
  room: DailyPracticeTodayResponse | null;
  progress: DailyPracticeProgress | null;
  isLoading: boolean;
  pageError: string | null;
  submitErrorMessage: string | null;
  isSubmittingAttempt: boolean;
  canSubmitAttempt: boolean;
  selectedQuestionIndex: number;
  activeQuestionItem: DailyPracticeQuestionItem | null;
  activeQuestion: ActiveDailyPracticeQuestion | null;
  activeQuestionOptions: Array<{ optionText: string }>;
  questionNav: { canGoPrevious: boolean; canGoNext: boolean };
  selectedOptionIndex: number | null;
  hasActiveOptionOverride: boolean;
  isActiveHintUnlocked: boolean;
  currentStreak: number;
  highestStreak: number;
  isStreakInitialized: boolean;
  moduleProgress: { level: number; currentExp: number; expPercent: number } | null;
  moduleExpGainIndicator: ExpBreakdown | null;
  showLevelUp: boolean;
  selectQuestion: (index: number) => void;
  selectOption: (contentId: number, optionIndex: number) => void;
  unlockHintForContent: (contentId: number) => void;
  goToPreviousQuestion: () => void;
  goToNextQuestion: () => void;
  submitActiveQuestionAttempt: () => Promise<void>;
};

const EMPTY_BOOLEAN_BY_CONTENT_ID: Record<number, boolean> = {};
const EMPTY_OPTION_OVERRIDE_BY_CONTENT_ID: Record<number, number> = {};
const EMPTY_QUESTION_OVERRIDE_BY_QUESTION_ID: Record<number, LocalQuestionOverride> =
  {};

// Coordinates Daily Practice data loading, optimistic local state, session lifecycle, and submission side effects for the route.
export function useDailyPracticePageState({
  moduleIdParam,
}: UseDailyPracticePageStateParams): UseDailyPracticePageStateResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();

  const parsedModuleId = useMemo(
    () => parsePositiveIntegerParam(moduleIdParam),
    [moduleIdParam],
  );
  const requestedSessionId = parsePracticeRoomSessionIdQuery(
    searchParams.get('sessionId'),
  );
  const [querySessionId, setQuerySessionId] = useState<string | null>(
    requestedSessionId,
  );

  const dailyPracticeQuery = useTodayDailyPracticeQuery(
    parsedModuleId,
    querySessionId,
  );
  const submitAttemptMutation =
    useSubmitDailyPracticeAttemptMutation(parsedModuleId);
  const closeSessionMutation =
    useCloseDailyPracticeSessionMutation(parsedModuleId);

  const moduleDetailQuery = useModuleDetailQuery(parsedModuleId);
  const moduleDetail = moduleDetailQuery.data ?? null;
  const {
    moduleProgress,
    moduleExpGainIndicator,
    showLevelUp,
    applyExpAward,
  } = useModuleProgressAnimation({ moduleDetail, moduleId: parsedModuleId });

  const [selectedQuestionIndexState, setSelectedQuestionIndexState] =
    useState<SetScopedValue<number>>({
      setId: null,
      value: 0,
    });
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );
  const [unlockedHintByContentIdState, setUnlockedHintByContentIdState] =
    useState<SetScopedValue<Record<number, boolean>>>({
      setId: null,
      value: EMPTY_BOOLEAN_BY_CONTENT_ID,
    });
  const [selectedOptionOverrideByContentIdState, setSelectedOptionOverrideByContentIdState] =
    useState<SetScopedValue<Record<number, number>>>({
      setId: null,
      value: EMPTY_OPTION_OVERRIDE_BY_CONTENT_ID,
    });
  const [questionOverrideByQuestionUnitIdState, setQuestionOverrideByQuestionUnitIdState] =
    useState<SetScopedValue<Record<number, LocalQuestionOverride>>>({
      setId: null,
      value: EMPTY_QUESTION_OVERRIDE_BY_QUESTION_ID,
    });
  const [progressOverrideState, setProgressOverrideState] =
    useState<SetScopedValue<DailyPracticeProgress | null>>({
      setId: null,
      value: null,
    });
  const [streakState, setStreakState] = useState<
    SetScopedValue<{ currentStreak: number; highestStreak: number }>
  >({
    setId: null,
    value: { currentStreak: 0, highestStreak: 0 },
  });

  const room = dailyPracticeQuery.data ?? null;
  const activeContentIdRef = useRef<number | null>(null);
  const activeContentViewStartMsRef = useRef<number | null>(null);
  const latestSessionIdRef = useRef<string | null>(room?.sessionId ?? null);
  const latestModuleIdRef = useRef<number | null>(parsedModuleId);
  const closeSessionRef = useRef(closeSessionMutation.mutate);
  const closedSessionIdsRef = useRef<Set<string>>(new Set());
  const previousModuleIdRef = useRef<number | null>(parsedModuleId);
  const isSyncingSearchParamsRef = useRef(false);
  const activeSetId = room?.setId ?? null;
  // Seed streak from server on first load for the active set; after that, submit responses drive updates.
  const isStreakInitialized = activeSetId !== null && streakState.setId === activeSetId;
  const currentStreak = isStreakInitialized ? streakState.value.currentStreak : 0;
  const highestStreak = isStreakInitialized ? streakState.value.highestStreak : 0;
  if (!isStreakInitialized && room) {
    // The set id scopes streak state so a resumed or replaced daily set does not inherit stale local counters.
    setStreakState({
      setId: activeSetId,
      value: {
        currentStreak: room.currentStreak ?? 0,
        highestStreak: room.highestStreak ?? 0,
      },
    });
  }
  // Chooses the first unanswered item as the initial focus so learners resume at the next useful action.
  const firstUnansweredQuestionIndex = useMemo(() => {
    if (!room || room.questions.length === 0) {
      return 0;
    }
    const firstUnansweredIndex = room.questions.findIndex(
      (question) => question.coreQuestion.lastAttempt === null,
    );

    return firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0;
  }, [room]);
  const selectedQuestionIndex =
    selectedQuestionIndexState.setId === activeSetId
      ? selectedQuestionIndexState.value
      : firstUnansweredQuestionIndex;
  // Local overrides are scoped by daily set id to keep resumed sessions isolated from a previous set's UI state.
  const unlockedHintByContentId =
    unlockedHintByContentIdState.setId === activeSetId
      ? unlockedHintByContentIdState.value
      : EMPTY_BOOLEAN_BY_CONTENT_ID;
  const selectedOptionOverrideByContentId =
    selectedOptionOverrideByContentIdState.setId === activeSetId
      ? selectedOptionOverrideByContentIdState.value
      : EMPTY_OPTION_OVERRIDE_BY_CONTENT_ID;
  const questionOverrideByQuestionUnitId =
    questionOverrideByQuestionUnitIdState.setId === activeSetId
      ? questionOverrideByQuestionUnitIdState.value
      : EMPTY_QUESTION_OVERRIDE_BY_QUESTION_ID;
  const progressOverride =
    progressOverrideState.setId === activeSetId
      ? progressOverrideState.value
      : null;

  // Log query failures once at the page boundary so the route only has to render a safe message.
  useEffect(() => {
    if (!dailyPracticeQuery.error) {
      return;
    }
    if (shouldLogApiError(dailyPracticeQuery.error)) {
      logError(dailyPracticeQuery.error, {
        feature: 'daily-practice',
        action: 'load',
        moduleId: parsedModuleId,
      });
    }
  }, [dailyPracticeQuery.error, parsedModuleId]);

  // Resets the queried session when routing changes to a different module.
  useEffect(() => {
    if (previousModuleIdRef.current === parsedModuleId) {
      return;
    }

    previousModuleIdRef.current = parsedModuleId;
    // Module changes should bootstrap from whatever session id the new URL carries.
    isSyncingSearchParamsRef.current = false;
    startTransition(() => {
      setQuerySessionId(requestedSessionId);
    });
  }, [parsedModuleId, requestedSessionId]);

  // Tracks externally supplied session ids, such as browser navigation, without reacting to URL writes from this hook.
  useEffect(() => {
    if (isSyncingSearchParamsRef.current) {
      isSyncingSearchParamsRef.current = false;
      return;
    }

    // Only external URL changes should retarget the room query; our own canonicalization already has the room data.
    startTransition(() => {
      setQuerySessionId(requestedSessionId);
    });
  }, [requestedSessionId]);

  // Keeps teardown handlers pointed at the latest active session id.
  useEffect(() => {
    latestSessionIdRef.current = room?.sessionId ?? null;
  }, [room?.sessionId]);

  // Keeps teardown handlers pointed at the latest parsed module id.
  useEffect(() => {
    latestModuleIdRef.current = parsedModuleId;
  }, [parsedModuleId]);

  // Keeps the latest mutation callback reachable from teardown handlers without re-registering lifecycle effects.
  useEffect(() => {
    closeSessionRef.current = closeSessionMutation.mutate;
  }, [closeSessionMutation.mutate]);

  // The server-issued session id is the canonical resume handle, so keep the URL in sync for reload-safe resumes.
  useEffect(() => {
    if (!room) {
      return;
    }
    if (querySessionId !== room.sessionId) {
      // Canonicalize the query identity immediately after bootstrap so later invalidations
      // refetch the same session instead of falling back to the anonymous "new session" entry point.
      startTransition(() => {
        setQuerySessionId(room.sessionId);
      });
    }
    if (requestedSessionId === room.sessionId) {
      return;
    }
    const nextSearchParams = new URLSearchParams(searchParamsString);
    nextSearchParams.set('sessionId', room.sessionId);
    // Track URL writes we initiated so the next effect keeps using the original query identity instead of refetching the same room.
    isSyncingSearchParamsRef.current = true;
    setSearchParams(nextSearchParams, { replace: true });
  }, [querySessionId, requestedSessionId, room, searchParamsString, setSearchParams]);

  // Close the active session when the page unmounts or the browser hides the page; the backend close is idempotent.
  useEffect(() => {
    // Sends the final close request at most once per session id, even if unmount and pagehide both fire.
    const closeSession = () => {
      const sessionId = latestSessionIdRef.current;
      const moduleId = latestModuleIdRef.current;
      if (!sessionId || moduleId === null) {
        return;
      }
      if (closedSessionIdsRef.current.has(sessionId)) {
        return;
      }
      closedSessionIdsRef.current.add(sessionId);

      closeSessionRef.current(sessionId, {
        onError: (error) => {
          closedSessionIdsRef.current.delete(sessionId);
          if (shouldLogApiError(error)) {
            logError(error, {
              feature: 'daily-practice',
              action: 'close-session',
              moduleId,
            });
          }
        },
      });
    };

    // Bridges the browser lifecycle event into the shared close-session routine.
    const handlePageHide = () => {
      closeSession();
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      closeSession();
    };
  }, []);

  // Applies locally submitted attempts over the server response so feedback appears immediately while cache invalidation runs.
  const roomWithLocalAttempts = useMemo<DailyPracticeTodayResponse | null>(() => {
    if (!room) {
      return null;
    }

    return {
      ...room,
      progress: progressOverride ?? room.progress,
      questions: room.questions.map((question) => {
        const questionOverride =
          questionOverrideByQuestionUnitId[question.questionUnitId];

        if (!questionOverride) {
          return question;
        }

        return {
          ...question,
          hasCorrectAttempt: questionOverride.hasCorrectAttempt,
          coreQuestion: {
            ...question.coreQuestion,
            lastAttempt: questionOverride.lastAttempt,
          },
        };
      }),
    };
  }, [progressOverride, questionOverrideByQuestionUnitId, room]);

  // Selects a valid active question even if a changed set makes the previously selected index out of range.
  const activeQuestionItem = useMemo<DailyPracticeQuestionItem | null>(() => {
    if (!roomWithLocalAttempts || roomWithLocalAttempts.questions.length === 0) {
      return null;
    }

    const clampedIndex = Math.max(
      0,
      Math.min(
        selectedQuestionIndex,
        roomWithLocalAttempts.questions.length - 1,
      ),
    );

    return (
      roomWithLocalAttempts.questions[clampedIndex] ??
      roomWithLocalAttempts.questions[0]
    );
  }, [roomWithLocalAttempts, selectedQuestionIndex]);

  // Narrows the active daily-practice item to the question shape expected by shared practice-room helpers.
  const activeQuestion = useMemo<ActiveDailyPracticeQuestion | null>(() => {
    if (!activeQuestionItem) {
      return null;
    }

    return {
      question: activeQuestionItem.coreQuestion.questionContent,
    };
  }, [activeQuestionItem]);

  // Extracts displayable options from the question payload through the shared parser used by Practice Room.
  const activeQuestionOptions = useMemo(() => {
    if (!activeQuestion) {
      return [];
    }

    return readQuestionOptions(activeQuestion.question.questionData);
  }, [activeQuestion]);

  // Rehydrates answer selections from persisted attempts so returning learners see their last submitted choice.
  const seededOptionByContentId = useMemo(() => {
    if (!roomWithLocalAttempts) {
      return {};
    }

    const seededSelection: Record<number, number> = {};
    for (const question of roomWithLocalAttempts.questions) {
      const persistedSelection = readSelectedOptionIndex(
        question.coreQuestion.lastAttempt?.studentAnswer,
      );
      if (persistedSelection !== null) {
        seededSelection[question.coreQuestion.questionContent.id] =
          persistedSelection;
      }
    }

    return seededSelection;
  }, [roomWithLocalAttempts]);

  // Local selections override persisted selections until submission confirms the new attempt.
  const selectedOptionByContentId = useMemo(
    () => ({
      ...seededOptionByContentId,
      ...selectedOptionOverrideByContentId,
    }),
    [seededOptionByContentId, selectedOptionOverrideByContentId],
  );

  // Validates stored selections against the current option list to avoid submitting stale indexes after content changes.
  const selectedOptionIndex = useMemo(() => {
    if (!activeQuestion) {
      return null;
    }

    const persistedSelection =
      selectedOptionByContentId[activeQuestion.question.id];
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

  const isActiveHintUnlocked = activeQuestion
    ? Boolean(unlockedHintByContentId[activeQuestion.question.id])
    : false;

  useEffect(() => {
    if (!activeQuestion) {
      return;
    }

    const activeContentId = activeQuestion.question.id;
    if (activeContentIdRef.current === activeContentId) {
      return;
    }

    activeContentIdRef.current = activeContentId;
    // View timing restarts only when the question content changes, not on unrelated rerenders.
    activeContentViewStartMsRef.current = Date.now();
  }, [activeQuestion]);

  // Builds navigation affordances with the same bounds logic used by the Practice Room module.
  const questionNav = useMemo(
    () =>
      buildQuestionUnitNav({
        totalQuestions: roomWithLocalAttempts?.questions.length ?? 0,
        selectedQuestionUnitIndex: selectedQuestionIndex,
      }),
    [roomWithLocalAttempts?.questions.length, selectedQuestionIndex],
  );

  const isLoading = parsedModuleId !== null && dailyPracticeQuery.isPending;

  // Converts routing and API failures into user-facing copy while preserving diagnostic logging elsewhere.
  const pageError = useMemo(() => {
    if (parsedModuleId === null) {
      return 'Daily practice not found. Please check the link and try again.';
    }
    if (dailyPracticeQuery.error) {
      return getDisplayErrorMessage(dailyPracticeQuery.error, {
        fallbackMessage:
          'We could not load today’s daily practice set right now. Please try again.',
      });
    }

    return null;
  }, [dailyPracticeQuery.error, parsedModuleId]);

  const canSubmitAttempt =
    Boolean(roomWithLocalAttempts && activeQuestionItem && activeQuestion) &&
    selectedOptionIndex !== null &&
    !submitAttemptMutation.isPending;

  // Moves the active question to a bounded index within the current daily set.
  const selectQuestion = (index: number) => {
    if (!roomWithLocalAttempts || roomWithLocalAttempts.questions.length === 0) {
      return;
    }

    const clampedIndex = Math.max(
      0,
      Math.min(index, roomWithLocalAttempts.questions.length - 1),
    );
    setSelectedQuestionIndexState({
      setId: activeSetId,
      value: clampedIndex,
    });
  };

  // Records an in-progress answer locally so the UI can defer feedback until the learner submits.
  const selectOption = (contentId: number, optionIndex: number) => {
    setSelectedOptionOverrideByContentIdState((previousValue) => ({
      setId: activeSetId,
      value: {
        ...(previousValue.setId === activeSetId
          ? previousValue.value
          : EMPTY_OPTION_OVERRIDE_BY_CONTENT_ID),
        [contentId]: optionIndex,
      },
    }));
  };

  // Persists hint visibility locally for the current set; the submitted attempt later reports whether it was used.
  const unlockHintForContent = (contentId: number) => {
    setUnlockedHintByContentIdState((previousValue) => ({
      setId: activeSetId,
      value: {
        ...(previousValue.setId === activeSetId
          ? previousValue.value
          : EMPTY_BOOLEAN_BY_CONTENT_ID),
        [contentId]: true,
      },
    }));
  };

  // Navigates backward relative to the current set-scoped index, falling back to the first unanswered item on fresh state.
  const goToPreviousQuestion = () => {
    setSelectedQuestionIndexState((previousValue) => ({
      setId: activeSetId,
      value: Math.max(
        0,
        (previousValue.setId === activeSetId
          ? previousValue.value
          : firstUnansweredQuestionIndex) - 1,
      ),
    }));
  };

  // Navigates forward relative to the current set-scoped index without allowing an out-of-range selection.
  const goToNextQuestion = () => {
    if (!roomWithLocalAttempts) {
      return;
    }

    setSelectedQuestionIndexState((previousValue) => ({
      setId: activeSetId,
      value: Math.min(
        roomWithLocalAttempts.questions.length - 1,
        (previousValue.setId === activeSetId
          ? previousValue.value
          : firstUnansweredQuestionIndex) + 1,
      ),
    }));
  };

  // Submits the active answer and folds the response back into local UI state before broader caches refresh.
  const submitActiveQuestionAttempt = async () => {
    if (
      !roomWithLocalAttempts ||
      !activeQuestionItem ||
      !activeQuestion ||
      selectedOptionIndex === null
    ) {
      return;
    }

    setSubmitErrorMessage(null);

    const studentAnswer: StudentAnswer = { selectedOptionIndex };
    const nowMs = Date.now();
    const viewStartedAtMs =
      activeContentIdRef.current === activeQuestion.question.id &&
      activeContentViewStartMsRef.current !== null
        ? activeContentViewStartMsRef.current
        : nowMs;

    try {
      // Time-on-question is measured client-side from content activation to submission for daily-practice analytics.
      const submitResponse = await submitAttemptMutation.mutateAsync({
        setId: roomWithLocalAttempts.setId,
        moduleUnitId: activeQuestionItem.moduleUnitId,
        questionUnitId: activeQuestionItem.questionUnitId,
        questionContentId: activeQuestion.question.id,
        sessionId: roomWithLocalAttempts.sessionId,
        timeTakenMs: Math.max(0, nowMs - viewStartedAtMs),
        hintUnlocked: isActiveHintUnlocked,
        studentAnswer,
      });

      // The backend grading vocabulary treats any non-"again" grade as a successful latest attempt for UI feedback.
      const latestAttemptIsCorrect = submitResponse.encounterGrade !== 'again';

      setQuestionOverrideByQuestionUnitIdState((previousValue) => ({
        setId: activeSetId,
        value: {
          ...(previousValue.setId === activeSetId
            ? previousValue.value
            : EMPTY_QUESTION_OVERRIDE_BY_QUESTION_ID),
          [activeQuestionItem.questionUnitId]: {
            lastAttempt: {
              studentAnswer,
              isCorrect: latestAttemptIsCorrect,
            },
            hasCorrectAttempt: submitResponse.hasCorrectAttempt ? true : null,
          },
        },
      }));
      setProgressOverrideState({
        setId: activeSetId,
        value: submitResponse.progress,
      });
      setSelectedOptionOverrideByContentIdState((previousValue) => {
        const nextValue = {
          ...(previousValue.setId === activeSetId
            ? previousValue.value
            : EMPTY_OPTION_OVERRIDE_BY_CONTENT_ID),
        };
        delete nextValue[activeQuestion.question.id];
        return {
          setId: activeSetId,
          value: nextValue,
        };
      });

      if (submitResponse.currentStreak !== undefined) {
        // Streak values are authoritative only when returned; older responses can omit them without resetting the UI.
        setStreakState({
          setId: activeSetId,
          value: {
            currentStreak: submitResponse.currentStreak,
            highestStreak: submitResponse.highestStreak ?? submitResponse.currentStreak,
          },
        });
      }

      // Show mastery XP gain chip and animate the progress bar.
      const masteryExp = submitResponse.awards.masteryExp ?? 0;
      if (masteryExp > 0) {
        const breakdown: ExpBreakdown = {
          base: 0,
          firstAttemptBonus: 0,
          streakBonus: 0,
          total: masteryExp,
        };
        applyExpAward(breakdown, moduleDetail);
      }

      void submitAttemptMutation.syncAttemptSuccessEffects(submitResponse);
    } catch (error) {
      setSubmitErrorMessage(
        getDisplayErrorMessage(error, {
          fallbackMessage:
            'We could not submit your daily-practice answer right now. Please try again.',
        }),
      );

      if (shouldLogApiError(error)) {
        logError(error, {
          feature: 'daily-practice',
          action: 'submit-attempt',
          moduleId: parsedModuleId,
        });
      }
    }
  };

  return {
    parsedModuleId,
    room: roomWithLocalAttempts,
    progress: roomWithLocalAttempts?.progress ?? null,
    isLoading,
    pageError,
    submitErrorMessage,
    isSubmittingAttempt: submitAttemptMutation.isPending,
    canSubmitAttempt,
    selectedQuestionIndex,
    activeQuestionItem,
    activeQuestion,
    activeQuestionOptions,
    questionNav,
    selectedOptionIndex,
    hasActiveOptionOverride,
    isActiveHintUnlocked,
    currentStreak,
    highestStreak,
    isStreakInitialized,
    moduleProgress,
    moduleExpGainIndicator,
    showLevelUp,
    selectQuestion,
    selectOption,
    unlockHintForContent,
    goToPreviousQuestion,
    goToNextQuestion,
    submitActiveQuestionAttempt,
  };
}
