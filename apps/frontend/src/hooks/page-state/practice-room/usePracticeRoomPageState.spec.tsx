import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { logError } from '../../../utils/logger';

vi.mock('../../queries/usePracticeRoomQueries', () => ({
  useModuleUnitPracticeRoomQuery: vi.fn(),
  useSubmitModuleUnitPracticeAttemptMutation: vi.fn(),
  useCloseModuleUnitPracticeSessionMutation: vi.fn(),
}));
vi.mock('../../queries/useModulesQueries', () => ({
  useModuleDetailQuery: vi.fn(),
}));
vi.mock('../../../api/get-display-error', () => ({
  getDisplayErrorMessage: (err: unknown) => `display:${String(err)}`,
  shouldLogApiError: () => true,
}));
vi.mock('../../../utils/logger', () => ({ logError: vi.fn() }));

import { usePracticeRoomPageState } from './usePracticeRoomPageState';
import {
  useCloseModuleUnitPracticeSessionMutation,
  useModuleUnitPracticeRoomQuery,
  useSubmitModuleUnitPracticeAttemptMutation,
} from '../../queries/usePracticeRoomQueries';
import { useModuleDetailQuery } from '../../queries/useModulesQueries';

type PracticeRoomPageState = ReturnType<typeof usePracticeRoomPageState>;

