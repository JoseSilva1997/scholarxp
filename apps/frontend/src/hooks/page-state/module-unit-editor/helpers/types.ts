// Shared module-unit-editor state types so route-level hooks can compose without type duplication.
import type { ModuleUnitEditorContent, ModuleUnitEditorGroup, ModuleUnitEditorQuestion } from '../../../../types/module';
import type { QuestionType } from '../../../../components/question-types/QuestionTypeRegistry';

// Local editor content uses string ids so drafts and persisted records can share one state model.
export type QuestionContent = Omit<
  ModuleUnitEditorContent,
  'id' | 'questionUnitId' | 'difficultyScore'
> & {
  id: string;
  questionUnitId: string;
  // Backend defaults difficulty values, so local drafts can omit it until persisted.
  difficultyScore?: number;
};

// Variants are authored locally first, then promoted to persisted records after save.
export type Variant = {
  id: string;
  label: string;
  content?: QuestionContent;
  isDraft?: boolean;
};

// Questions include local draft metadata and normalized question type handling.
export type Question = Omit<
  ModuleUnitEditorQuestion,
  'id' | 'coreContent' | 'variants' | 'type' | 'moduleUnitId' | 'questionGroupId'
> & {
  id: string;
  title: string;
  type: QuestionType;
  coreContent?: QuestionContent;
  variants: Variant[];
  isDraft?: boolean;
};

// Groups are ordered independently from labels so title edits do not affect sequencing.
export type QuestionGroup = Omit<
  ModuleUnitEditorGroup,
  'id' | 'questions' | 'name' | 'moduleUnitId' | 'sortOrder'
> & {
  id: string;
  title: string;
  sortOrder: number;
  questions: Question[];
};

// Delete targets capture the minimum context needed for copy and mutation orchestration.
export type DeleteTarget =
  | { type: 'group'; groupId: string; title: string }
  | { type: 'question'; groupId: string; questionId: string; title: string }
  | {
      type: 'variant';
      groupId: string;
      questionId: string;
      variantId: string;
      label: string;
    };

// Selection always tracks the currently focused group/question/variant in the editor.
export type SelectionState = {
  groupId: string;
  questionId: string | null;
  variantId: string | null;
};

// Modal copy is derived from the current delete target and unit status.
export type DeleteCopy = {
  title: string;
  body: string;
  confirmLabel: string;
};
