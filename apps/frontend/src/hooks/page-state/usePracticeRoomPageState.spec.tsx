import React from 'react';
import { render, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { logError } from '../../utils/logger';
// Mocks for query hooks and utilities used by the hook under test.
vi.mock('../queries/usePracticeRoomQueries', () => ({
  usePracticeRoomQuery: vi.fn(),
  useSubmitPracticeRoomAttemptMutation: vi.fn(),
}));
vi.mock('../queries/useModulesQueries', () => ({
  useModuleDetailQuery: vi.fn(),
}));
vi.mock('../../api/get-display-error', () => ({
  getDisplayErrorMessage: (err: unknown) => `display:${String(err)}`,
  shouldLogApiError: (_: unknown) => true,
}));
vi.mock('../../utils/logger', () => ({ logError: vi.fn() }));

import { usePracticeRoomPageState } from './usePracticeRoomPageState';
import {
  usePracticeRoomQuery,
  useSubmitPracticeRoomAttemptMutation,
} from '../queries/usePracticeRoomQueries';
import { useModuleDetailQuery } from '../queries/useModulesQueries';

// Helper to render a tiny wrapper component that exposes the hook's return value
function renderHookWithParams(moduleIdParam?: string, unitIdParam?: string) {
  let latest: any = null;

  function TestWrapper({ m = moduleIdParam, u = unitIdParam }: any) {
    const state = usePracticeRoomPageState({ moduleIdParam: m, unitIdParam: u });
    React.useEffect(() => {
      latest = state;
    });
    return <div data-testid="ready">ok</div>;
  }

  const utils = render(<TestWrapper />);
  return {
    ...utils,
    getState: () => latest,
  };
}

describe('usePracticeRoomPageState', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useSubmitPracticeRoomAttemptMutation as any).mockReturnValue({
      isPending: false,
      error: null,
      mutateAsync: vi.fn().mockResolvedValue({
        moduleExpAwarded: 0,
        studentExpAwarded: 0,
        hasCorrectAttempt: false,
      }),
    });
  });

  it('parses numeric module/unit ids and exposes parsed values', () => {
    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: null, error: null });
    (useSubmitPracticeRoomAttemptMutation as any).mockReturnValue({
      isPending: false,
      error: null,
      mutateAsync: vi.fn().mockResolvedValue({
        moduleExpAwarded: 0,
        studentExpAwarded: 0,
        hasCorrectAttempt: false,
      }),
    });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: null });

    const r = renderHookWithParams('5', '2');
    const state = r.getState();

    expect(state.parsedModuleId).toBe(5);
    expect(state.parsedUnitId).toBe(2);
  });

  it('returns page error when ids are missing', () => {
    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: null, error: null });
    (useSubmitPracticeRoomAttemptMutation as any).mockReturnValue({
      isPending: false,
      error: null,
      mutateAsync: vi.fn().mockResolvedValue({
        moduleExpAwarded: 0,
        studentExpAwarded: 0,
        hasCorrectAttempt: false,
      }),
    });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: null });

    const r = renderHookWithParams(undefined, undefined);
    const state = r.getState();
    expect(state.pageError).toMatch(/Practice room not found/);
  });

  it('computes moduleProgress and expPercent with provided expMax', () => {
    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: null, error: null });
    (useModuleDetailQuery as any).mockReturnValue({
      isPending: false,
      data: { userModuleLevel: 3, expMax: 50, currentExp: 25 },
      error: null,
    });

    const r = renderHookWithParams('1', '1');
    const state = r.getState();
    expect(state.moduleProgress).toEqual({ level: 3, currentExp: 25, expPercent: 50 });
  });

  it('handles unlocked variants, navigation and option selection', () => {
    // Build a practice room with a single question unit and two variants.
    const room = {
      practiceRoom: {
        questions: [
          {
            questionUnitId: 10,
            coreQuestion: {
              questionContent: { id: 100, questionData: { options: [{ optionText: 'A' }, { optionText: 'B' }] } },
              lastAttempt: { isCorrect: false, studentAnswer: { selectedOptionIndex: 1 } },
            },
            variants: [
              {
                questionContent: { id: 101, questionData: { options: [{ optionText: 'V1' }] } },
                lastAttempt: { isCorrect: false, studentAnswer: { selectedOptionIndex: 0 } },
              },
              {
                questionContent: { id: 102, questionData: { options: [{ optionText: 'V2' }] } },
                lastAttempt: undefined,
              },
            ],
          },
        ],
      },
    };

    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: room, error: null });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: null });

    const r = renderHookWithParams('1', '1');
    let state = r.getState();

    // initial active question should be core
    expect(state.activeQuestion.kind).toBe('core');
    // core had lastAttempt selectedOptionIndex 1 so seeded selection should reflect that
    expect(state.selectedOptionIndex).toBe(1);

    // Navigate to first variant via public API
    act(() => {
      state.goToNextQuestionVersion();
    });
    state = r.getState();
    expect(state.activeQuestion.kind).toBe('variant');
    expect(state.activeQuestion.index).toBe(0);

    // go to next variant (should move to index 1)
    act(() => {
      state.goToNextQuestionVersion();
    });
    state = r.getState();
    expect(state.activeQuestion.kind).toBe('variant');
    expect(state.activeQuestion.index).toBe(1);

    // select option on active question
    act(() => {
      state.selectOption(102, 0);
    });
    state = r.getState();
    expect(state.selectedOptionIndex).toBe(0);
  });

  it('reads true/false question options when provided', () => {
    const room = {
      practiceRoom: {
        questions: [
          {
            questionUnitId: 20,
            coreQuestion: {
              questionContent: { id: 200, questionData: { trueOption: {}, falseOption: {} } },
              lastAttempt: { isCorrect: true },
            },
            variants: [],
          },
        ],
      },
    };

    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: room, error: null });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: null });

    const r = renderHookWithParams('1', '1');
    const state = r.getState();
    expect(state.activeQuestionOptions.map((o: any) => o.optionText)).toEqual(['True', 'False']);
  });

  it('logs and shows pageError when practiceRoomQuery errors', () => {
    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: null, error: 'pErr' });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: null });

    const r = renderHookWithParams('1', '1');
    const state = r.getState();
    expect(state.pageError).toBe('display:pErr');
    expect(logError).toHaveBeenCalled();
  });

  it('logs and shows pageError when moduleDetailQuery errors', () => {
    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: null, error: null });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: 'mErr' });

    const r = renderHookWithParams('1', '1');
    const state = r.getState();
    expect(state.pageError).toBe('display:mErr');
    expect(logError).toHaveBeenCalled();
  });

  it('navigates question units and clamps selection', () => {
    const room = {
      practiceRoom: {
        questions: [
          { questionUnitId: 1, coreQuestion: { questionContent: { id: 1, questionData: {} }, lastAttempt: {} }, variants: [] },
          { questionUnitId: 2, coreQuestion: { questionContent: { id: 2, questionData: {} }, lastAttempt: {} }, variants: [] },
          { questionUnitId: 3, coreQuestion: { questionContent: { id: 3, questionData: {} }, lastAttempt: {} }, variants: [] },
        ],
      },
    };

    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: room, error: null });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: null });

    const r = renderHookWithParams('1', '1');
    let state = r.getState();
    expect(state.selectedQuestionUnitIndex).toBe(0);

    act(() => state.goToNextQuestionUnit());
    state = r.getState();
    expect(state.selectedQuestionUnitIndex).toBe(1);

    act(() => state.goToNextQuestionUnit());
    state = r.getState();
    expect(state.selectedQuestionUnitIndex).toBe(2);

    // clamped to last
    act(() => state.goToNextQuestionUnit());
    state = r.getState();
    expect(state.selectedQuestionUnitIndex).toBe(2);

    act(() => state.goToPreviousQuestionUnit());
    state = r.getState();
    expect(state.selectedQuestionUnitIndex).toBe(1);

    act(() => state.selectQuestionUnit(-5));
    state = r.getState();
    expect(state.selectedQuestionUnitIndex).toBe(0);

    act(() => state.selectQuestionUnit(999));
    state = r.getState();
    expect(state.selectedQuestionUnitIndex).toBe(2);
  });

  it('does not advance to next question version when no unlocked variants', () => {
    const room = {
      practiceRoom: {
        questions: [
          {
            questionUnitId: 5,
            coreQuestion: { questionContent: { id: 50, questionData: {} }, lastAttempt: { isCorrect: true } },
            variants: [
              { questionContent: { id: 51, questionData: {} }, lastAttempt: undefined },
            ],
          },
        ],
      },
    };

    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: room, error: null });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: null });

    const r = renderHookWithParams('1', '1');
    const state = r.getState();
    expect(state.activeQuestion.kind).toBe('core');
    act(() => state.goToNextQuestionVersion());
    const after = r.getState();
    expect(after.activeQuestion.kind).toBe('core');
  });

  it('ignores invalid seeded studentAnswer and filters invalid options', () => {
    const room = {
      practiceRoom: {
        questions: [
          {
            questionUnitId: 8,
            coreQuestion: {
              questionContent: { id: 80, questionData: { options: [null, { optionText: 'ok' }, { optionText: 123 }] } },
              lastAttempt: { isCorrect: false, studentAnswer: 'not-an-object' },
            },
            variants: [],
          },
        ],
      },
    };

    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: room, error: null });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: null });

    const r = renderHookWithParams('1', '1');
    const state = r.getState();
    expect(state.selectedOptionIndex).toBe(null);
    expect(state.activeQuestionOptions.map((o: any) => o.optionText)).toEqual(['ok']);
  });

  it('unlockHintForContent marks hint unlocked for active question', () => {
    const room = {
      practiceRoom: {
        questions: [
          {
            questionUnitId: 30,
            coreQuestion: { questionContent: { id: 300, questionData: {} }, lastAttempt: {} },
            variants: [],
          },
        ],
      },
    };

    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: room, error: null });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: null });

    const r = renderHookWithParams('1', '1');
    let state = r.getState();
    expect(state.isActiveHintUnlocked).toBe(false);
    act(() => state.unlockHintForContent(300));
    state = r.getState();
    expect(state.isActiveHintUnlocked).toBe(true);
  });

  it('goToPreviousQuestionVersion moves from variant index 0 back to core', () => {
    const room = {
      practiceRoom: {
        questions: [
          {
            questionUnitId: 40,
            coreQuestion: {
              questionContent: { id: 400, questionData: {} },
              lastAttempt: { isCorrect: false },
            },
            variants: [
              { questionContent: { id: 401, questionData: {} }, lastAttempt: undefined },
            ],
          },
        ],
      },
    };

    (usePracticeRoomQuery as any).mockReturnValue({ isPending: false, data: room, error: null });
    (useModuleDetailQuery as any).mockReturnValue({ isPending: false, data: null, error: null });

    const r = renderHookWithParams('1', '1');
    let state = r.getState();
    // go to first variant
    act(() => state.goToNextQuestionVersion());
    state = r.getState();
    expect(state.activeQuestion.kind).toBe('variant');

    // previous should go back to core
    act(() => state.goToPreviousQuestionVersion());
    state = r.getState();
    expect(state.activeQuestion.kind).toBe('core');
  });
});
