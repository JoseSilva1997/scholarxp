/* =================================================================================================
    *  This file contains the type definitions for the quests module of the API.
================================================================================================= */

// Quest type enum. This defines the different types of quests that can be generated for students.
// - 'complete_daily_practice': A quest that requires the student to complete a daily practice session.
// - 'complete_new_unit': A quest that requires the student to complete a new unit in their course.
export type QuestType = 'complete_daily_practice' | 'complete_new_unit';

// A mapping of quest type values to their corresponding string representations. This is used for
// type safety and to ensure consistency across the application when referring to quest types.
export const QuestTypeValues = {
  completeDailyPractice: 'complete_daily_practice',
  completeNewUnit: 'complete_new_unit',
} as const;

// Labels for each quest type to be displayed on the frontend.
export const QUEST_TYPE_LABELS = {
  [QuestTypeValues.completeDailyPractice]: 'Complete daily practice',
  [QuestTypeValues.completeNewUnit]: 'Complete new unit',
} as const;

// Structure of a quest object as returned by the API.
// Quests are generated at UTC midnight each day for each student based on their current progress.
export interface Quest {
  id: number;
  moduleId: number;
  moduleTitle: string;
  type: QuestType;
  expGranted: number;
  isCompleted: boolean;
  // Canonical UTC day for "today" and history grouping.
  questDateUtc: string; // YYYY-MM-DD
  // Creation timestamp for auditing and troubleshooting generation runs.
  generatedAt: string; // ISO date-time string (UTC)
  // Nullable because incomplete quests do not have a completion timestamp.
  completedAt: string | null; // ISO date-time string (UTC)
}

// Query params for paged quest-history retrieval by UTC day windows.
export interface QuestHistoryQuery {
  dayLimit?: number;
  dayOffset?: number;
}

// Base response for quest collection reads.
export interface QuestResponse {
  quests: Quest[];
}

// Paged history response includes pagination metadata for "load more" workflows.
export interface QuestHistoryResponse extends QuestResponse {
  hasMore: boolean;
  nextDayOffset: number | null;
}

export {};
