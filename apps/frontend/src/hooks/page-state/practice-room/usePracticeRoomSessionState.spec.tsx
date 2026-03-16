// Verifies session-scoped practice-room state so page orchestration can rely on a
// dedicated hook for persistence, deep-link consumption, and session-local actions.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import type {
  ModuleUnitPracticeRoom,
  ModuleUnitPracticeRoomResponse,
  PracticeQuestion,
  PracticeQuestionUnit,
} from '@scholarxp/api-contracts';
import type { SetURLSearchParams } from 'react-router-dom';
import type { PracticeRoomQuestionSelectionPersistence } from './usePracticeRoomPersistence';
import { usePracticeRoomSessionState } from './usePracticeRoomSessionState';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

function buildQuestion(
  id: number,
  optionText: string,
): PracticeQuestion {
  return {
    id,
    type: 'mcq',
    questionStem: `Question ${id}`,
    questionData: {
      // Shared MCQ contracts require four options, so tests should mirror the
      // canonical payload shape instead of relying on unsafe casts.
      options: [
        { optionText },
        { optionText: `${optionText} alt 1` },
        { optionText: `${optionText} alt 2` },
        { optionText: `${optionText} alt 3` },
      ],
      correctOptionIndex: 0,
    } as PracticeQuestion['questionData'],
    hint: null,
    difficultyScore: 1,
  };
}

function buildQuestionUnit(
  questionUnitId: number,
  contentId: number,
): PracticeQuestionUnit {
  return {
    questionUnitId,
    position: questionUnitId,
    hasCorrectAttempt: null,
    coreQuestion: {
      questionId: questionUnitId,
      questionContent: buildQuestion(contentId, `Option ${contentId}`),
      lastAttempt: null,
    },
  };
}

function buildRoom(): ModuleUnitPracticeRoom {
  return {
    sessionId: SESSION_ID,
    sessionType: PracticeSessionTypeValues.practiceRoom,
    moduleUnitId: 3,
    moduleUnitTitle: 'Unit',
    questions: [buildQuestionUnit(11, 100), buildQuestionUnit(12, 101)],
  };
}

function buildRoomResponse(
  overrides: Partial<ModuleUnitPracticeRoomResponse> = {},
): ModuleUnitPracticeRoomResponse {
  return {
    practiceRoom: buildRoom(),
    currentStreak: 1,
    highestStreak: 2,
    ...overrides,
  };
}

function buildInitialSelection(): PracticeRoomQuestionSelectionPersistence {
  return {
    sessionId: SESSION_ID,
    selectedQuestionUnitIndex: 1,
    unlockedHintByContentId: { 101: true },
    submittedByContentId: { 101: true },
  };
}

function renderSessionStateHook(
  overrides: Partial<Parameters<typeof usePracticeRoomSessionState>[0]> = {},
) {
  const persistSelection = vi.fn();
  const setSearchParams = vi.fn() as unknown as SetURLSearchParams;
  const room = buildRoom();
  const roomResponse = buildRoomResponse({ practiceRoom: room });

  const hook = renderHook(() =>
    usePracticeRoomSessionState({
      initialSelection: null,
      persistSelection,
      storageKey: 'practice-room-question-selection-v1:1:2',
      room,
      roomResponse,
      requestedQuestionUnitId: null,
      searchParamsString: '',
      setSearchParams,
      ...overrides,
    }),
  );

  return { ...hook, persistSelection, setSearchParams };
}

describe('usePracticeRoomSessionState', () => {
  it('hydrates selected question and session flags from persisted selection', () => {
    const { result } = renderSessionStateHook({
      initialSelection: buildInitialSelection(),
    });

    expect(result.current.selectedQuestionUnitIndex).toBe(1);
    expect(result.current.unlockedHintByContentId).toEqual({ 101: true });
    expect(result.current.submittedByContentId).toEqual({ 101: true });
  });

  it('supports session-scoped navigation actions with clamped bounds', () => {
    const { result } = renderSessionStateHook();

    act(() => {
      result.current.selectQuestionUnit(99);
    });
    expect(result.current.selectedQuestionUnitIndex).toBe(1);

    act(() => {
      result.current.goToPreviousQuestionUnit();
    });
    expect(result.current.selectedQuestionUnitIndex).toBe(0);

    act(() => {
      result.current.goToPreviousQuestionUnit();
      result.current.goToNextQuestionUnit();
    });
    expect(result.current.selectedQuestionUnitIndex).toBe(1);
  });

  it('persists selected question, hint unlocks, and submitted state for the active session', async () => {
    const { result, persistSelection } = renderSessionStateHook();

    act(() => {
      result.current.selectQuestionUnit(1);
      result.current.unlockHintForContent(101);
      result.current.markQuestionSubmitted(SESSION_ID, 101);
    });

    await waitFor(() => {
      expect(persistSelection).toHaveBeenLastCalledWith({
        sessionId: SESSION_ID,
        selectedQuestionUnitIndex: 1,
        unlockedHintByContentId: { 101: true },
        submittedByContentId: { 101: true },
      });
    });
  });

  it('seeds streak values from the room response and marks streak initialization', async () => {
    const { result } = renderSessionStateHook();

    await waitFor(() => {
      expect(result.current.currentStreak).toBe(1);
      expect(result.current.highestStreak).toBe(2);
      expect(result.current.isStreakInitialized).toBe(true);
    });

    act(() => {
      result.current.updateCurrentStreak(4, 5);
    });

    expect(result.current.currentStreak).toBe(4);
    expect(result.current.highestStreak).toBe(5);
  });

  it('consumes question deep-links after selecting the matching question', async () => {
    const { result, setSearchParams } = renderSessionStateHook({
      requestedQuestionUnitId: 12,
      searchParamsString: 'questionId=12&sessionId=11111111-1111-4111-8111-111111111111',
    });

    await waitFor(() => {
      expect(result.current.selectedQuestionUnitIndex).toBe(1);
      expect(setSearchParams).toHaveBeenCalled();
    });

    const [nextSearchParams, options] = vi.mocked(setSearchParams).mock.calls.at(-1) ?? [];
    expect(String(nextSearchParams)).toBe('sessionId=11111111-1111-4111-8111-111111111111');
    expect(options).toEqual({ replace: true });
  });
});
