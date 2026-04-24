// Encapsulates practice-room route orchestration so the page component can stay presentational.
// Sub-concerns (session lifecycle, XP animation, persistence, attempt submission) are each
// delegated to a dedicated hook; this file wires them together and owns the final page-state API.
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  PracticeSessionType,
} from '@scholarxp/api-contracts';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '@/shared/api/get-display-error';
import { logError } from '@/utils/logger';
import {
  useCloseModuleUnitPracticeSessionMutation,
  useModuleUnitPracticeRoomQuery,
  useSubmitModuleUnitPracticeAttemptMutation,
} from '@/Practice-Room/queries/usePracticeRoomQueries';
import { useModuleDetailQuery } from '@/Authoring/queries/useModulesQueries';
import { useModuleProgressAnimation } from '@/Practice-Room/page-state/useModuleProgressAnimation';
import { usePracticeRoomCompletionFlow } from '@/Practice-Room/page-state/usePracticeRoomCompletionFlow';
import { useSessionLifecycle } from '@/Practice-Room/page-state/useSessionLifecycle';
import { usePracticeRoomPersistence } from '@/Practice-Room/page-state/usePracticeRoomPersistence';
import { useSubmitAttempt } from '@/Practice-Room/page-state/useSubmitAttempt';
import { parsePositiveIntegerParam } from '@/Practice-Room/page-state/practiceRoomPageStateUtils';
import {
  type FirstTryBonusStatus,
  type QuestionUnitNav,
  buildQuestionUnitNav,
  buildQuestionRewardIndicator,
  buildQuestionRewardIndicatorMap,
  buildStreakRewardIndicators,
  parsePracticeRoomQuestionUnitIdQuery,
  parsePracticeRoomSessionIdQuery,
  parsePracticeRoomSessionTypeQuery,
  resolveFirstTryBonusStatus,
} from '@/Practice-Room/page-state/practiceRoomDerivedState';
import { usePracticeRoomSessionState } from '@/Practice-Room/page-state/usePracticeRoomSessionState';
import { usePracticeRoomInteractionState } from '@/Practice-Room/page-state/usePracticeRoomInteractionState';

