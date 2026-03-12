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
  PracticeQuestionRewardState,
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
import {
  buildInitialSessionScopedState,
  hasSessionScopedValue,
  parsePositiveIntegerParam,
  readSessionScopedValue,
  seedSessionScopedValue,
  setSessionScopedBooleanValue,
  setSessionScopedValue,
  updateSessionScopedValue,
} from './practiceRoomPageStateUtils';

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

type QuestionRewardIndicator = {
  baseQuestionExpStatus: 'available' | 'already_earned';
  firstAttemptBonusStatus: 'available' | 'already_earned' | 'lost';
  isBaseQuestionExpAvailable: boolean;
  isFirstAttemptBonusAvailable: boolean;
  isFirstAttemptBonusLost: boolean;
};

type StreakTierIndicatorState = 'inactive' | 'active' | 'claimed';

type StreakRewardIndicators = {
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

type FirstTryBonusStatus = 'available' | 'earned' | 'lost';
const EMPTY_BOOLEAN_BY_CONTENT_ID: Record<number, boolean> = {};

export function usePracticeRoomPageState({
  moduleIdParam,
  unitIdParam,
}: UsePracticeRoomPageStateParams) {
  // ─── URL / param parsing ───────────────────────────────────────────────────
  // Route params arrive as raw strings; parse and validate them once here so
  // every downstream consumer receives typed, range-checked values.
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();

  const parsedModuleId = useMemo(
    () => parsePositiveIntegerParam(moduleIdParam),
    [moduleIdParam],
  );
  const parsedUnitId = useMemo(
    () => parsePositiveIntegerParam(unitIdParam),
    [unitIdParam],
  );

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
        buildInitialSessionScopedState(initialSelection, (selection) =>
          selection.selectedQuestionUnitIndex,
        ),
    );

  // Hint-unlock status per content id, per session.
  const [unlockedHintByContentIdBySessionId, setUnlockedHintByContentIdBySessionId] =
    useState<Record<string, Record<number, boolean>>>(
      () =>
        buildInitialSessionScopedState(
          initialSelection,
          (selection) => selection.unlockedHintByContentId,
        ),
    );

  // Which content ids have been submitted this session (used to lock re-submission).
  const [submittedByContentIdBySessionId, setSubmittedByContentIdBySessionId] =
    useState<Record<string, Record<number, boolean>>>(
      () =>
        buildInitialSessionScopedState(
          initialSelection,
          (selection) => selection.submittedByContentId,
        ),
    );

  // In-flight option selections the student has tapped but not yet submitted.
  const [selectedOptionOverrideByContentId, setSelectedOptionOverrideByContentId] =
    useState<Record<number, number>>({});

  // Optimistic attempt snapshots applied locally while the query cache catches up.
  const [submittedAttemptByContentId, setSubmittedAttemptByContentId] = useState<
    Record<number, PracticeAttemptSnapshot | null>
  >({});

  // Session-keyed streak counts relayed from the backend after each submission.
  // Keyed by sessionId so multiple sessions stay independent (same pattern as
  // submittedByContentIdBySessionId).
  const [currentStreakBySessionId, setCurrentStreakBySessionId] = useState<
    Record<string, number>
  >({});

  // Highest streak reached per session; updated alongside currentStreak so the
  // StreakIndicator pips know which tier bonuses have already been claimed.
  const [highestStreakBySessionId, setHighestStreakBySessionId] = useState<
    Record<string, number>
  >({});

  // Tracks the first-try accuracy result for each question content id.
  // 'first-try-correct' when the student earned a firstAttemptBonus,
  // 'incorrect' when the attempt was wrong. Keyed by content id so navigating
  // back to a question restores the indicator without a fresh API call.
  const [lastAttemptResultByContentId, setLastAttemptResultByContentId] = useState<
    Record<number, 'first-try-correct' | 'incorrect'>
  >({});

  // Tracks which content id is currently in view and when the student first saw
  // it, giving the submit handler accurate view-duration data without extra state.
  const activeContentIdRef = useRef<number | null>(null);
  const activeContentViewStartMsRef = useRef<number | null>(null);
  // Tracks the previous backend session id so transient in-memory maps can be
  // reset when the server rotates the active session.
  const previousSessionIdRef = useRef<string | null>(null);

  // Derived here (before the effects section) because the persistence write-effect
  // below depends on it; it cannot be deferred to the derived-state section.
  const activeSessionId = moduleUnitRoom?.sessionId ?? null;
  const selectedQuestionUnitIndex = useMemo(
    () =>
      readSessionScopedValue<number>(
        activeSessionId,
        selectedQuestionUnitIndexBySessionId,
        0,
      ),
    [activeSessionId, selectedQuestionUnitIndexBySessionId],
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
        return setSessionScopedValue(
          previousValue,
          moduleUnitRoom.sessionId,
          targetQuestionIndex,
        );
      });
      // Consume the one-time deep-link after applying the jump so future
      // refetches don't re-force this navigation.
      const nextSearchParams = new URLSearchParams(searchParamsString);
      if (nextSearchParams.has('questionId')) {
        nextSearchParams.delete('questionId');
        setSearchParams(nextSearchParams, { replace: true });
      }
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [moduleUnitRoom, requestedQuestionUnitId, searchParamsString, setSearchParams]);

  useEffect(() => {
    if (activeSessionId === null) {
      return;
    }
    const previousSessionId = previousSessionIdRef.current;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (
      previousSessionId !== null &&
      previousSessionId !== activeSessionId
    ) {
      // These maps are optimistic/transient view state, not persisted source-of-truth;
      // clear them when backend starts a new session to avoid cross-session leakage.
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

  // Initialize streak state from the initial API response so the StreakIndicator
  // shows the correct value on page load/refresh instead of defaulting to 0.
  useEffect(() => {
    if (!practiceRoomQuery.data) {
      return;
    }
    const { currentStreak = 0, highestStreak = 0, practiceRoom } =
      practiceRoomQuery.data;
    if (!practiceRoom) {
      return;
    }
    const frameId = requestAnimationFrame(() => {
      // Defer seeding to the next frame to avoid synchronous state writes in effects,
      // while still initializing immediately after room data arrives.
      setCurrentStreakBySessionId((previous) => {
        // Seed exactly once per session id so explicit local updates remain authoritative.
        return seedSessionScopedValue(previous, practiceRoom.sessionId, currentStreak);
      });
      setHighestStreakBySessionId((previous) => {
        return seedSessionScopedValue(previous, practiceRoom.sessionId, highestStreak);
      });
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [practiceRoomQuery.data]);

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
      readSessionScopedValue<Record<number, boolean>>(
        activeSessionId,
        unlockedHintByContentIdBySessionId,
        EMPTY_BOOLEAN_BY_CONTENT_ID,
      ),
    [activeSessionId, unlockedHintByContentIdBySessionId],
  );
  const submittedByContentId = useMemo(
    () =>
      readSessionScopedValue<Record<number, boolean>>(
        activeSessionId,
        submittedByContentIdBySessionId,
        EMPTY_BOOLEAN_BY_CONTENT_ID,
      ),
    [activeSessionId, submittedByContentIdBySessionId],
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

  // Compute static reward availability from backend room-load payload so UI can
  // render icons/tooltips before the learner submits another attempt.
  const questionRewardIndicatorsByQuestionUnitId = useMemo(
    () =>
      buildQuestionRewardIndicatorMap(roomWithLocalAttempts?.questions ?? []),
    [roomWithLocalAttempts?.questions],
  );

  // Active question indicator is looked up by questionUnit id so the page can
  // render concise per-question metadata without re-walking the room array.
  const activeQuestionRewardIndicator = useMemo(() => {
    if (!activeQuestionUnit) {
      return null;
    }
    return (
      questionRewardIndicatorsByQuestionUnitId[activeQuestionUnit.questionUnitId] ??
      buildQuestionRewardIndicator(undefined)
    );
  }, [activeQuestionUnit, questionRewardIndicatorsByQuestionUnitId]);

  // Resolve the active question's first-try-bonus state from local optimistic
  // overrides first, then fall back to backend reward-state snapshot.
  const activeFirstTryBonusStatus = useMemo<FirstTryBonusStatus>(() => {
    if (!activeQuestion) {
      return 'available';
    }
    const localAttemptResult = lastAttemptResultByContentId[activeQuestion.question.id];
    if (localAttemptResult === 'first-try-correct') {
      return 'earned';
    }
    if (localAttemptResult === 'incorrect') {
      return 'lost';
    }
    if (activeQuestionRewardIndicator?.firstAttemptBonusStatus === 'already_earned') {
      return 'earned';
    }
    if (activeQuestionRewardIndicator?.firstAttemptBonusStatus === 'lost') {
      return 'lost';
    }
    return 'available';
  }, [
    activeQuestion,
    activeQuestionRewardIndicator?.firstAttemptBonusStatus,
    lastAttemptResultByContentId,
  ]);

  // Lifetime claimed streak tiers come from room-load response and can differ
  // from current session streak; this powers "already claimed" UI affordances.
  const claimedStreakTiers = useMemo(
    () => practiceRoomQuery.data?.streakRewardState?.claimedTiers ?? [],
    [practiceRoomQuery.data?.streakRewardState?.claimedTiers],
  );

  // Session streak values drive "active vs inactive" tier state while claimed
  // tiers mark historical bonuses as already earned.
  const currentStreak = readSessionScopedValue<number>(
    roomWithLocalAttempts?.sessionId ?? null,
    currentStreakBySessionId,
    0,
  );
  const highestStreak = readSessionScopedValue<number>(
    roomWithLocalAttempts?.sessionId ?? null,
    highestStreakBySessionId,
    0,
  );
  const streakRewardIndicators = useMemo(
    () =>
      buildStreakRewardIndicators({
        totalQuestions: roomWithLocalAttempts?.questions.length ?? 0,
        currentStreak,
        claimedTiers: claimedStreakTiers,
      }),
    [claimedStreakTiers, currentStreak, roomWithLocalAttempts?.questions.length],
  );

  // ─── Submit attempt ────────────────────────────────────────────────────────
  // Payload building, mutation call, optimistic state, and error handling are
  // all owned by useSubmitAttempt; this hook only wires the required context.

  // Called by useSubmitAttempt after each successful submission to keep both
  // streak indicators in sync without an extra query round-trip.
  const updateCurrentStreak = (currentStreak: number, highestStreak: number) => {
    if (!roomWithLocalAttempts) return;
    const { sessionId } = roomWithLocalAttempts;
    setCurrentStreakBySessionId((previous) =>
      setSessionScopedValue(previous, sessionId, currentStreak),
    );
    setHighestStreakBySessionId((previous) =>
      setSessionScopedValue(previous, sessionId, highestStreak),
    );
  };

  // Updates the first-try accuracy indicator result after a submission.
  const updateLastAttemptResult = (
    contentId: number,
    result: 'first-try-correct' | 'incorrect' | null,
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

  // Resets the accuracy indicator to neutral for the given content id — but only
  // if the result was 'first-try-correct'. An 'incorrect' result is intentionally
  // preserved across retry attempts so the student can see they already got it wrong
  // and are trying again; clearing it would lose that visual context.
  const clearLastAttemptResult = (contentId: number) => {
    setLastAttemptResultByContentId((previous) => {
      if (previous[contentId] === 'incorrect') {
        // Keep red — don't wipe it when the student clicks "Try Again".
        return previous;
      }
      const next = { ...previous };
      delete next[contentId];
      return next;
    });
  };

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
    updateCurrentStreak,
    updateLastAttemptResult,
    activeFirstTryBonusStatus,
    clearLastAttemptResult,
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
    setSelectedQuestionUnitIndexBySessionId((previousValue) =>
      setSessionScopedValue(
        previousValue,
        roomWithLocalAttempts.sessionId,
        clampedIndex,
      ),
    );
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
    setUnlockedHintByContentIdBySessionId((previousValue) =>
      setSessionScopedBooleanValue(previousValue, sessionId, contentId, true),
    );
  };

  const goToPreviousQuestionUnit = () => {
    if (!questionUnitNav.canGoPrevious) return;
    if (!roomWithLocalAttempts) return;
    const sessionId = roomWithLocalAttempts.sessionId;
    setSelectedQuestionUnitIndexBySessionId((previousValue) =>
      updateSessionScopedValue(previousValue, sessionId, (currentValue) =>
        Math.max(0, (currentValue ?? 0) - 1),
      ),
    );
  };

  const goToNextQuestionUnit = () => {
    if (!roomWithLocalAttempts || !questionUnitNav.canGoNext) return;
    const sessionId = roomWithLocalAttempts.sessionId;
    setSelectedQuestionUnitIndexBySessionId((previousValue) =>
      updateSessionScopedValue(previousValue, sessionId, (currentValue) =>
        Math.min(
          roomWithLocalAttempts.questions.length - 1,
          (currentValue ?? 0) + 1,
        ),
      ),
    );
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
    rewardIndicators: {
      activeQuestion: activeQuestionRewardIndicator,
      byQuestionUnitId: questionRewardIndicatorsByQuestionUnitId,
      streak: streakRewardIndicators,
    },
    // Streak counts for the current session, relayed from the backend after each submission.
    currentStreak,
    // Session all-time high streak, used by pip indicators to show which tier bonuses are re-earnable.
    highestStreak,
    // True once the seeding effect has written the initial API values into the streak
    // state maps. The StreakIndicator uses this to suppress the "Bonus!" animation
    // on the async transition from pre-load 0 → actual value (which is not a real earn).
    isStreakInitialized: hasSessionScopedValue(
      roomWithLocalAttempts?.sessionId ?? null,
      highestStreakBySessionId,
    ),
    // The first-try accuracy result for the currently active question, or null if the
    // question hasn't been answered yet or the student clicked "Try Again".
    lastAttemptResult: activeQuestion
      ? (lastAttemptResultByContentId[activeQuestion.question.id] ?? null)
      : null,
    // First-try bonus status is backend-owned reward state plus optimistic local updates.
    firstTryBonusStatus: activeFirstTryBonusStatus,
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

// Reward-state defaults keep UI indicator rendering deterministic even when
// older API responses omit the new rewardState field.
function buildQuestionRewardIndicator(
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
function buildQuestionRewardIndicatorMap(
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

// Keep thresholds aligned with backend ExpCalculationService so indicator states
// and reward behavior remain consistent.
function resolveStreakThresholds(totalQuestions: number) {
  return {
    tier1: Math.max(3, Math.ceil(totalQuestions * 0.3)),
    tier2: Math.max(3, Math.ceil(totalQuestions * 0.5)),
    tier3: Math.max(3, totalQuestions),
  };
}

// Derives UI-tier state from session streak + lifetime claim state without
// requiring the UI layer to duplicate reward math.
function buildStreakRewardIndicators(input: {
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
