import { QuestTypeValues } from '@scholarxp/api-contracts'
import type { QuestView } from '@scholarxp/api-contracts'
import completeDailyPracticeBadge from '../assets/quest-badges/daily-practice-complete.png';
import incompleteDailyPracticeBadge from '../assets/quest-badges/daily-practice-incomplete.png';
import completeNewUnitBadge from '../assets/quest-badges/new-unit-complete.png';
import incompleteNewUnitBadge from '../assets/quest-badges/new-unit-incomplete.png';

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
} as const;


export function getQuestBadge(quest: QuestView): string {
    if (quest.type === QuestTypeValues.completeDailyPractice) {
        return quest.isCompleted ? QUEST_IMAGE[QuestTypeValues.completeDailyPractice].complete : QUEST_IMAGE[QuestTypeValues.completeDailyPractice].incomplete;
    } else if (quest.type === QuestTypeValues.completeNewUnit) {
        return quest.isCompleted ? QUEST_IMAGE[QuestTypeValues.completeNewUnit].complete : QUEST_IMAGE[QuestTypeValues.completeNewUnit].incomplete;
    }
    // Default badge if quest type is unrecognized (should not happen if types are enforced correctly)
    return '';
}
