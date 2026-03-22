// Verifies the deferred completion flow so practice-room rewards are flushed
// only after the lesson-complete modal is dismissed.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SubmitAttemptResponse } from '@scholarxp/api-contracts';
import { usePracticeRoomCompletionFlow } from './usePracticeRoomCompletionFlow';

function buildSubmitResponse(): SubmitAttemptResponse {
  return {
    awards: {
      baseQuestionExp: 10,
      firstAttemptBonus: 5,
      streakBonus: 0,
        masteryExp: 0,
      accountExp: 25,
    },
    hasCorrectAttempt: true,
  };
}

describe('usePracticeRoomCompletionFlow', () => {
  it('flushes deferred rewards after dismissal', () => {
    const applyExpAward = vi.fn();
    const syncAttemptSuccessEffects = vi.fn().mockResolvedValue(undefined);
    const moduleDetail = { userModuleLevel: 2, currentExp: 40, expMax: 100 };
    const submitResponse = buildSubmitResponse();
    const moduleExpBreakdown = {
      base: 10,
      firstAttemptBonus: 5,
      streakBonus: 0,
      total: 15,
    };

    const { result } = renderHook(() =>
      usePracticeRoomCompletionFlow({
        applyExpAward,
        moduleDetail,
        syncAttemptSuccessEffects,
      }),
    );

    act(() => {
      result.current.deferLessonCompleteRewards({
        moduleExpBreakdown,
        submitResponse,
      });
    });

    expect(result.current.isLessonCompleteModalOpen).toBe(true);

    act(() => {
      result.current.dismissLessonCompleteModal();
    });

    expect(result.current.isLessonCompleteModalOpen).toBe(false);
    expect(applyExpAward).toHaveBeenCalledWith(moduleExpBreakdown, moduleDetail);
    expect(syncAttemptSuccessEffects).toHaveBeenCalledWith(submitResponse);
  });

  it('skips module-progress animation when no module xp was awarded', () => {
    const applyExpAward = vi.fn();
    const syncAttemptSuccessEffects = vi.fn().mockResolvedValue(undefined);
    const submitResponse = buildSubmitResponse();

    const { result } = renderHook(() =>
      usePracticeRoomCompletionFlow({
        applyExpAward,
        moduleDetail: null,
        syncAttemptSuccessEffects,
      }),
    );

    act(() => {
      result.current.deferLessonCompleteRewards({
        moduleExpBreakdown: {
          base: 0,
          firstAttemptBonus: 0,
          streakBonus: 0,
          total: 0,
        },
        submitResponse,
      });
    });

    act(() => {
      result.current.dismissLessonCompleteModal();
    });

    expect(applyExpAward).not.toHaveBeenCalled();
    expect(syncAttemptSuccessEffects).toHaveBeenCalledWith(submitResponse);
  });
});
