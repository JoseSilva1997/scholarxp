// Verifies the submit-attempt lifecycle: payload shape, guard conditions, optimistic
// state updates, XP callbacks, error handling, and try-again resets. Mutation and
// side-effect helpers are mocked so tests focus on hook logic only.
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  PracticeQuestion,
  PracticeQuestionUnit,
  SubmitAttemptPayload,
  SubmitAttemptResponse,
} from '@scholarxp/api-contracts';
import { useSubmitAttempt } from './useSubmitAttempt';

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getDisplayErrorMessage: vi.fn(),
  shouldLogApiError: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../../../api/get-display-error', () => ({
  getDisplayErrorMessage: mocks.getDisplayErrorMessage,
  shouldLogApiError: mocks.shouldLogApiError,
}));

vi.mock('../../../utils/logger', () => ({
  logError: mocks.logError,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const QUESTION_ID = 42;
const SESSION_ID = 'session-abc';
const MODULE_UNIT_ID = 5;
const QUESTION_UNIT_ID = 7;

function buildMockQuestion(): PracticeQuestion {
  return {
    id: QUESTION_ID,
    type: 'mcq',
    questionStem: 'What is 2 + 2?',
    questionData: { options: [{ optionText: 'A' }, { optionText: 'B' }] } as unknown as PracticeQuestion['questionData'],
    hint: null,
    difficultyScore: 1,
  };
}

function buildMockQuestionUnit(): PracticeQuestionUnit {
  return {
    questionUnitId: QUESTION_UNIT_ID,
    position: 1,
    hasCorrectAttempt: null,
    coreQuestion: {
      questionId: QUESTION_UNIT_ID,
      questionContent: buildMockQuestion(),
      lastAttempt: null,
    },
  };
}

// Helper to build a mutable ref object matching React.RefObject<T>.
function buildRef<T>(value: T): React.RefObject<T> {
  return { current: value };
}

type BaseParams = Parameters<typeof useSubmitAttempt>[0];

function buildParams(overrides: Partial<BaseParams> = {}): BaseParams {
  return {
    room: { sessionId: SESSION_ID, moduleUnitId: MODULE_UNIT_ID },
    activeQuestionUnit: buildMockQuestionUnit(),
    activeQuestion: { question: buildMockQuestion() },
    isRoomReadOnly: false,
    selectedOptionIndex: 0,
    hasSubmittedActiveQuestion: false,
    isActiveHintUnlocked: false,
    activeContentIdRef: buildRef(QUESTION_ID),
    activeContentViewStartMsRef: buildRef(null),
    mutateAsync: vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: true,
    } satisfies SubmitAttemptResponse),
    isPending: false,
    applyExpAward: vi.fn(),
    moduleDetail: null,
    setSubmittedAttemptByContentId: vi.fn(),
    setSubmittedByContentIdBySessionId: vi.fn(),
    parsedModuleId: 1,
    parsedUnitId: 2,
    ...overrides,
  };
}

// ─── canSubmitAttempt ─────────────────────────────────────────────────────────

describe('useSubmitAttempt — canSubmitAttempt', () => {
  it('is true when all required fields are present and valid', () => {
    const { result } = renderHook(() => useSubmitAttempt(buildParams()));
    expect(result.current.canSubmitAttempt).toBe(true);
  });

  it('is false when room is null', () => {
    const { result } = renderHook(() => useSubmitAttempt(buildParams({ room: null })));
    expect(result.current.canSubmitAttempt).toBe(false);
  });

  it('is false when activeQuestionUnit is null', () => {
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ activeQuestionUnit: null })),
    );
    expect(result.current.canSubmitAttempt).toBe(false);
  });

  it('is false when activeQuestion is null', () => {
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ activeQuestion: null })),
    );
    expect(result.current.canSubmitAttempt).toBe(false);
  });

  it('is false when isRoomReadOnly is true', () => {
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ isRoomReadOnly: true })),
    );
    expect(result.current.canSubmitAttempt).toBe(false);
  });

  it('is false when selectedOptionIndex is null', () => {
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ selectedOptionIndex: null })),
    );
    expect(result.current.canSubmitAttempt).toBe(false);
  });

  it('is false when the active question has already been submitted', () => {
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ hasSubmittedActiveQuestion: true })),
    );
    expect(result.current.canSubmitAttempt).toBe(false);
  });

  it('is false when the mutation is pending', () => {
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ isPending: true })),
    );
    expect(result.current.canSubmitAttempt).toBe(false);
  });
});

