// Verifies only the composition-level practice-room page-state behavior so
// detailed state logic can stay covered in the smaller dedicated hook specs.
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type {
  ModuleUnitPracticeRoomResponse,
  PracticeQuestionUnit,
  SubmitAttemptResponse,
} from '@scholarxp/api-contracts';
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

const DEFAULT_SESSION_ID = '11111111-1111-4111-8111-111111111007';

function buildQuestionUnit(input: {
  questionUnitId: number;
  contentId: number;
  stem?: string;
  correctOptionIndex?: number;
  hint?: string | null;
  hasCorrectAttempt?: boolean | null;
  lastAttempt?: PracticeQuestionUnit['coreQuestion']['lastAttempt'];
}): PracticeQuestionUnit {
  return {
    questionUnitId: input.questionUnitId,
    position: input.questionUnitId,
    hasCorrectAttempt: input.hasCorrectAttempt ?? null,
    coreQuestion: {
      questionId: input.questionUnitId,
      questionContent: {
        id: input.contentId,
        type: 'mcq',
        questionStem: input.stem ?? `Question ${input.contentId}`,
        questionData: {
          // Match the shared MCQ contract exactly so TypeScript validates these
          // fixtures the same way production payloads are validated.
          options: [
            { optionText: 'A', explanation: undefined },
            { optionText: 'B', explanation: undefined },
            { optionText: 'C', explanation: undefined },
            { optionText: 'D', explanation: undefined },
          ],
          correctOptionIndex: input.correctOptionIndex ?? 0,
        },
        hint: input.hint ?? null,
        difficultyScore: 1,
      },
      lastAttempt: input.lastAttempt ?? null,
    },
  };
}

function buildPracticeRoomResponse(input?: {
  sessionId?: string;
  questions?: PracticeQuestionUnit[];
  isReadOnly?: boolean;
  currentStreak?: number;
  highestStreak?: number;
}): ModuleUnitPracticeRoomResponse {
  return {
    practiceRoom: {
      sessionId: input?.sessionId ?? DEFAULT_SESSION_ID,
      moduleUnitId: 3,
      moduleUnitTitle: 'Unit',
      isReadOnly: input?.isReadOnly,
      questions:
        input?.questions ?? [buildQuestionUnit({ questionUnitId: 11, contentId: 100 })],
    },
    currentStreak: input?.currentStreak,
    highestStreak: input?.highestStreak,
  };
}

function buildSubmitResponse(
  overrides: Partial<SubmitAttemptResponse> = {},
): SubmitAttemptResponse {
  return {
    awards: {
      baseQuestionExp: 0,
      firstAttemptBonus: 0,
      streakBonus: 0,
      accountExp: 0,
    },
    hasCorrectAttempt: false,
    ...overrides,
  };
}

function renderHookWithParams(
  moduleIdParam?: string,
  unitIdParam?: string,
  initialEntry: string = '/main/modules/1/1/practice-room',
) {
  let latest: PracticeRoomPageState | null = null;
  let latestSearch = '';

  function TestWrapper() {
    const state = usePracticeRoomPageState({ moduleIdParam, unitIdParam });
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
    getState: () => latest as PracticeRoomPageState,
    getSearch: () => latestSearch,
  };
}