type UsePracticeRoomPageStateParams = {
  moduleIdParam: string | undefined;
  unitIdParam: string | undefined;
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
  const requestedSessionType = parsePracticeRoomSessionTypeQuery(
    searchParams.get('sessionType'),
  );
  const requestedQuestionUnitId = parsePracticeRoomQuestionUnitIdQuery(
    searchParams.get('questionId'),
  );
  const [querySessionId, setQuerySessionId] = useState<string | null>(
    requestedSessionId,
  );
  const previousRoomScopeRef = useRef(
    `${parsedModuleId ?? 'null'}:${parsedUnitId ?? 'null'}`,
  );
  const isSyncingSearchParamsRef = useRef(false);

  // ─── Queries & mutations ───────────────────────────────────────────────────
  // All server I/O is declared up-front so the rest of the hook is purely reactive.
  const practiceRoomQuery = useModuleUnitPracticeRoomQuery(
    parsedModuleId,
    parsedUnitId,
    querySessionId,
    requestedSessionType,
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
  const {
    isLessonCompleteModalOpen,
    deferLessonCompleteRewards,
    dismissLessonCompleteModal,
  } = usePracticeRoomCompletionFlow({
    applyExpAward,
    moduleDetail,
    syncAttemptSuccessEffects: submitAttemptMutation.syncAttemptSuccessEffects,
  });

  // Persistence is wired before state so lazy initialisers can seed from
  // localStorage on the very first render.
  const { initialSelection, persistSelection, storageKey } = usePracticeRoomPersistence({
    moduleId: parsedModuleId,
    unitId: parsedUnitId,
  });

  const {
    activeSessionId,
    selectedQuestionUnitIndex,
    unlockedHintByContentId,
    submittedByContentId,
    currentStreak,
    highestStreak,
    isStreakInitialized,
    selectQuestionUnit,
    unlockHintForContent: unlockHintForActiveSession,
    goToPreviousQuestionUnit,
    goToNextQuestionUnit,
    markQuestionSubmitted,
    updateCurrentStreak,
  } = usePracticeRoomSessionState({
    initialSelection,
    persistSelection,
    storageKey,
    room: moduleUnitRoom,
    roomResponse: practiceRoomQuery.data ?? null,
    requestedQuestionUnitId,
    searchParamsString,
    setSearchParams,
  });

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

  useEffect(() => {
    const nextRoomScope = `${parsedModuleId ?? 'null'}:${parsedUnitId ?? 'null'}`;
    if (previousRoomScopeRef.current === nextRoomScope) {
      return;
    }

    previousRoomScopeRef.current = nextRoomScope;
    // Route changes should bootstrap from whatever session id the new URL carries.
    isSyncingSearchParamsRef.current = false;
    startTransition(() => {
      setQuerySessionId(requestedSessionId);
    });
  }, [parsedModuleId, parsedUnitId, requestedSessionId]);

  useEffect(() => {
    if (isSyncingSearchParamsRef.current) {
      isSyncingSearchParamsRef.current = false;
      return;
    }

    // Only external URL changes should retarget the room query; our own canonicalization already has the room payload.
    startTransition(() => {
      setQuerySessionId(requestedSessionId);
    });
  }, [requestedSessionId]);

  // Keep the ?sessionId= param in sync with the server-assigned session so a
  // hard reload always resumes the same session instead of creating a new one.
  useEffect(() => {
    if (!moduleUnitRoom) {
      return;
    }
    if (querySessionId !== moduleUnitRoom.sessionId) {
      // Once the backend assigns a session id, all future refetches must use it
      // so invalidations keep targeting the active room instead of bootstrapping a new one.
      startTransition(() => {
        setQuerySessionId(moduleUnitRoom.sessionId);
      });
    }
    if (requestedSessionId === moduleUnitRoom.sessionId) {
      return;
    }
    const nextSearchParams = new URLSearchParams(searchParamsString);
    nextSearchParams.set('sessionId', String(moduleUnitRoom.sessionId));
    // Mark URL writes we initiated so they do not immediately retrigger the same room load with a different cache key.
    isSyncingSearchParamsRef.current = true;
    setSearchParams(nextSearchParams, { replace: true });
  }, [
    moduleUnitRoom,
    querySessionId,
    requestedSessionId,
    searchParamsString,
    setSearchParams,
  ]);

  // Backend-owned session type is the canonical read-only signal; isReadOnly is
  // kept as an additional guard while session-type APIs stabilise.
  const sessionType: PracticeSessionType =
    moduleUnitRoom?.sessionType ?? PracticeSessionTypeValues.practiceRoom;
  const isRoomReadOnly =
    moduleUnitRoom?.isReadOnly === true ||
    sessionType === PracticeSessionTypeValues.viewAnswers;
  const areRewardIndicatorsDisabled =
    sessionType === PracticeSessionTypeValues.retry;

  const {
    roomWithLocalAttempts,
    activeQuestionUnit,
    activeQuestion,
    activeQuestionOptions,
    selectedOptionIndex,
    hasActiveOptionOverride,
    lastAttemptResult,
    activeContentIdRef,
    activeContentViewStartMsRef,
    selectOption,
    clearSelectedOptionOverride,
    recordSubmittedAttempt,
    updateLastAttemptResult,
  } = usePracticeRoomInteractionState({
    room: moduleUnitRoom,
    activeSessionId,
    selectedQuestionUnitIndex,
    isRoomReadOnly,
  });

  // Session lifecycle must be wired after roomWithLocalAttempts is available
  // so it can pass a stable sessionId to the close-on-unmount effect.
  useSessionLifecycle({
    sessionId: roomWithLocalAttempts?.sessionId ?? null,
    moduleId: parsedModuleId,
    unitId: parsedUnitId,
    closeSession: closeSessionMutation.mutate,
  });
  const questionUnitNav = useMemo<QuestionUnitNav>(() => {
    return buildQuestionUnitNav({
      totalQuestions: roomWithLocalAttempts?.questions.length ?? 0,
      selectedQuestionUnitIndex,
    });
  }, [roomWithLocalAttempts, selectedQuestionUnitIndex]);

  // ─── Active question flags ─────────────────────────────────────────────────
  // Scalar booleans derived from all the above; kept flat so the page component
  // can destructure them directly without any further computation.

  const isActiveHintUnlocked = activeQuestion
    ? Boolean(unlockedHintByContentId[activeQuestion.question.id])
    : false;
  const hasSubmittedActiveQuestion = activeQuestion
    ? Boolean(submittedByContentId[activeQuestion.question.id])
    : false;

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
    return resolveFirstTryBonusStatus({
      hasActiveQuestion: activeQuestion !== null,
      lastAttemptResult,
      rewardIndicator: activeQuestionRewardIndicator,
      isHintUnlocked: isActiveHintUnlocked,
    });
  }, [
    activeQuestion,
    activeQuestionRewardIndicator,
    isActiveHintUnlocked,
    lastAttemptResult,
  ]);

  // Lifetime claimed streak tiers come from room-load response and can differ
  // from current session streak; this powers "already claimed" UI affordances.
  const claimedStreakTiers = useMemo(
    () => practiceRoomQuery.data?.streakRewardState?.claimedTiers ?? [],
    [practiceRoomQuery.data?.streakRewardState?.claimedTiers],
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

  const {
    submitErrorMessage,
    isSubmittingAttempt,
    canSubmitAttempt,
    submitActiveQuestionAttempt,
  } = useSubmitAttempt({
    room: roomWithLocalAttempts,
    activeQuestionUnit,
    activeQuestion,
    isRoomReadOnly,
    selectedOptionIndex,
    isActiveHintUnlocked,
    activeContentIdRef,
    activeContentViewStartMsRef,
    mutateAsync: submitAttemptMutation.mutateAsync,
    isPending: submitAttemptMutation.isPending,
    applyExpAward,
    moduleDetail,
    syncAttemptSuccessEffects: submitAttemptMutation.syncAttemptSuccessEffects,
    updateCurrentStreak,
    updateLastAttemptResult,
    activeFirstTryBonusStatus,
    clearSelectedOptionOverride,
    markQuestionSubmitted,
    recordSubmittedAttempt,
    onModuleUnitCompleted: deferLessonCompleteRewards,
    shouldCelebrateModuleUnitCompletion:
      sessionType === PracticeSessionTypeValues.practiceRoom && !isRoomReadOnly,
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

  const unlockHintForContent = (contentId: number) => {
    if (isRoomReadOnly) {
      return;
    }
    unlockHintForActiveSession(contentId);
  };

  return {
    parsedModuleId,
    parsedUnitId,
    room: roomWithLocalAttempts,
    moduleProgress,
    moduleExpGainIndicator,
    showLevelUp,
    isLessonCompleteModalOpen,
    isLoading:
      practiceRoomQuery.isPending ||
      (moduleDetailQuery.isPending && !isProgressInitialized),
    sessionType,
    pageError,
    submitErrorMessage,
    isSubmittingAttempt,
    isRoomReadOnly,
    canSubmitAttempt,
    areRewardIndicatorsDisabled,
    selectedQuestionUnitIndex,
    activeQuestionUnit,
    activeQuestion,
    activeQuestionOptions,
    questionUnitNav,
    selectedOptionIndex,
    hasSubmittedActiveQuestion,
    hasActiveOptionOverride,
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
    isStreakInitialized,
    // The first-try accuracy result for the currently active question, or null if the
    // question hasn't been answered yet or the student clicked "Try Again".
    lastAttemptResult,
    // First-try bonus status is backend-owned reward state plus optimistic local updates.
    firstTryBonusStatus: activeFirstTryBonusStatus,
    selectQuestionUnit,
    selectOption,
    isActiveHintUnlocked,
    unlockHintForContent,
    submitActiveQuestionAttempt,
    dismissLessonCompleteModal,
    goToPreviousQuestionUnit,
    goToNextQuestionUnit,
  };
}