// ─── submitActiveQuestionAttempt — payload ────────────────────────────────────

describe('useSubmitAttempt — submitActiveQuestionAttempt — payload', () => {
  it('does not call mutateAsync when room is null', async () => {
    const mutateAsync = vi.fn();
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ room: null, mutateAsync })),
    );
    await act(() => result.current.submitActiveQuestionAttempt());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('does not call mutateAsync when selectedOptionIndex is null', async () => {
    const mutateAsync = vi.fn();
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ selectedOptionIndex: null, mutateAsync })),
    );
    await act(() => result.current.submitActiveQuestionAttempt());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('builds the correct payload with required fields', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: false,
    } satisfies SubmitAttemptResponse);
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ mutateAsync })),
    );
    await act(() => result.current.submitActiveQuestionAttempt());

    const payload = mutateAsync.mock.calls[0][0] as SubmitAttemptPayload;
    expect(payload.moduleUnitId).toBe(MODULE_UNIT_ID);
    expect(payload.questionUnitId).toBe(QUESTION_UNIT_ID);
    expect(payload.questionContentId).toBe(QUESTION_ID);
    expect(payload.sessionId).toBe(SESSION_ID);
    expect(payload.hintUnlocked).toBe(false);
    expect(payload.studentAnswer).toEqual({ selectedOptionIndex: 0 });
  });

  it('uses view-start ref for timeTakenMs when the ref tracks the active question', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: false,
    } satisfies SubmitAttemptResponse);
    const viewStartMs = Date.now() - 3000;
    const { result } = renderHook(() =>
      useSubmitAttempt(
        buildParams({
          mutateAsync,
          activeContentIdRef: buildRef(QUESTION_ID),
          activeContentViewStartMsRef: buildRef(viewStartMs),
        }),
      ),
    );
    await act(() => result.current.submitActiveQuestionAttempt());

    const payload = mutateAsync.mock.calls[0][0] as SubmitAttemptPayload;
    // timeTakenMs should be around 3000 ms; use a loose bound to avoid flakiness.
    expect(payload.timeTakenMs).toBeGreaterThanOrEqual(2900);
    expect(payload.timeTakenMs).toBeLessThanOrEqual(3500);
  });

  it('falls back to timeTakenMs of 0 when the view-start ref does not match the active question', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: false,
    } satisfies SubmitAttemptResponse);
    const { result } = renderHook(() =>
      useSubmitAttempt(
        buildParams({
          mutateAsync,
          // Ref is tracking a different content id; timing falls back to 0.
          activeContentIdRef: buildRef(999),
          activeContentViewStartMsRef: buildRef(Date.now() - 5000),
        }),
      ),
    );
    await act(() => result.current.submitActiveQuestionAttempt());

    const payload = mutateAsync.mock.calls[0][0] as SubmitAttemptPayload;
    expect(payload.timeTakenMs).toBe(0);
  });

  it('includes hintUnlocked: true when the hint was unlocked before submitting', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: true,
    } satisfies SubmitAttemptResponse);
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ mutateAsync, isActiveHintUnlocked: true })),
    );
    await act(() => result.current.submitActiveQuestionAttempt());
    expect((mutateAsync.mock.calls[0][0] as SubmitAttemptPayload).hintUnlocked).toBe(true);
  });
});

// ─── submitActiveQuestionAttempt — success callbacks ─────────────────────────

