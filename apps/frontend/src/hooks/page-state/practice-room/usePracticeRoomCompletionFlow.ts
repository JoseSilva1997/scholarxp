// Coordinates the lesson-complete modal so practice-room rewards can be revealed
// only after the learner dismisses the celebration, without changing backend timing.
import { useCallback, useState } from 'react';
import type { SubmitAttemptResponse } from '@scholarxp/api-contracts';
import type {
  ExpBreakdown,
  ProgressModuleDetail,
} from './useModuleProgressAnimation';

type PendingLessonCompleteReward = {
  moduleExpBreakdown: ExpBreakdown;
  submitResponse: SubmitAttemptResponse;
};

type UsePracticeRoomCompletionFlowParams = {
  applyExpAward: (
    breakdown: ExpBreakdown,
    currentModuleDetail: ProgressModuleDetail | null,
  ) => void;
  moduleDetail: ProgressModuleDetail | null;
  syncAttemptSuccessEffects: (response: SubmitAttemptResponse) => Promise<void>;
};

type UsePracticeRoomCompletionFlowResult = {
  isLessonCompleteModalOpen: boolean;
  deferLessonCompleteRewards: (reward: PendingLessonCompleteReward) => void;
  dismissLessonCompleteModal: () => void;
};

export function usePracticeRoomCompletionFlow({
  applyExpAward,
  moduleDetail,
  syncAttemptSuccessEffects,
}: UsePracticeRoomCompletionFlowParams): UsePracticeRoomCompletionFlowResult {
  const [pendingLessonCompleteReward, setPendingLessonCompleteReward] =
    useState<PendingLessonCompleteReward | null>(null);

  const deferLessonCompleteRewards = useCallback(
    (reward: PendingLessonCompleteReward) => {
      setPendingLessonCompleteReward(reward);
    },
    [],
  );

  const dismissLessonCompleteModal = useCallback(() => {
    if (!pendingLessonCompleteReward) {
      return;
    }

    const nextReward = pendingLessonCompleteReward;
    setPendingLessonCompleteReward(null);

    // Flush the deferred reward only after the celebration has visibly concluded.
    if (nextReward.moduleExpBreakdown.total > 0) {
      applyExpAward(nextReward.moduleExpBreakdown, moduleDetail);
    }

    void syncAttemptSuccessEffects(nextReward.submitResponse);
  }, [applyExpAward, moduleDetail, pendingLessonCompleteReward, syncAttemptSuccessEffects]);

  return {
    isLessonCompleteModalOpen: pendingLessonCompleteReward !== null,
    deferLessonCompleteRewards,
    dismissLessonCompleteModal,
  };
}
