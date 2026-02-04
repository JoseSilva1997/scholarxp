// Shared type for modules as returned by backend module endpoints.
import type { QuestionData } from '@scholarxp/question-type-dtos';

export type ModuleSummary = {
  id: number;
  institutionId?: number | null;
  ltiContextId?: string | null;
  resourceLinkId?: string | null;
  variantContext?: string | null;
  title: string;
  description?: string | null;
  createdByUserId?: number | null;
  // Student-only progress fields; returned when the caller is enrolled as a student in the module.
  userModuleLevel?: number;
  currentExp?: number;
  expMax?: number;
};

export type ModuleUnitStatus = 'draft' | 'live' | 'locked';

export type ModuleUnitGroup = {
  id: number;
  moduleUnitId: number;
  name: string;
  sortOrder: number;
};

export type ModuleUnitResponse = {
  id: number;
  moduleId: number | null;
  variantContext: string;
  title: string;
  questionCount: number;
  status: ModuleUnitStatus;
  sortOrder: number;
  createdAt: string;
  questionGroups: ModuleUnitGroup[];
};

// Detailed payload for the editor screen; expands as more nested data (questions, variants, bodies) are added.
export type ModuleUnitEditorDto = {
  id: number;
  moduleId: number | null;
  title: string;
  variantContext: string | null;
  questionGroups: ModuleUnitEditorGroup[];
};

export type ModuleUnitEditorGroup = {
  id: number;
  moduleUnitId: number;
  name: string;
  sortOrder: number;
  questions: ModuleUnitEditorQuestion[];
};

export type ModuleUnitEditorQuestion = {
  id: number;
  questionGroupId: number | null;
  title: string;
  type: string;
  coreContent: ModuleUnitEditorContent | null;
  variants: ModuleUnitEditorVariant[];
};

export type ModuleUnitEditorVariant = {
  id: number;
  variantLabel: string;
  content: ModuleUnitEditorContent;
};

export type ModuleUnitEditorContent = {
  id: number;
  questionUnitId: number;
  questionStem: string;
  questionData: QuestionData;
  type: string;
  hint: string | null;
  difficultyScore: number;
  source: string;
  status: string;
};

export type ModuleInvite = {
  id: number;
  moduleId: number;
  createdByUserId: number;
  type: 'link';
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  emailLock: string | null;
};

export type CreateModuleInviteResponse = {
  invite: ModuleInvite;
  token: string;
  url: string;
};
