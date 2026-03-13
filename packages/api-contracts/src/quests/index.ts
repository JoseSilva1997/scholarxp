/* =================================================================================================
    *  This file contains the type definitions for the quests module of the API.
================================================================================================= */

import {
  MASTER_QUEST_COMPLETION_REWARD,
  QUEST_COMPLETION_REWARD,
} from '@scholarxp/constants';

// Quest type enum. This defines the different types of quests that can be generated for students.
// - 'complete_daily_practice': A quest that requires the student to complete a daily practice session.
// - 'complete_new_unit': A quest that requires the student to complete a new unit in their course.
// - 'module_unit_retry': A quest that requires the student to re-complete an already mastered lesson.
// - 'daily_practice_streak': A quest that requires the student to hit a target streak during daily practice.
// - 'master_daily_quests': A meta quest that completes when all daily quests for the day are completed.
export type QuestType =
  | 'complete_daily_practice'
  | 'complete_new_unit'
  | 'module_unit_retry'
  | 'daily_practice_streak'
  | 'master_daily_quests';

// Quest tier keeps daily quest rendering and master quest rendering explicit across backend and frontend.
export type QuestTier = 'daily' | 'master';

export type QuestDefinition = {
  tier: QuestTier;
  expReward: number;
  requiresModuleTarget: boolean;
  requiresModuleUnitTarget: boolean;
  // Progress target stays shared so the backend can expose generic progress fields
  // and the frontend can render all quests, including master quests, without type branching.
  defaultProgressTarget: number;
};

// A mapping of quest type values to their corresponding string representations. This is used for
// type safety and to ensure consistency across the application when referring to quest types.
export const QuestTypeValues = {
  completeDailyPractice: 'complete_daily_practice',
  completeNewUnit: 'complete_new_unit',
  moduleUnitRetry: 'module_unit_retry',
  dailyPracticeStreak: 'daily_practice_streak',
  masterDailyQuests: 'master_daily_quests',
} as const;

// Central quest metadata keeps reward, targeting, and rendering rules consistent between layers.
export const QUEST_DEFINITIONS = {
  [QuestTypeValues.completeDailyPractice]: {
    tier: 'daily',
    expReward: QUEST_COMPLETION_REWARD,
    requiresModuleTarget: true,
    requiresModuleUnitTarget: false,
    defaultProgressTarget: 1,
  },
  [QuestTypeValues.completeNewUnit]: {
    tier: 'daily',
    expReward: QUEST_COMPLETION_REWARD,
    requiresModuleTarget: true,
    requiresModuleUnitTarget: false,
    defaultProgressTarget: 1,
  },
  [QuestTypeValues.moduleUnitRetry]: {
    tier: 'daily',
    expReward: QUEST_COMPLETION_REWARD,
    requiresModuleTarget: true,
    requiresModuleUnitTarget: false,
    defaultProgressTarget: 1,
  },
  [QuestTypeValues.dailyPracticeStreak]: {
    tier: 'daily',
    expReward: QUEST_COMPLETION_REWARD,
    requiresModuleTarget: true,
    requiresModuleUnitTarget: false,
    defaultProgressTarget: 3,
  },
  [QuestTypeValues.masterDailyQuests]: {
    tier: 'master',
    expReward: MASTER_QUEST_COMPLETION_REWARD,
    requiresModuleTarget: false,
    requiresModuleUnitTarget: false,
    defaultProgressTarget: 3,
  },
} as const satisfies Record<QuestType, QuestDefinition>;

// Helper keeps quest metadata access consistent and narrows callers to supported quest types only.
export function getQuestDefinition(type: QuestType): QuestDefinition {
  return QUEST_DEFINITIONS[type];
}

// Labels for each quest type to be displayed on the frontend.
export const QUEST_TYPE_LABELS = {
  [QuestTypeValues.completeDailyPractice]: 'Complete daily practice',
  [QuestTypeValues.completeNewUnit]: 'Complete new unit',
  [QuestTypeValues.moduleUnitRetry]: 'Retry completed lesson',
  [QuestTypeValues.dailyPracticeStreak]: 'Reach a daily practice streak',
  [QuestTypeValues.masterDailyQuests]: 'Master quest',
} as const;

// Structure of a quest object as returned by the API.
// Quests are generated at UTC midnight each day for each student based on their current progress.
export interface Quest {
  id: number;
  moduleId: number | null;
  // Null for module-level quests that are not tied to a specific lesson.
  moduleUnitId: number | null;
  moduleTitle: string | null;
  type: QuestType;
  tier: QuestTier;
  expGranted: number;
  isCompleted: boolean;
  // Generic progress fields let clients render both binary quests and multi-step quests
  // without introducing endpoint-specific response variants.
  progressCurrent: number;
  progressTarget: number;
  // Canonical UTC day for "today" and history grouping.
  questDateUtc: string; // YYYY-MM-DD
  // Creation timestamp for auditing and troubleshooting generation runs.
  generatedAt: string; // ISO date-time string (UTC)
  // Nullable because incomplete quests do not have a completion timestamp.
  completedAt: string | null; // ISO date-time string (UTC)
}

// API view model for quests consumed by frontend screens.
// Backend resolves this so UI rendering does not need duplicated description logic.
export interface QuestView extends Quest {
  // Null when the quest is module-scoped or the linked lesson no longer exists.
  moduleUnitTitle: string | null;
  description: string;
}

// Query params for paged quest-history retrieval by UTC day windows.
export interface QuestHistoryQuery {
  dayLimit?: number;
  dayOffset?: number;
}

// Base response for quest collection reads.
export interface QuestResponse {
  quests: QuestView[];
}

// Paged history response includes pagination metadata for "load more" workflows.
export interface QuestHistoryResponse extends QuestResponse {
  hasMore: boolean;
  nextDayOffset: number | null;
}

// Mutation responses stay intentionally small because clients invalidate quest reads after trigger events.
export interface QuestProgressResponse {
  recorded: boolean;
}

export {};
