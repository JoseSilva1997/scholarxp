// Verifies daily-practice page-state orchestration so route behavior stays stable while the adaptive flow evolves.
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { logError } from '../../utils/logger';

vi.mock('../queries/useDailyPracticeQueries', () => ({
  useTodayDailyPracticeQuery: vi.fn(),
  useSubmitDailyPracticeAttemptMutation: vi.fn(),
  useCloseDailyPracticeSessionMutation: vi.fn(),
}));
vi.mock('../queries/useModulesQueries', () => ({
  useModuleDetailQuery: () => ({ data: null, isPending: false, error: null }),
}));
vi.mock('./useModuleProgressAnimation', () => ({
  useModuleProgressAnimation: () => ({
    moduleProgress: null,
    moduleExpGainIndicator: null,
    showLevelUp: false,
    isProgressInitialized: false,
    applyExpAward: vi.fn(),
  }),
}));
vi.mock('../../api/get-display-error', () => ({
  getDisplayErrorMessage: (err: unknown) => `display:${String(err)}`,
  shouldLogApiError: () => true,
}));
vi.mock('../../utils/logger', () => ({ logError: vi.fn() }));

import type {
  DailyPracticeTodayResponse,
  SubmitDailyPracticeAttemptResponse,
} from '@scholarxp/api-contracts';
import { useDailyPracticePageState } from './useDailyPracticePageState';
import {
  useCloseDailyPracticeSessionMutation,
  useSubmitDailyPracticeAttemptMutation,
  useTodayDailyPracticeQuery,
} from '../queries/useDailyPracticeQueries';

type DailyPracticePageState = ReturnType<typeof useDailyPracticePageState>;

function buildDailyPracticeResponse(
  input?: Partial<DailyPracticeTodayResponse>,
): DailyPracticeTodayResponse {
  return {
    setId: '11111111-1111-4111-8111-111111111201',
    moduleId: 7,
    practiceDateUtc: '2026-03-20T00:00:00.000Z',
    sessionId: '11111111-1111-4111-8111-111111111202',
    algorithmVersion: 'fsrs_v1',
    progress: {
      totalQuestions: 2,
      answeredQuestions: 0,
      completedAt: null,
    },
    questions: [
      {
        questionUnitId: 101,
        moduleUnitId: 11,
        moduleUnitTitle: 'Lesson 1',
        position: 0,
        hasCorrectAttempt: null,
        sourceBucket: 'due_review',
        coreQuestion: {
          questionId: 101,
          questionContent: {
            id: 501,
            type: 'mcq',
            questionStem: 'Question 1',
            questionData: {
              options: [
                { optionText: 'A', explanation: undefined },
                { optionText: 'B', explanation: undefined },
                { optionText: 'C', explanation: undefined },
                { optionText: 'D', explanation: undefined },
              ],
              correctOptionIndex: 0,
            },
            hint: 'Hint 1',
            difficultyScore: 0.5,
          },
          lastAttempt: null,
        },
      },
      {
        questionUnitId: 102,
        moduleUnitId: 12,
        moduleUnitTitle: 'Lesson 2',
        position: 1,
        hasCorrectAttempt: null,
        sourceBucket: 'reinforcement',
        coreQuestion: {
          questionId: 102,
          questionContent: {
            id: 502,
            type: 'mcq',
            questionStem: 'Question 2',
            questionData: {
              options: [
                { optionText: 'A', explanation: undefined },
                { optionText: 'B', explanation: undefined },
                { optionText: 'C', explanation: undefined },
                { optionText: 'D', explanation: undefined },
              ],
              correctOptionIndex: 1,
            },
            hint: null,
            difficultyScore: 0.2,
          },
          lastAttempt: null,
        },
      },
    ],
    ...input,
  };
}

function buildSubmitResponse(
  overrides: Partial<SubmitDailyPracticeAttemptResponse> = {},
): SubmitDailyPracticeAttemptResponse {
  return {
    awards: {
      baseQuestionExp: 0,
      firstAttemptBonus: 0,
      streakBonus: 0,
        masteryExp: 0,
      accountExp: 0,
    },
    hasCorrectAttempt: true,
    progress: {
      totalQuestions: 2,
      answeredQuestions: 1,
      completedAt: null,
    },
    encounterGrade: 'good',
    ...overrides,
  };
}

