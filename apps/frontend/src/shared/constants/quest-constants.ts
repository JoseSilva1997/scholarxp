// Maps quest domain types to badge assets and resolves the correct image for quest UI components.
import { QuestTypeValues } from '@scholarxp/api-contracts'
import type { QuestView } from '@scholarxp/api-contracts'
import completeDailyPracticeBadge from '@/assets/quest-badges/daily-practice-complete.png';
import incompleteDailyPracticeBadge from '@/assets/quest-badges/daily-practice-incomplete.png';
import completeNewUnitBadge from '@/assets/quest-badges/new-unit-complete.png';
import incompleteNewUnitBadge from '@/assets/quest-badges/new-unit-incomplete.png';
import completeDailyPracticeStreakBadge from '@/assets/quest-badges/daily-practice-streak-complete.png';
import incompleteDailyPracticeStreakBadge from '@/assets/quest-badges/daily-practice-streak-incomplete.png';
import completeModuleUnitRetryBadge from '@/assets/quest-badges/module-unit-retry-complete.png';
import incompleteModuleUnitRetryBadge from '@/assets/quest-badges/module-unit-retry-incomplete.png';

// Image paths for each quest type based on completion status.
export const QUEST_IMAGE = {
    [QuestTypeValues.completeDailyPractice] : {
        complete: completeDailyPracticeBadge,
        incomplete: incompleteDailyPracticeBadge,
    },
    [QuestTypeValues.completeNewUnit]: {
        complete: completeNewUnitBadge,
        incomplete: incompleteNewUnitBadge,
    },
    [QuestTypeValues.moduleUnitRetry]: {
        complete: completeModuleUnitRetryBadge,
        incomplete: incompleteModuleUnitRetryBadge,
    },
    [QuestTypeValues.dailyPracticeStreak]: {
        complete: completeDailyPracticeStreakBadge,
        incomplete: incompleteDailyPracticeStreakBadge,
    },
} as const;


// Chooses the badge asset that corresponds to the quest type and completion state.
export function getQuestBadge(quest: QuestView): string {
    if (quest.type === QuestTypeValues.completeDailyPractice) {
        return quest.isCompleted ? QUEST_IMAGE[QuestTypeValues.completeDailyPractice].complete : QUEST_IMAGE[QuestTypeValues.completeDailyPractice].incomplete;
    } else if (quest.type === QuestTypeValues.completeNewUnit) {
        return quest.isCompleted ? QUEST_IMAGE[QuestTypeValues.completeNewUnit].complete : QUEST_IMAGE[QuestTypeValues.completeNewUnit].incomplete;
    } else if (quest.type === QuestTypeValues.moduleUnitRetry) {
        return quest.isCompleted ? QUEST_IMAGE[QuestTypeValues.moduleUnitRetry].complete : QUEST_IMAGE[QuestTypeValues.moduleUnitRetry].incomplete;
    } else if (quest.type === QuestTypeValues.dailyPracticeStreak) {
        return quest.isCompleted ? QUEST_IMAGE[QuestTypeValues.dailyPracticeStreak].complete : QUEST_IMAGE[QuestTypeValues.dailyPracticeStreak].incomplete;
    }
    // Default badge if quest type is unrecognized (should not happen if types are enforced correctly)
    return '';
}
