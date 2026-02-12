import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { logError } from '../../utils/logger';

vi.mock('../queries/usePracticeRoomQueries', () => ({
  useModuleUnitPracticeRoomQuery: vi.fn(),
  useSubmitModuleUnitPracticeAttemptMutation: vi.fn(),
}));
vi.mock('../queries/useModulesQueries', () => ({
  useModuleDetailQuery: vi.fn(),
}));
vi.mock('../../api/get-display-error', () => ({
  getDisplayErrorMessage: (err: unknown) => `display:${String(err)}`,
  shouldLogApiError: () => true,
}));
vi.mock('../../utils/logger', () => ({ logError: vi.fn() }));

import { usePracticeRoomPageState } from './usePracticeRoomPageState';
import {
  useModuleUnitPracticeRoomQuery,
  useSubmitModuleUnitPracticeAttemptMutation,
} from '../queries/usePracticeRoomQueries';
import { useModuleDetailQuery } from '../queries/useModulesQueries';

type PracticeRoomPageState = ReturnType<typeof usePracticeRoomPageState>;

function renderHookWithParams(moduleIdParam?: string, unitIdParam?: string) {
  let latest: PracticeRoomPageState | null = null;

  function TestWrapper() {
    const state = usePracticeRoomPageState({ moduleIdParam, unitIdParam });
    React.useEffect(() => {
      latest = state;
    });
    return <div>ok</div>;
  }

  const utils = render(<TestWrapper />);
  return {
    ...utils,
    getState: () => latest as PracticeRoomPageState,
  };
}

describe('usePracticeRoomPageState (core-only)', () => {
  const useModuleUnitPracticeRoomQueryMock =
    useModuleUnitPracticeRoomQuery as unknown as Mock;
  const useModuleDetailQueryMock = useModuleDetailQuery as unknown as Mock;
  const useSubmitModuleUnitPracticeAttemptMutationMock =
    useSubmitModuleUnitPracticeAttemptMutation as unknown as Mock;

  beforeEach(() => {
    vi.resetAllMocks();
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      data: null,
      error: null,
    });
    useModuleDetailQueryMock.mockReturnValue({
      isPending: false,
      data: null,
      error: null,
    });
    useSubmitModuleUnitPracticeAttemptMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue({
        moduleExpAwarded: 0,
        studentExpAwarded: 0,
        hasCorrectAttempt: false,
      }),
    });
  });

  it('parses module/unit ids and exposes not-found error for invalid ids', () => {
    const valid = renderHookWithParams('5', '2').getState();
    expect(valid.parsedModuleId).toBe(5);
    expect(valid.parsedUnitId).toBe(2);

    const invalid = renderHookWithParams(undefined, undefined).getState();
    expect(invalid.pageError).toContain('Practice room not found');
  });

  it('uses core question as active question and seeds selected option from core last attempt', () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: 7,
          moduleUnitId: 3,
          moduleUnitTitle: 'Unit',
          questions: [
            {
              questionUnitId: 11,
              position: 1,
              hasCorrectAttempt: null,
              coreQuestion: {
                questionId: 11,
                questionContent: {
                  id: 100,
                  type: 'mcq',
                  questionStem: 'Core stem',
                  questionData: {
                    options: [{ optionText: 'A' }, { optionText: 'B' }],
                    correctOptionIndex: 1,
                  },
                  hint: null,
                  difficultyScore: 1,
                },
                lastAttempt: { studentAnswer: { selectedOptionIndex: 1 }, isCorrect: false },
              },
            },
          ],
        },
      },
    });

    const state = renderHookWithParams('1', '1').getState();
    expect(state.activeQuestion.question.id).toBe(100);
    expect(state.selectedOptionIndex).toBe(1);
    expect(state.activeQuestionOptions).toHaveLength(2);
  });

  it('submits core attempt payload and records submit errors with logger', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('submit-fail'));
    useSubmitModuleUnitPracticeAttemptMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync,
    });
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: 9,
          moduleUnitId: 3,
          moduleUnitTitle: 'Unit',
          questions: [
            {
              questionUnitId: 22,
              position: 1,
              hasCorrectAttempt: null,
              coreQuestion: {
                questionId: 22,
                questionContent: {
                  id: 200,
                  type: 'mcq',
                  questionStem: 'Q',
                  questionData: {
                    options: [{ optionText: 'A' }, { optionText: 'B' }],
                    correctOptionIndex: 0,
                  },
                  hint: null,
                  difficultyScore: 1,
                },
                lastAttempt: null,
              },
            },
          ],
        },
      },
    });

    const rendered = renderHookWithParams('1', '1');
    let state = rendered.getState();

    act(() => {
      state.selectOption(200, 0);
    });

    state = rendered.getState();
    await act(async () => {
      await state.submitActiveQuestionAttempt();
    });

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        questionUnitId: 22,
        questionContentId: 200,
      }),
    );
    expect(rendered.getState().submitErrorMessage).toBe('display:Error: submit-fail');
    expect(logError).toHaveBeenCalled();
  });
});
