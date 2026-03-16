// Owns session-scoped practice-room state so the main page-state hook can compose
// behavior without directly managing repeated `sessionId -> value` maps.
import { useEffect, useMemo, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import type { ModuleUnitPracticeRoomResponse } from '@scholarxp/api-contracts';
import type { PracticeRoomQuestionSelectionPersistence } from './usePracticeRoomPersistence';
import {
  buildInitialSessionScopedState,
  hasSessionScopedValue,
  readSessionScopedValue,
  seedSessionScopedValue,
  setSessionScopedBooleanValue,
  setSessionScopedValue,
  updateSessionScopedValue,
} from './practiceRoomPageStateUtils';

type UsePracticeRoomSessionStateParams = {
  initialSelection: PracticeRoomQuestionSelectionPersistence | null;
  persistSelection: (snapshot: PracticeRoomQuestionSelectionPersistence) => void;
  storageKey: string | null;
  room: ModuleUnitPracticeRoomResponse['practiceRoom'] | null;
  roomResponse: ModuleUnitPracticeRoomResponse | null;
  requestedQuestionUnitId: number | null;
  searchParamsString: string;
  setSearchParams: SetURLSearchParams;
};

type UsePracticeRoomSessionStateResult = {
  activeSessionId: string | null;
  selectedQuestionUnitIndex: number;
  unlockedHintByContentId: Record<number, boolean>;
  submittedByContentId: Record<number, boolean>;
  currentStreak: number;
  highestStreak: number;
  isStreakInitialized: boolean;
  selectQuestionUnit: (index: number) => void;
  unlockHintForContent: (contentId: number) => void;
  goToPreviousQuestionUnit: () => void;
  goToNextQuestionUnit: () => void;
  markQuestionSubmitted: (sessionId: string, contentId: number) => void;
  updateCurrentStreak: (currentStreak: number, highestStreak: number) => void;
};

const EMPTY_BOOLEAN_BY_CONTENT_ID: Record<number, boolean> = {};

export function usePracticeRoomSessionState({
  initialSelection,
  persistSelection,
  storageKey,
  room,
  roomResponse,
  requestedQuestionUnitId,
  searchParamsString,
  setSearchParams,
}: UsePracticeRoomSessionStateParams): UsePracticeRoomSessionStateResult {
  // Local state is keyed by session id so retries/new sessions do not leak
  // persisted position or submission flags into a different backend session.
  const [selectedQuestionUnitIndexBySessionId, setSelectedQuestionUnitIndexBySessionId] =
    useState<Record<string, number>>(
      () =>
        buildInitialSessionScopedState(initialSelection, (selection) =>
          selection.selectedQuestionUnitIndex,
        ),
    );
  const [unlockedHintByContentIdBySessionId, setUnlockedHintByContentIdBySessionId] =
    useState<Record<string, Record<number, boolean>>>(
      () =>
        buildInitialSessionScopedState(
          initialSelection,
          (selection) => selection.unlockedHintByContentId,
        ),
    );
  const [submittedByContentIdBySessionId, setSubmittedByContentIdBySessionId] =
    useState<Record<string, Record<number, boolean>>>(
      () =>
        buildInitialSessionScopedState(
          initialSelection,
          (selection) => selection.submittedByContentId,
        ),
    );
  const [currentStreakBySessionId, setCurrentStreakBySessionId] = useState<
    Record<string, number>
  >({});
  const [highestStreakBySessionId, setHighestStreakBySessionId] = useState<
    Record<string, number>
  >({});

  const activeSessionId = room?.sessionId ?? null;
  const selectedQuestionUnitIndex = useMemo(
    () =>
      readSessionScopedValue<number>(
        activeSessionId,
        selectedQuestionUnitIndexBySessionId,
        0,
      ),
    [activeSessionId, selectedQuestionUnitIndexBySessionId],
  );
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
  const currentStreak = readSessionScopedValue<number>(
    activeSessionId,
    currentStreakBySessionId,
    0,
  );
  const highestStreak = readSessionScopedValue<number>(
    activeSessionId,
    highestStreakBySessionId,
    0,
  );

  // Honour a question deep-link once per room load, then consume it so later
  // query refreshes do not force the learner back to that question.
  useEffect(() => {
    if (!room || requestedQuestionUnitId === null) {
      return;
    }
    const targetQuestionIndex = room.questions.findIndex(
      (questionUnit) => questionUnit.questionUnitId === requestedQuestionUnitId,
    );
    if (targetQuestionIndex < 0) {
      return;
    }
    const frameId = requestAnimationFrame(() => {
      setSelectedQuestionUnitIndexBySessionId((previousValue) =>
        setSessionScopedValue(previousValue, room.sessionId, targetQuestionIndex),
      );
      const nextSearchParams = new URLSearchParams(searchParamsString);
      if (nextSearchParams.has('questionId')) {
        nextSearchParams.delete('questionId');
        setSearchParams(nextSearchParams, { replace: true });
      }
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [requestedQuestionUnitId, room, searchParamsString, setSearchParams]);

  // Streak values come from the first room payload and should seed exactly once
  // so later optimistic submit updates remain authoritative for that session.
  useEffect(() => {
    if (!roomResponse?.practiceRoom) {
      return;
    }
    const { currentStreak = 0, highestStreak = 0, practiceRoom } = roomResponse;
    const frameId = requestAnimationFrame(() => {
      setCurrentStreakBySessionId((previous) =>
        seedSessionScopedValue(previous, practiceRoom.sessionId, currentStreak),
      );
      setHighestStreakBySessionId((previous) =>
        seedSessionScopedValue(previous, practiceRoom.sessionId, highestStreak),
      );
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [roomResponse]);

  // Persist the learner's session-specific progress after each meaningful
  // change so reloads resume where they left off in the same session only.
  useEffect(() => {
    if (storageKey === null || !room) {
      return;
    }
    const sessionId = room.sessionId;
    persistSelection({
      sessionId,
      selectedQuestionUnitIndex,
      unlockedHintByContentId:
        unlockedHintByContentIdBySessionId[sessionId] ?? {},
      submittedByContentId: submittedByContentIdBySessionId[sessionId] ?? {},
    });
  }, [
    persistSelection,
    room,
    selectedQuestionUnitIndex,
    storageKey,
    submittedByContentIdBySessionId,
    unlockedHintByContentIdBySessionId,
  ]);

  const selectQuestionUnit = (index: number) => {
    if (!room || room.questions.length === 0) {
      return;
    }
    const clampedIndex = Math.max(0, Math.min(index, room.questions.length - 1));
    setSelectedQuestionUnitIndexBySessionId((previousValue) =>
      setSessionScopedValue(previousValue, room.sessionId, clampedIndex),
    );
  };

  const unlockHintForContent = (contentId: number) => {
    if (!room) {
      return;
    }
    // Hints are sticky per session/content so reward rules can treat unlock as a one-time event.
    setUnlockedHintByContentIdBySessionId((previousValue) =>
      setSessionScopedBooleanValue(previousValue, room.sessionId, contentId, true),
    );
  };

  const goToPreviousQuestionUnit = () => {
    if (!room) {
      return;
    }
    setSelectedQuestionUnitIndexBySessionId((previousValue) =>
      updateSessionScopedValue(previousValue, room.sessionId, (currentValue) =>
        Math.max(0, (currentValue ?? 0) - 1),
      ),
    );
  };

  const goToNextQuestionUnit = () => {
    if (!room) {
      return;
    }
    setSelectedQuestionUnitIndexBySessionId((previousValue) =>
      updateSessionScopedValue(previousValue, room.sessionId, (currentValue) =>
        Math.min(room.questions.length - 1, (currentValue ?? 0) + 1),
      ),
    );
  };

  const markQuestionSubmitted = (sessionId: string, contentId: number) => {
    setSubmittedByContentIdBySessionId((previousValue) =>
      setSessionScopedBooleanValue(previousValue, sessionId, contentId, true),
    );
  };

  const updateCurrentStreak = (nextCurrentStreak: number, nextHighestStreak: number) => {
    if (!room) {
      return;
    }
    setCurrentStreakBySessionId((previous) =>
      setSessionScopedValue(previous, room.sessionId, nextCurrentStreak),
    );
    setHighestStreakBySessionId((previous) =>
      setSessionScopedValue(previous, room.sessionId, nextHighestStreak),
    );
  };

  return {
    activeSessionId,
    selectedQuestionUnitIndex,
    unlockedHintByContentId,
    submittedByContentId,
    currentStreak,
    highestStreak,
    isStreakInitialized: hasSessionScopedValue(activeSessionId, highestStreakBySessionId),
    selectQuestionUnit,
    unlockHintForContent,
    goToPreviousQuestionUnit,
    goToNextQuestionUnit,
    markQuestionSubmitted,
    updateCurrentStreak,
  };
}
