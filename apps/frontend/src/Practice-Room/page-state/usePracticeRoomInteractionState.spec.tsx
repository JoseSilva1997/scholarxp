// Verifies transient practice-room interaction state so composition code can rely
// on one hook for optimistic attempts, draft answers, and active-question timing.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import type {
  ModuleUnitPracticeRoom,
  PracticeAttemptSnapshot,
  PracticeQuestion,
  PracticeQuestionUnit,
} from '@scholarxp/api-contracts';
import { usePracticeRoomInteractionState } from '@/Practice-Room/page-state/usePracticeRoomInteractionState';

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
  };
}

function buildQuestionUnit(
  questionUnitId: number,
  contentId: number,
  lastAttempt: PracticeAttemptSnapshot | null = null,
): PracticeQuestionUnit {
  return {
    questionUnitId,
    position: questionUnitId,
    hasCorrectAttempt: lastAttempt?.isCorrect === true ? true : null,
    coreQuestion: {
      questionId: questionUnitId,
      questionContent: buildQuestion(contentId, `Option ${contentId}`),
      lastAttempt,
    },
  };
}

function buildRoom(
  sessionId: string,
  firstQuestionAttempt: PracticeAttemptSnapshot | null = null,
): ModuleUnitPracticeRoom {
  return {
    sessionId,
    sessionType: PracticeSessionTypeValues.practiceRoom,
    moduleUnitId: 3,
    moduleUnitTitle: 'Unit',
    questions: [
      buildQuestionUnit(11, 100, firstQuestionAttempt),
      buildQuestionUnit(12, 101),
    ],
  };
}

describe('usePracticeRoomInteractionState', () => {
  it('seeds selectedOptionIndex from the latest server attempt and lets draft selections override it', () => {
    const { result } = renderHook(() =>
      usePracticeRoomInteractionState({
        room: buildRoom('session-1', {
          studentAnswer: { selectedOptionIndex: 1 },
          isCorrect: false,
        }),
        activeSessionId: 'session-1',
        selectedQuestionUnitIndex: 0,
        isRoomReadOnly: false,
      }),
    );

    expect(result.current.selectedOptionIndex).toBe(1);
    expect(result.current.hasActiveOptionOverride).toBe(false);

    act(() => {
      result.current.selectOption(100, 0);
    });

    expect(result.current.selectedOptionIndex).toBe(0);
    expect(result.current.hasActiveOptionOverride).toBe(true);
  });

  it('ignores draft selection writes in read-only sessions', () => {
    const { result } = renderHook(() =>
      usePracticeRoomInteractionState({
        room: buildRoom('session-1'),
        activeSessionId: 'session-1',
        selectedQuestionUnitIndex: 0,
        isRoomReadOnly: true,
      }),
    );

    act(() => {
      result.current.selectOption(100, 1);
    });

    expect(result.current.selectedOptionIndex).toBeNull();
    expect(result.current.hasActiveOptionOverride).toBe(false);
  });

  it('records submitted attempts and first-try local results for the active question', () => {
    const { result } = renderHook(() =>
      usePracticeRoomInteractionState({
        room: buildRoom('session-1'),
        activeSessionId: 'session-1',
        selectedQuestionUnitIndex: 0,
        isRoomReadOnly: false,
      }),
    );

    act(() => {
      result.current.recordSubmittedAttempt(100, {
        studentAnswer: { selectedOptionIndex: 0 },
        isCorrect: true,
      });
      result.current.updateLastAttemptResult(100, 'first-try-correct');
    });

    expect(result.current.roomWithLocalAttempts?.questions[0]?.coreQuestion.lastAttempt).toEqual({
      studentAnswer: { selectedOptionIndex: 0 },
      isCorrect: true,
    });
    expect(result.current.lastAttemptResult).toBe('first-try-correct');
  });

  it('clears transient interaction state when the active session changes', async () => {
    const { result, rerender } = renderHook(
      ({
        room,
        activeSessionId,
      }: {
        room: ModuleUnitPracticeRoom;
        activeSessionId: string;
      }) =>
        usePracticeRoomInteractionState({
          room,
          activeSessionId,
          selectedQuestionUnitIndex: 0,
          isRoomReadOnly: false,
        }),
      {
        initialProps: {
          room: buildRoom('session-1'),
          activeSessionId: 'session-1',
        },
      },
    );

    act(() => {
      result.current.selectOption(100, 0);
      result.current.recordSubmittedAttempt(100, {
        studentAnswer: { selectedOptionIndex: 0 },
        isCorrect: true,
      });
      result.current.updateLastAttemptResult(100, 'incorrect');
    });

    rerender({
      room: buildRoom('session-2'),
      activeSessionId: 'session-2',
    });

    await waitFor(() => {
      expect(result.current.selectedOptionIndex).toBeNull();
      expect(result.current.hasActiveOptionOverride).toBe(false);
      expect(result.current.lastAttemptResult).toBeNull();
      expect(result.current.roomWithLocalAttempts?.questions[0]?.coreQuestion.lastAttempt).toBeNull();
    });
  });

  it('updates active-question timing refs when question navigation changes', async () => {
    const { result, rerender } = renderHook(
      ({ selectedQuestionUnitIndex }: { selectedQuestionUnitIndex: number }) =>
        usePracticeRoomInteractionState({
          room: buildRoom('session-1'),
          activeSessionId: 'session-1',
          selectedQuestionUnitIndex,
          isRoomReadOnly: false,
        }),
      {
        initialProps: { selectedQuestionUnitIndex: 0 },
      },
    );

    await waitFor(() => {
      expect(result.current.activeContentIdRef.current).toBe(100);
      expect(result.current.activeContentViewStartMsRef.current).not.toBeNull();
    });

    rerender({ selectedQuestionUnitIndex: 1 });

    await waitFor(() => {
      expect(result.current.activeContentIdRef.current).toBe(101);
      expect(result.current.activeContentViewStartMsRef.current).not.toBeNull();
    });
  });
});
