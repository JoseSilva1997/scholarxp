// Encapsulates practice-room route orchestration so the page component can stay presentational.
// Sub-concerns (session lifecycle, XP animation, persistence, attempt submission) are each
// delegated to a dedicated hook; this file wires them together and owns the final page-state API.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  ModuleUnitPracticeRoomResponse,
  PracticeSessionType,
  PracticeAttemptSnapshot,
  PracticeQuestion,
  PracticeQuestionUnit,
} from '@scholarxp/api-contracts';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../../api/get-display-error';
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
import { useSubmitAttempt } from './useSubmitAttempt';

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
  // ─── URL / param parsing ───────────────────────────────────────────────────
  // Route params arrive as raw strings; parse and validate them once here so
  // every downstream consumer receives typed, range-checked values.
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

  // Session id and question id come from the URL so rooms survive hard reloads
  // and a ?questionId= deep-link jumps straight to the right question.
  const requestedSessionId = parsePracticeRoomSessionIdQuery(
    searchParams.get('sessionId'),
  );
  const requestedQuestionUnitId = parsePracticeRoomQuestionUnitIdQuery(
    searchParams.get('questionId'),
  );

  // ─── Queries & mutations ───────────────────────────────────────────────────
  // All server I/O is declared up-front so the rest of the hook is purely reactive.
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

  // Unwrap to stable null-safe references used throughout the hook.
  const moduleUnitRoom = practiceRoomQuery.data?.practiceRoom ?? null;
  const moduleDetail = moduleDetailQuery.data ?? null;

  // ─── Sub-hooks ─────────────────────────────────────────────────────────────
  // Self-contained cross-cutting concerns are delegated to dedicated hooks.
  // This hook wires their outputs together and owns the overall page-state API.

  // XP animation bar, level-up celebration, and exp-gain chip.
  const {
    moduleProgress,
    moduleExpGainIndicator,
    showLevelUp,
    isProgressInitialized,
    applyExpAward,
  } = useModuleProgressAnimation({ moduleDetail, moduleId: parsedModuleId });

  // Persistence is wired before state so lazy initialisers can seed from
  // localStorage on the very first render.
  const { initialSelection, persistSelection, storageKey } = usePracticeRoomPersistence({
    moduleId: parsedModuleId,
    unitId: parsedUnitId,
  });

  // ─── Local session state ───────────────────────────────────────────────────
  // All three main maps are keyed by sessionId so in-progress state survives
  // seamlessly if the backend assigns a fresh session (e.g. a retry session).

  // Which question-unit index is currently displayed, per session.
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

  // Hint-unlock status per content id, per session.
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

  // Which content ids have been submitted this session (used to lock re-submission).
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

  // In-flight option selections the student has tapped but not yet submitted.
  const [selectedOptionOverrideByContentId, setSelectedOptionOverrideByContentId] =
    useState<Record<number, number>>({});

  // Optimistic attempt snapshots applied locally while the query cache catches up.
  const [submittedAttemptByContentId, setSubmittedAttemptByContentId] = useState<
    Record<number, PracticeAttemptSnapshot | null>
  >({});

  // Tracks which content id is currently in view and when the student first saw
  // it, giving the submit handler accurate view-duration data without extra state.
  const activeContentIdRef = useRef<number | null>(null);
  const activeContentViewStartMsRef = useRef<number | null>(null);

  // Derived here (before the effects section) because the persistence write-effect
  // below depends on it; it cannot be deferred to the derived-state section.
  const selectedQuestionUnitIndex = useMemo(
    () =>
      moduleUnitRoom
        ? selectedQuestionUnitIndexBySessionId[moduleUnitRoom.sessionId] ?? 0
        : 0,
    [moduleUnitRoom, selectedQuestionUnitIndexBySessionId],
  );

  // ─── Side effects ──────────────────────────────────────────────────────────

  // Log query errors server-side; the UI surfaces safe messages via pageError.
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

  // Keep the ?sessionId= param in sync with the server-assigned session so a
  // hard reload always resumes the same session instead of creating a new one.
  useEffect(() => {
    if (!moduleUnitRoom) {
      return;
    }
    if (requestedSessionId === moduleUnitRoom.sessionId) {
      return;
    }
    const nextSearchParams = new URLSearchParams(searchParamsString);
    nextSearchParams.set('sessionId', String(moduleUnitRoom.sessionId));
    setSearchParams(nextSearchParams, { replace: true });
  }, [
    moduleUnitRoom,
    requestedSessionId,
    searchParamsString,
    setSearchParams,
  ]);

  // Honour a ?questionId= deep-link by jumping to the matching question once
  // the room data arrives; rAF defers the state write to satisfy hook lint rules.
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

  // Write question-selection progress to localStorage after every relevant
  // change so the student can resume mid-session after a page refresh.
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

  // ─── Derived room state ────────────────────────────────────────────────────

  // Merge server snapshots with pending local attempts so progress bars and
  // question-status chips update immediately before TanStack Query refetches.
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

  // Backend-owned session type is the canonical read-only signal; isReadOnly is
  // kept as an additional guard while session-type APIs stabilise.
  const sessionType: PracticeSessionType =
    roomWithLocalAttempts?.sessionType ?? PracticeSessionTypeValues.practiceRoom;
  const isRoomReadOnly =
    roomWithLocalAttempts?.isReadOnly === true ||
    sessionType === PracticeSessionTypeValues.viewAnswers;

  // Session lifecycle must be wired after roomWithLocalAttempts is available
  // so it can pass a stable sessionId to the close-on-unmount effect.
  useSessionLifecycle({
    sessionId: roomWithLocalAttempts?.sessionId ?? null,
    moduleId: parsedModuleId,
    unitId: parsedUnitId,
    closeSession: closeSessionMutation.mutate,
  });

  // ─── Derived option & active-question state ────────────────────────────────

  // Seed option selections from the latest server-side attempt so choices are
  // restored when the student reopens a room mid-session.
  const seededOptionByContentId = useMemo(() => {
    if (!roomWithLocalAttempts) return {};
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

  // Student overrides win over seeded values; merged into one map so the option
  // panel only needs a single lookup.
  const selectedOptionByContentId = useMemo(
    () => ({
      ...seededOptionByContentId,
      ...selectedOptionOverrideByContentId,
    }),
    [seededOptionByContentId, selectedOptionOverrideByContentId],
  );

  // Active question is the question-unit at the clamped selected index.
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

  // Start the view-duration timer whenever the active content id changes.
  // The ref values are consumed by the submit handler to compute timeTakenMs.
  useEffect(() => {
    if (!activeQuestion) {
      return;
    }
    const activeContentId = activeQuestion.question.id;
    if (activeContentIdRef.current === activeContentId) {
      return;
    }
    // Timing starts when the content item first becomes active, not when the room opens.
    activeContentIdRef.current = activeContentId;
    activeContentViewStartMsRef.current = Date.now();
  }, [activeQuestion]);

  // Slice the session-keyed maps down to the active session so consumers
  // receive flat maps without needing to know the sessionId.
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

  // ─── Active question flags ─────────────────────────────────────────────────
  // Scalar booleans derived from all the above; kept flat so the page component
  // can destructure them directly without any further computation.

  // Clamp the selected option to the valid option range; null if nothing is selected.
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

  const isActiveHintUnlocked = activeQuestion
    ? Boolean(unlockedHintByContentId[activeQuestion.question.id])
    : false;
  const hasSubmittedActiveQuestion = activeQuestion
    ? Boolean(submittedByContentId[activeQuestion.question.id])
    : false;
  // Persisted feedback is suppressed once the learner starts a new draft selection.
  const hasActiveOptionOverride = activeQuestion
    ? Object.prototype.hasOwnProperty.call(
        selectedOptionOverrideByContentId,
        activeQuestion.question.id,
      )
    : false;
  const isActiveQuestionIncorrect =
    activeQuestionUnit?.coreQuestion.lastAttempt?.isCorrect === false;
  const showTryAgainButton = hasSubmittedActiveQuestion && isActiveQuestionIncorrect;

  // ─── Submit attempt ────────────────────────────────────────────────────────
  // Payload building, mutation call, optimistic state, and error handling are
  // all owned by useSubmitAttempt; this hook only wires the required context.
  const {
    submitErrorMessage,
    isSubmittingAttempt,
    canSubmitAttempt,
    submitActiveQuestionAttempt,
    tryAgainActiveQuestion,
  } = useSubmitAttempt({
    room: roomWithLocalAttempts,
    activeQuestionUnit,
    activeQuestion,
    isRoomReadOnly,
    selectedOptionIndex,
    hasSubmittedActiveQuestion,
    isActiveHintUnlocked,
    activeContentIdRef,
    activeContentViewStartMsRef,
    mutateAsync: submitAttemptMutation.mutateAsync,
    isPending: submitAttemptMutation.isPending,
    applyExpAward,
    moduleDetail,
    setSubmittedAttemptByContentId,
    setSubmittedByContentIdBySessionId,
    parsedModuleId,
    parsedUnitId,
  });

  // ─── Page-level error ──────────────────────────────────────────────────────
  // Consolidated user-safe error string derived last so it has access to all
  // query and param state; shown as a full-page fallback by the component.
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

  // ─── Actions ───────────────────────────────────────────────────────────────
  // Event handlers passed to the page component; declared last so they can
  // close over all derived state above without forward-reference issues.

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
    isSubmittingAttempt,
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

// ─── File-level utilities ─────────────────────────────────────────────────────
// Pure functions are kept at module scope (not inside the hook) to give the
// bundler a stable reference and keep the hook body free of unrelated logic.

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

// Student-answer payloads differ by question type; this helper safely extracts
// MCQ/true-false selectedOptionIndex values when available.
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

// Normalise question data into a flat option list for rendering.
// Unknown or unsupported question schemas return an empty list safely.
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

// URL query-param parsers — validate before use so the hook receives typed values.
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
