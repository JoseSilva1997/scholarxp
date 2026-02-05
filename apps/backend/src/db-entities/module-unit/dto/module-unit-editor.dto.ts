// DTO for the module unit editor read endpoint; expanded as nested question/variant payloads are added.
// DTO returned to the module unit editor screen with nested questions and variants.
import type { QuestionData } from '@scholarxp/question-type-dtos';
import type { QuestionSource } from '@scholarxp/api-contracts';

export class ModuleUnitEditorDto {
  id: number;
  moduleId: number | null;
  title: string;
  variantContext: string | null;
  questionGroups: ModuleUnitEditorGroupDto[];
}

export class ModuleUnitEditorGroupDto {
  id: number;
  moduleUnitId: number;
  name: string;
  sortOrder: number;
  questions: ModuleUnitEditorQuestionDto[];
}

export class ModuleUnitEditorQuestionDto {
  id: number;
  questionGroupId: number | null;
  title: string;
  type: string;
  coreContent: ModuleUnitEditorContentDto | null;
  variants: ModuleUnitEditorVariantDto[];
}

export class ModuleUnitEditorVariantDto {
  id: number;
  variantLabel: string;
  content: ModuleUnitEditorContentDto;
}

export class ModuleUnitEditorContentDto {
  id: number;
  questionUnitId: number;
  questionStem: string;
  questionData: QuestionData;
  type: string;
  hint: string | null;
  difficultyScore: number;
  source: QuestionSource;
  status: string;
}
