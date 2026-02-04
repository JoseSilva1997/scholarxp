import type { QuestionData } from '@scholarxp/question-type-dtos';

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
}

export type ModuleUnitStatus = 'draft' | 'live' | 'locked' | 'archived';

export interface ModuleUnitGroupResponse {
  id: number;
  moduleUnitId: number;
  name: string;
  sortOrder: number;
}

export interface ModuleUnitResponse {
  id: number;
  moduleId: number | null;
  variantContext: string;
  title: string;
  questionCount: number;
  status: ModuleUnitStatus;
  sortOrder: number;
  createdAt: string;
  questionGroups: ModuleUnitGroupResponse[];
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
  difficultyScore: number;
  source: string;
  status: string;
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
