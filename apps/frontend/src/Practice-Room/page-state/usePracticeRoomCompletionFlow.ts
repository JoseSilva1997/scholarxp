// Coordinates the lesson-complete modal so practice-room rewards can be revealed
// only after the learner dismisses the celebration, without changing backend timing.
import { useCallback, useState } from 'react';
import type { SubmitAttemptResponse } from '@scholarxp/api-contracts';
import type {
  ExpBreakdown,
  ProgressModuleDetail,
} from '@/Practice-Room/page-state/useModuleProgressAnimation';

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

// Defers completion rewards behind the lesson-complete modal while leaving the
// actual award calculation and cache synchronization owned by upstream hooks.
export function usePracticeRoomCompletionFlow({
  applyExpAward,
  moduleDetail,
  syncAttemptSuccessEffects,
}: UsePracticeRoomCompletionFlowParams): UsePracticeRoomCompletionFlowResult {
  const [pendingLessonCompleteReward, setPendingLessonCompleteReward] =
    useState<PendingLessonCompleteReward | null>(null);

  // Stores the reward payload until the learner dismisses the completion modal.
  const deferLessonCompleteRewards = useCallback(
    (reward: PendingLessonCompleteReward) => {
      setPendingLessonCompleteReward(reward);
    },
    [],
  );

  // Closes the modal and flushes the deferred reward and cache synchronization effects.
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