function renderHookWithParams(
  moduleIdParam?: string,
  unitIdParam?: string,
  initialEntry: string = '/main/modules/1/1/practice-room',
) {
  let latest: PracticeRoomPageState | null = null;

  function TestWrapper() {
    const state = usePracticeRoomPageState({ moduleIdParam, unitIdParam });
    React.useEffect(() => {
      latest = state;
    });
    return <div>ok</div>;
  }

  const utils = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TestWrapper />
    </MemoryRouter>,
  );
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
  const useCloseModuleUnitPracticeSessionMutationMock =
    useCloseModuleUnitPracticeSessionMutation as unknown as Mock;
  const closeSessionMutateMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
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
        awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
        hasCorrectAttempt: false,
      }),
    });
    closeSessionMutateMock.mockReset();
    useCloseModuleUnitPracticeSessionMutationMock.mockReturnValue({
      mutate: closeSessionMutateMock,
    });
  });

  it('parses module/unit ids and exposes not-found error for invalid ids', () => {
    const valid = renderHookWithParams('5', '2').getState();
    expect(valid.parsedModuleId).toBe(5);
    expect(valid.parsedUnitId).toBe(2);

    const invalid = renderHookWithParams(undefined, undefined).getState();
    expect(invalid.pageError).toContain('Practice room not found');
  });

  it('passes sessionId query param into the practice-room query hook', () => {
    renderHookWithParams(
      '1',
      '1',
      '/main/modules/1/1/practice-room?sessionId=11111111-1111-4111-8111-111111111077',
    );

    expect(useModuleUnitPracticeRoomQueryMock).toHaveBeenCalledWith(
      1,
      1,
      '11111111-1111-4111-8111-111111111077',
    );
  });

  it('closes the active session on unmount', async () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: '11111111-1111-4111-8111-111111111077',
          moduleUnitId: 3,
          moduleUnitTitle: 'Unit',
          questions: [],
        },
      },
    });

    const rendered = renderHookWithParams('1', '1');
    rendered.unmount();

    await waitFor(() => {
      expect(closeSessionMutateMock).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111077',
        expect.objectContaining({
          onError: expect.any(Function),
        }),
      );
    });
  });

  it('selects the targeted question when questionId query param is present', async () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: '11111111-1111-4111-8111-111111111007',
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
                lastAttempt: null,
              },
            },
            {
              questionUnitId: 12,
              position: 2,
              hasCorrectAttempt: null,
              coreQuestion: {
                questionId: 12,
                questionContent: {
                  id: 101,
                  type: 'mcq',
                  questionStem: 'Second core stem',
                  questionData: {
                    options: [{ optionText: 'C' }, { optionText: 'D' }],
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

    const rendered = renderHookWithParams(
      '1',
      '1',
      '/main/modules/1/1/practice-room?questionId=12',
    );

    await waitFor(() => {
      expect(rendered.getState().selectedQuestionUnitIndex).toBe(1);
      expect(rendered.getState().activeQuestion?.question.id).toBe(101);
    });
  });

  it('uses core question as active question and seeds selected option from core last attempt', () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: '11111111-1111-4111-8111-111111111007',
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
    expect(state.activeQuestion?.question.id).toBe(100);
    expect(state.selectedOptionIndex).toBe(1);
    expect(state.activeQuestionOptions).toHaveLength(2);
  });

  it('restores selected question after reload while clearing unsubmitted option selection', () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: '11111111-1111-4111-8111-111111111007',
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
                lastAttempt: null,
              },
            },
            {
              questionUnitId: 12,
              position: 2,
              hasCorrectAttempt: null,
              coreQuestion: {
                questionId: 12,
                questionContent: {
                  id: 101,
                  type: 'mcq',
                  questionStem: 'Second core stem',
                  questionData: {
                    options: [{ optionText: 'C' }, { optionText: 'D' }],
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

    const initialRender = renderHookWithParams('1', '1');
    act(() => {
      initialRender.getState().selectQuestionUnit(1);
      initialRender.getState().selectOption(101, 1);
    });
    expect(initialRender.getState().selectedQuestionUnitIndex).toBe(1);
    expect(initialRender.getState().selectedOptionIndex).toBe(1);
    initialRender.unmount();

    const reloadedRender = renderHookWithParams('1', '1');
    expect(reloadedRender.getState().selectedQuestionUnitIndex).toBe(1);
    expect(reloadedRender.getState().activeQuestion?.question.id).toBe(101);
    expect(reloadedRender.getState().selectedOptionIndex).toBeNull();
  });

  it('persists unlocked hint state on reload for the same session', () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: '11111111-1111-4111-8111-111111111007',
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
                  hint: 'Helpful hint',
                  difficultyScore: 1,
                },
                lastAttempt: null,
              },
            },
          ],
        },
      },
    });

    const initialRender = renderHookWithParams('1', '1');
    act(() => {
      initialRender.getState().unlockHintForContent(100);
    });
    expect(initialRender.getState().isActiveHintUnlocked).toBe(true);
    initialRender.unmount();

    const reloadedRender = renderHookWithParams('1', '1');
    expect(reloadedRender.getState().isActiveHintUnlocked).toBe(true);
  });

  it('persists submitted status on reload for the same session', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: false,
    });
    useSubmitModuleUnitPracticeAttemptMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync,
    });
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: '11111111-1111-4111-8111-111111111007',
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
                lastAttempt: null,
              },
            },
          ],
        },
      },
    });

    const initialRender = renderHookWithParams('1', '1');
    act(() => {
      initialRender.getState().selectOption(100, 0);
    });
    await act(async () => {
      await initialRender.getState().submitActiveQuestionAttempt();
    });
    expect(initialRender.getState().hasSubmittedActiveQuestion).toBe(true);
    initialRender.unmount();

    const reloadedRender = renderHookWithParams('1', '1');
    expect(reloadedRender.getState().hasSubmittedActiveQuestion).toBe(true);
  });

  it('resets selected question to the beginning when a new practice session starts', () => {
    let currentSessionId = '11111111-1111-4111-8111-111111111007';
    useModuleUnitPracticeRoomQueryMock.mockImplementation(() => ({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: currentSessionId,
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
                lastAttempt: null,
              },
            },
            {
              questionUnitId: 12,
              position: 2,
              hasCorrectAttempt: null,
              coreQuestion: {
                questionId: 12,
                questionContent: {
                  id: 101,
                  type: 'mcq',
                  questionStem: 'Second stem',
                  questionData: {
                    options: [{ optionText: 'C' }, { optionText: 'D' }],
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
    }));

    const initialRender = renderHookWithParams('1', '1');
    act(() => {
      initialRender.getState().selectQuestionUnit(1);
    });
    expect(initialRender.getState().selectedQuestionUnitIndex).toBe(1);
    initialRender.unmount();

    currentSessionId = '11111111-1111-4111-8111-111111111008';
    const nextSessionRender = renderHookWithParams('1', '1');
    expect(nextSessionRender.getState().selectedQuestionUnitIndex).toBe(0);
    expect(nextSessionRender.getState().activeQuestion?.question.id).toBe(100);
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
          sessionId: '11111111-1111-4111-8111-111111111009',
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

  it('keeps selection and submit locked when backend marks room as read-only', () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: '11111111-1111-4111-8111-111111111011',
          moduleUnitId: 3,
          moduleUnitTitle: 'Unit',
          isReadOnly: true,
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
                    correctOptionIndex: 1,
                  },
                  hint: 'Read-only hint',
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
    expect(state.isRoomReadOnly).toBe(true);
    expect(state.canSubmitAttempt).toBe(false);

    act(() => {
      state.selectOption(200, 1);
      state.unlockHintForContent(200);
    });

    state = rendered.getState();
    expect(state.selectedOptionIndex).toBeNull();
    expect(state.isActiveHintUnlocked).toBe(false);
    expect(state.canSubmitAttempt).toBe(false);
  });

  it('locks already-correct questions and keeps incorrect revisits retryable', () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: '11111111-1111-4111-8111-111111111012',
          moduleUnitId: 3,
          moduleUnitTitle: 'Unit',
          questions: [
            {
              questionUnitId: 31,
              position: 1,
              hasCorrectAttempt: true,
              coreQuestion: {
                questionId: 31,
                questionContent: {
                  id: 301,
                  type: 'mcq',
                  questionStem: 'Already correct',
                  questionData: {
                    options: [{ optionText: 'A' }, { optionText: 'B' }],
                    correctOptionIndex: 0,
                  },
                  hint: null,
                  difficultyScore: 1,
                },
                lastAttempt: { studentAnswer: { selectedOptionIndex: 0 }, isCorrect: true },
              },
            },
            {
              questionUnitId: 32,
              position: 2,
              hasCorrectAttempt: false,
              coreQuestion: {
                questionId: 32,
                questionContent: {
                  id: 302,
                  type: 'mcq',
                  questionStem: 'Previously incorrect',
                  questionData: {
                    options: [{ optionText: 'C' }, { optionText: 'D' }],
                    correctOptionIndex: 1,
                  },
                  hint: null,
                  difficultyScore: 1,
                },
                lastAttempt: { studentAnswer: { selectedOptionIndex: 0 }, isCorrect: false },
              },
            },
          ],
        },
      },
    });

    const rendered = renderHookWithParams('1', '1');
    let state = rendered.getState();

    expect(state.isActiveQuestionLockedCorrect).toBe(true);
    expect(state.canSubmitAttempt).toBe(false);
    expect(state.selectedOptionIndex).toBe(0);

    act(() => {
      state.selectOption(301, 1);
    });

    state = rendered.getState();
    expect(state.selectedOptionIndex).toBe(0);

    act(() => {
      state.selectQuestionUnit(1);
    });

    state = rendered.getState();
    expect(state.isActiveQuestionLockedCorrect).toBe(false);

    act(() => {
      state.selectOption(302, 1);
    });

    state = rendered.getState();
    expect(state.selectedOptionIndex).toBe(1);
    expect(state.canSubmitAttempt).toBe(true);
  });

  it('shows try again after incorrect submit and clears submitted state when retried', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: false,
    });
    useSubmitModuleUnitPracticeAttemptMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync,
    });
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: '11111111-1111-4111-8111-111111111010',
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
                    correctOptionIndex: 1,
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

    state = rendered.getState();
    expect(state.hasSubmittedActiveQuestion).toBe(true);
    expect(state.showTryAgainButton).toBe(true);

    act(() => {
      state.tryAgainActiveQuestion();
    });

    state = rendered.getState();
    expect(state.hasSubmittedActiveQuestion).toBe(false);
    expect(state.showTryAgainButton).toBe(false);
  });

  it('animates module progress and levels up when awarded exp crosses the threshold', async () => {
    const requestAnimationFrameSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(performance.now() + 1_000);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(globalThis, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);

    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 50, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: true,
    });
    useSubmitModuleUnitPracticeAttemptMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync,
    });
    useModuleDetailQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        id: 1,
        userModuleLevel: 1,
        currentExp: 980,
        expMax: 1000,
      },
    });
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        practiceRoom: {
          sessionId: '11111111-1111-4111-8111-111111111010',
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
                    correctOptionIndex: 1,
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
    expect(state.moduleProgress).toEqual({
      level: 1,
      currentExp: 980,
      expPercent: 98,
    });

    act(() => {
      state.selectOption(200, 1);
    });
    state = rendered.getState();
    await act(async () => {
      await state.submitActiveQuestionAttempt();
    });

    state = rendered.getState();
    expect(state.moduleProgress).toEqual({
      level: 2,
      currentExp: 30,
      expPercent: 3,
    });

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });
});
