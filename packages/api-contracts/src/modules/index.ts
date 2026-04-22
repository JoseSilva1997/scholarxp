import type { QuestionData } from '@scholarxp/question-type-dtos';
import type { QuestionSource } from '../questions';
import type { DailyPracticeStatusSummary } from '../daily_practice';

/**
 * Module domain contracts for ScholarXP
 */

export interface ModuleSummaryResponse {
  id: number;
  institutionId?: number | null;
  ltiContextId?: string | null;
  resourceLinkId?: string | null;
  variantContext?: string | null;
  title: string;
  description?: string | null;
  createdByUserId?: number | null;
  userModuleLevel?: number;
  currentExp?: number;
  expMax?: number;
  dailyPractice?: DailyPracticeStatusSummary;
}

export type ModuleUnitStatus = 'draft' | 'live' | 'locked' | 'archived';
export type QuestionAttemptResult = 'correct' | 'incorrect' | null;

export interface ModuleUnitQuestionResponse {
  id: number;
  title: string;
  lastAttemptResult: QuestionAttemptResult;
}

export interface ModuleUnitGroupResponse {
  id: number;
  moduleUnitId: number;
  name: string;
  sortOrder: number;
  questions?: ModuleUnitQuestionResponse[];
}

export interface CreateModuleUnitQuestionGroupPayload {
  moduleUnitId: number;
  name: string;
  sortOrder: number;
}

export interface UpdateModuleUnitQuestionGroupNamePayload {
  name: string;
}

// Shared naming contract for module unit question groups across backend and frontend.
export const MODULE_UNIT_GROUP_NAME_PREFIX = 'Group';
export const MODULE_UNIT_GROUP_START_ORDER = 1;

export const getModuleUnitGroupName = (sortOrder: number): string => {
  // Clamp invalid values so callers always receive a stable, user-facing name.
  const normalizedSortOrder =
    Number.isFinite(sortOrder) && sortOrder >= MODULE_UNIT_GROUP_START_ORDER
      ? Math.floor(sortOrder)
      : MODULE_UNIT_GROUP_START_ORDER;
  return `${MODULE_UNIT_GROUP_NAME_PREFIX} ${normalizedSortOrder}`;
};

export interface ModuleUnitExpEarned {
  base: number;
  firstAttempt: number;
  streak: number;
  mastery: number;
}

export interface ModuleUnitResponse {
  id: number;
  moduleId: number | null;
  variantContext: string;
  title: string;
  questionCount: number;
  isCompleted: boolean;
  status: ModuleUnitStatus;
  sortOrder: number;
  createdAt: string;
  questionGroups: ModuleUnitGroupResponse[];
  // Per-category earned EXP breakdown. Only present for student-scoped calls.
  expEarned?: ModuleUnitExpEarned;
}

export interface CreateModulePayload {
  institutionId?: number;
  ltiContextId?: string;
  resourceLinkId?: string;
  variantContext?: string | null;
  title: string;
  description?: string | null;
  createdByUserId?: number;
}

export interface UpdateModulePayload extends Partial<CreateModulePayload> {}

export interface CreateModuleUnitMinimalPayload {
  title: string;
}

export interface CreateModuleUnitPayload {
  moduleId: number;
  variantContext: string;
  title: string;
  questionCount: number;
  status: ModuleUnitStatus;
  sortOrder: number;
}

export interface UpdateModuleUnitPayload extends Partial<CreateModuleUnitPayload> {}

export interface UpdateModuleUnitStatusPayload {
  status: ModuleUnitStatus;
}

export interface ModuleUnitEditorContentResponse {
  id: number;
  questionUnitId: number;
  questionStem: string;
  questionData: QuestionData;
  type: string;
  hint: string | null;
  // Keep editor content source aligned with question contracts to prevent frontend/backend drift.
  source: QuestionSource;
  isArchived: boolean;
}

export interface ModuleUnitEditorVariantResponse {
  id: number;
  variantLabel: string;
  content: ModuleUnitEditorContentResponse;
}

export interface ModuleUnitEditorQuestionResponse {
  id: number;
  questionGroupId: number | null;
  title: string;
  type: string;
  coreContent: ModuleUnitEditorContentResponse | null;
  variants: ModuleUnitEditorVariantResponse[];
}

export interface ModuleUnitEditorGroupResponse {
  id: number;
  moduleUnitId: number;
  name: string;
  sortOrder: number;
  questions: ModuleUnitEditorQuestionResponse[];
}

export interface ModuleUnitEditorResponse {
  id: number;
  moduleId: number | null;
  title: string;
  variantContext: string | null;
  questionGroups: ModuleUnitEditorGroupResponse[];
}