describe('usePracticeRoomPageState (composition)', () => {
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
      mutateAsync: vi.fn().mockResolvedValue(buildSubmitResponse()),
    });
    closeSessionMutateMock.mockReset();
    useCloseModuleUnitPracticeSessionMutationMock.mockReturnValue({
      mutate: closeSessionMutateMock,
    });
  });

  it('parses module and unit ids and exposes a not-found page error for invalid params', () => {
    const valid = renderHookWithParams('5', '2').getState();
    expect(valid.parsedModuleId).toBe(5);
    expect(valid.parsedUnitId).toBe(2);

    const invalid = renderHookWithParams(undefined, undefined).getState();
    expect(invalid.pageError).toContain('Practice room not found');
  });

  it('passes the sessionId query param into the practice-room query hook', () => {
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
      data: buildPracticeRoomResponse({
        sessionId: '11111111-1111-4111-8111-111111111077',
        questions: [],
      }),
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

  it('applies a question deep-link and consumes the questionId search param', async () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: buildPracticeRoomResponse({
        questions: [
          buildQuestionUnit({ questionUnitId: 11, contentId: 100 }),
          buildQuestionUnit({ questionUnitId: 12, contentId: 101 }),
        ],
      }),
    });

    const rendered = renderHookWithParams(
      '1',
      '1',
      '/main/modules/1/1/practice-room?questionId=12',
    );

    await waitFor(() => {
      expect(rendered.getState().selectedQuestionUnitIndex).toBe(1);
      expect(rendered.getState().activeQuestion?.question.id).toBe(101);
      expect(rendered.getSearch()).not.toContain('questionId=');
    });
  });

  it('restores persisted question position while clearing unsubmitted draft selections after reload', () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: buildPracticeRoomResponse({
        questions: [
          buildQuestionUnit({ questionUnitId: 11, contentId: 100 }),
          buildQuestionUnit({ questionUnitId: 12, contentId: 101 }),
        ],
      }),
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

  it('locks interaction when the backend marks the room as read-only', () => {
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: buildPracticeRoomResponse({
        isReadOnly: true,
        questions: [
          buildQuestionUnit({
            questionUnitId: 22,
            contentId: 200,
            correctOptionIndex: 1,
            hint: 'Read-only hint',
          }),
        ],
      }),
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

  it('submits the active question successfully through the composed page-state API', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(
      buildSubmitResponse({ hasCorrectAttempt: true }),
    );
    useSubmitModuleUnitPracticeAttemptMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync,
    });
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: buildPracticeRoomResponse({
        questions: [buildQuestionUnit({ questionUnitId: 22, contentId: 200 })],
      }),
    });

    const rendered = renderHookWithParams('1', '1');
    act(() => {
      rendered.getState().selectOption(200, 0);
    });

    await act(async () => {
      await rendered.getState().submitActiveQuestionAttempt();
    });

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        questionUnitId: 22,
        questionContentId: 200,
      }),
    );
    expect(rendered.getState().hasSubmittedActiveQuestion).toBe(true);
  });

  it('surfaces submit errors through page state and logs them', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('submit-fail'));
    useSubmitModuleUnitPracticeAttemptMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync,
    });
    useModuleUnitPracticeRoomQueryMock.mockReturnValue({
      isPending: false,
      error: null,
      data: buildPracticeRoomResponse({
        questions: [buildQuestionUnit({ questionUnitId: 22, contentId: 200 })],
      }),
    });

    const rendered = renderHookWithParams('1', '1');
    act(() => {
      rendered.getState().selectOption(200, 0);
    });

    await act(async () => {
      await rendered.getState().submitActiveQuestionAttempt();
    });

    expect(rendered.getState().submitErrorMessage).toBe('display:Error: submit-fail');
    expect(logError).toHaveBeenCalled();
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

    const mutateAsync = vi.fn().mockResolvedValue(
      buildSubmitResponse({
        awards: {
          baseQuestionExp: 50,
          firstAttemptBonus: 0,
          streakBonus: 0,
          accountExp: 0,
        },
        hasCorrectAttempt: true,
      }),
    );
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
      data: buildPracticeRoomResponse({
        sessionId: '11111111-1111-4111-8111-111111111010',
        questions: [buildQuestionUnit({ questionUnitId: 22, contentId: 200 })],
      }),
    });

    const rendered = renderHookWithParams('1', '1');
    expect(rendered.getState().moduleProgress).toEqual({
      level: 1,
      currentExp: 980,
      expPercent: 98,
    });

    act(() => {
      rendered.getState().selectOption(200, 1);
    });
    await act(async () => {
      await rendered.getState().submitActiveQuestionAttempt();
    });

    expect(rendered.getState().moduleProgress).toEqual({
      level: 2,
      currentExp: 30,
      expPercent: 3,
    });

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });
});