describe('useSubmitAttempt — submitActiveQuestionAttempt — success', () => {
  it('calls applyExpAward when awarded module XP is greater than 0', async () => {
    const applyExpAward = vi.fn();
    const moduleDetail = { userModuleLevel: 1, currentExp: 50, expMax: 100 };
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 10, firstAttemptBonus: 15, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: true,
    } satisfies SubmitAttemptResponse);
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ mutateAsync, applyExpAward, moduleDetail })),
    );
    await act(() => result.current.submitActiveQuestionAttempt());
    expect(applyExpAward).toHaveBeenCalledWith(
      { base: 10, firstAttemptBonus: 15, streakBonus: 0, total: 25 },
      moduleDetail,
    );
  });

  it('does not call applyExpAward when awarded module XP is 0', async () => {
    const applyExpAward = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: true,
    } satisfies SubmitAttemptResponse);
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ mutateAsync, applyExpAward })),
    );
    await act(() => result.current.submitActiveQuestionAttempt());
    expect(applyExpAward).not.toHaveBeenCalled();
  });

  it('stores latest-attempt correctness from awardReasons in submittedAttemptByContentId', async () => {
    const setSubmittedAttemptByContentId = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      // `hasCorrectAttempt` stays true once a question has ever been solved;
      // awardReasons carries this specific submission outcome.
      hasCorrectAttempt: true,
      awardReasons: {
        baseQuestionExp: 'incorrect',
        firstAttemptBonus: 'incorrect',
      },
    } satisfies SubmitAttemptResponse);
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ mutateAsync, setSubmittedAttemptByContentId })),
    );
    await act(() => result.current.submitActiveQuestionAttempt());

    // The setter receives an updater function; invoke it to inspect the result.
    const updater = setSubmittedAttemptByContentId.mock.calls[0][0] as (
      prev: Record<number, unknown>,
    ) => Record<number, unknown>;
    const next = updater({});
    expect(next[QUESTION_ID]).toEqual({
      studentAnswer: { selectedOptionIndex: 0 },
      isCorrect: false,
    });
  });

  it('falls back to hasCorrectAttempt when awardReasons is missing', async () => {
    const setSubmittedAttemptByContentId = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: true,
    } satisfies SubmitAttemptResponse);
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ mutateAsync, setSubmittedAttemptByContentId })),
    );
    await act(() => result.current.submitActiveQuestionAttempt());

    const updater = setSubmittedAttemptByContentId.mock.calls[0][0] as (
      prev: Record<number, unknown>,
    ) => Record<number, unknown>;
    const next = updater({});
    expect(next[QUESTION_ID]).toEqual({
      studentAnswer: { selectedOptionIndex: 0 },
      isCorrect: true,
    });
  });

  it('marks the active question as submitted in setSubmittedByContentIdBySessionId', async () => {
    const setSubmittedByContentIdBySessionId = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({
      awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
      hasCorrectAttempt: true,
    } satisfies SubmitAttemptResponse);
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ mutateAsync, setSubmittedByContentIdBySessionId })),
    );
    await act(() => result.current.submitActiveQuestionAttempt());

    const updater = setSubmittedByContentIdBySessionId.mock.calls[0][0] as (
      prev: Record<string, Record<number, boolean>>,
    ) => Record<string, Record<number, boolean>>;
    const next = updater({});
    expect(next[SESSION_ID][QUESTION_ID]).toBe(true);
  });
});

// ─── submitActiveQuestionAttempt — error handling ────────────────────────────