function renderHookWithParams(
  moduleIdParam?: string,
  initialEntry = '/main/modules/7/daily-practice',
) {
  let latest: DailyPracticePageState | null = null;
  let latestSearch = '';

  function TestWrapper() {
    const state = useDailyPracticePageState({ moduleIdParam });
    const location = useLocation();

    React.useEffect(() => {
      latest = state;
      latestSearch = location.search;
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
    getState: () => latest as DailyPracticePageState,
    getSearch: () => latestSearch,
  };
}

describe('useDailyPracticePageState', () => {
  const useTodayDailyPracticeQueryMock =
    useTodayDailyPracticeQuery as unknown as Mock;
  const useSubmitDailyPracticeAttemptMutationMock =
    useSubmitDailyPracticeAttemptMutation as unknown as Mock;
  const useCloseDailyPracticeSessionMutationMock =
    useCloseDailyPracticeSessionMutation as unknown as Mock;
  const submitMutateAsyncMock = vi.fn();
  const syncAttemptSuccessEffectsMock = vi.fn().mockResolvedValue(undefined);
  const closeSessionMutateMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    useTodayDailyPracticeQueryMock.mockReturnValue({
      isPending: false,
      data: null,
      error: null,
    });
    useSubmitDailyPracticeAttemptMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync: submitMutateAsyncMock,
      syncAttemptSuccessEffects: syncAttemptSuccessEffectsMock,
    });
    useCloseDailyPracticeSessionMutationMock.mockReturnValue({
      mutate: closeSessionMutateMock,
    });
    submitMutateAsyncMock.mockReset();
    syncAttemptSuccessEffectsMock.mockReset();
    closeSessionMutateMock.mockReset();
  });

  it('returns a not-found page error for invalid module params', () => {
    const state = renderHookWithParams(undefined).getState();

    expect(state.parsedModuleId).toBeNull();
    expect(state.pageError).toContain('Daily practice not found');
  });

  it('passes the sessionId query param into the daily-practice query hook', () => {
    renderHookWithParams(
      '7',
      '/main/modules/7/daily-practice?sessionId=11111111-1111-4111-8111-111111111203',
    );

    expect(useTodayDailyPracticeQueryMock).toHaveBeenCalledWith(
      7,
      '11111111-1111-4111-8111-111111111203',
    );
  });

  it('syncs the server session id back into the URL without switching the active query session', async () => {
    useTodayDailyPracticeQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: buildDailyPracticeResponse(),
    });

    const rendered = renderHookWithParams('7');

    await waitFor(() => {
      expect(rendered.getSearch()).toBe(
        '?sessionId=11111111-1111-4111-8111-111111111202',
      );
    });

    expect(useTodayDailyPracticeQueryMock).toHaveBeenLastCalledWith(7, null);
  });

  it('closes the active session on unmount', async () => {
    useTodayDailyPracticeQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: buildDailyPracticeResponse(),
    });

    const rendered = renderHookWithParams('7');
    rendered.unmount();

    await waitFor(() => {
      expect(closeSessionMutateMock).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111202',
        expect.objectContaining({
          onError: expect.any(Function),
        }),
      );
    });
  });

  it('does not close the session when local question selection causes a rerender', async () => {
    useTodayDailyPracticeQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: buildDailyPracticeResponse(),
    });

    const rendered = renderHookWithParams('7');

    act(() => {
      rendered.getState().selectQuestion(1);
    });

    expect(closeSessionMutateMock).not.toHaveBeenCalled();
  });

  it('submits the active daily-practice question and applies a local optimistic progress update', async () => {
    useTodayDailyPracticeQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: buildDailyPracticeResponse(),
    });
    submitMutateAsyncMock.mockResolvedValue(buildSubmitResponse());

    const rendered = renderHookWithParams('7');

    act(() => {
      rendered.getState().selectOption(501, 0);
    });

    await act(async () => {
      await rendered.getState().submitActiveQuestionAttempt();
    });

    expect(submitMutateAsyncMock).toHaveBeenCalledWith({
      setId: '11111111-1111-4111-8111-111111111201',
      moduleUnitId: 11,
      questionUnitId: 101,
      questionContentId: 501,
      sessionId: '11111111-1111-4111-8111-111111111202',
      timeTakenMs: expect.any(Number),
      hintUnlocked: false,
      studentAnswer: { selectedOptionIndex: 0 },
    });
    expect(rendered.getState().progress).toEqual({
      totalQuestions: 2,
      answeredQuestions: 1,
      completedAt: null,
    });
    expect(rendered.getState().activeQuestionItem?.hasCorrectAttempt).toBe(true);
    expect(syncAttemptSuccessEffectsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hasCorrectAttempt: true,
      }),
    );
  });

  it('logs query errors when the logging policy allows it', () => {
    const queryError = new Error('load failed');
    useTodayDailyPracticeQueryMock.mockReturnValue({
      isPending: false,
      data: null,
      error: queryError,
    });

    renderHookWithParams('7');

    expect(logError).toHaveBeenCalledWith(queryError, {
      feature: 'daily-practice',
      action: 'load',
      moduleId: 7,
    });
  });
});