describe('useSubmitAttempt — submitActiveQuestionAttempt — error', () => {
  it('sets submitErrorMessage from getDisplayErrorMessage on failure', async () => {
    mocks.getDisplayErrorMessage.mockReturnValue('Something went wrong, try again.');
    const error = new Error('Network failure');
    const mutateAsync = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useSubmitAttempt(buildParams({ mutateAsync })));

    await act(() => result.current.submitActiveQuestionAttempt());
    expect(result.current.submitErrorMessage).toBe('Something went wrong, try again.');
  });

  it('calls logError when shouldLogApiError returns true', async () => {
    mocks.getDisplayErrorMessage.mockReturnValue('Error');
    mocks.shouldLogApiError.mockReturnValue(true);
    const error = new Error('Network failure');
    const mutateAsync = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ mutateAsync, parsedModuleId: 1, parsedUnitId: 2 })),
    );

    await act(() => result.current.submitActiveQuestionAttempt());
    expect(mocks.logError).toHaveBeenCalledWith(error, {
      feature: 'practice-room',
      action: 'submit-attempt',
      moduleId: 1,
      unitId: 2,
    });
  });

  it('does not call logError when shouldLogApiError returns false', async () => {
    mocks.getDisplayErrorMessage.mockReturnValue('Error');
    mocks.shouldLogApiError.mockReturnValue(false);
    const mutateAsync = vi.fn().mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useSubmitAttempt(buildParams({ mutateAsync })));

    await act(() => result.current.submitActiveQuestionAttempt());
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it('clears submitErrorMessage at the start of a new submission attempt', async () => {
    mocks.getDisplayErrorMessage.mockReturnValue('First error');
    const mutateAsync = vi.fn()
      .mockRejectedValueOnce(new Error('First'))
      .mockResolvedValueOnce({
        awards: { baseQuestionExp: 0, firstAttemptBonus: 0, streakBonus: 0, accountExp: 0 },
        hasCorrectAttempt: true,
      } satisfies SubmitAttemptResponse);
    const { result } = renderHook(() =>
      // Allow two attempts by toggling hasSubmittedActiveQuestion between calls.
      useSubmitAttempt(buildParams({ mutateAsync })),
    );

    // First call — sets the error.
    await act(() => result.current.submitActiveQuestionAttempt());
    expect(result.current.submitErrorMessage).toBe('First error');

    // Second call — error should be cleared immediately (before await).
    // We verify by confirming submitErrorMessage is null after a successful second call.
    await act(() => result.current.submitActiveQuestionAttempt());
    expect(result.current.submitErrorMessage).toBeNull();
  });
});

// ─── tryAgainActiveQuestion ───────────────────────────────────────────────────

describe('useSubmitAttempt — tryAgainActiveQuestion', () => {
  it('does nothing when activeQuestion is null', () => {
    const setSubmittedByContentIdBySessionId = vi.fn();
    const { result } = renderHook(() =>
      useSubmitAttempt(
        buildParams({ activeQuestion: null, setSubmittedByContentIdBySessionId }),
      ),
    );
    act(() => result.current.tryAgainActiveQuestion());
    expect(setSubmittedByContentIdBySessionId).not.toHaveBeenCalled();
  });

  it('removes the active question from submittedByContentIdBySessionId', () => {
    const setSubmittedByContentIdBySessionId = vi.fn();
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ setSubmittedByContentIdBySessionId })),
    );
    act(() => result.current.tryAgainActiveQuestion());

    const updater = setSubmittedByContentIdBySessionId.mock.calls[0][0] as (
      prev: Record<string, Record<number, boolean>>,
    ) => Record<string, Record<number, boolean>>;
    const prev = { [SESSION_ID]: { [QUESTION_ID]: true, 99: true } };
    const next = updater(prev);
    // Only the active question should be removed; unrelated questions stay.
    expect(next[SESSION_ID][QUESTION_ID]).toBeUndefined();
    expect(next[SESSION_ID][99]).toBe(true);
  });

  it('removes the active question from submittedAttemptByContentId', () => {
    const setSubmittedAttemptByContentId = vi.fn();
    const { result } = renderHook(() =>
      useSubmitAttempt(buildParams({ setSubmittedAttemptByContentId })),
    );
    act(() => result.current.tryAgainActiveQuestion());

    const updater = setSubmittedAttemptByContentId.mock.calls[0][0] as (
      prev: Record<number, unknown>,
    ) => Record<number, unknown>;
    const prev = { [QUESTION_ID]: { isCorrect: false }, 99: { isCorrect: true } };
    const next = updater(prev);
    expect(next[QUESTION_ID]).toBeUndefined();
    expect(next[99]).toEqual({ isCorrect: true });
  });

  it('clears submitErrorMessage', async () => {
    mocks.getDisplayErrorMessage.mockReturnValue('Oops');
    const mutateAsync = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useSubmitAttempt(buildParams({ mutateAsync })));

    // First produce an error.
    await act(() => result.current.submitActiveQuestionAttempt());
    expect(result.current.submitErrorMessage).toBe('Oops');

    // tryAgain should clear it.
    act(() => result.current.tryAgainActiveQuestion());
    expect(result.current.submitErrorMessage).toBeNull();
  });
});
