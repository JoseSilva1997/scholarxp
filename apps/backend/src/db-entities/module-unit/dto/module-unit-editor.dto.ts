// DTO for the module unit editor read endpoint; expanded as nested question/variant payloads are added.
// DTO returned to the module unit editor screen with nested questions and variants.
import type { QuestionData } from '@scholarxp/question-type-dtos';
import type {
  ModuleUnitEditorContentResponse,
  ModuleUnitEditorGroupResponse,
  ModuleUnitEditorQuestionResponse,
  ModuleUnitEditorResponse,
  ModuleUnitEditorVariantResponse,
  QuestionSource,
} from '@scholarxp/api-contracts';

export class ModuleUnitEditorDto implements ModuleUnitEditorResponse {
  id: number;
  moduleId: number | null;
  title: string;
  questionGroups: ModuleUnitEditorGroupDto[];
}

export class ModuleUnitEditorGroupDto implements ModuleUnitEditorGroupResponse {
  id: number;
  moduleUnitId: number;
  name: string;
  sortOrder: number;
  questions: ModuleUnitEditorQuestionDto[];
}

export class ModuleUnitEditorQuestionDto implements ModuleUnitEditorQuestionResponse {
  id: number;
  questionGroupId: number | null;
  title: string;
  type: string;
  coreContent: ModuleUnitEditorContentDto | null;
  variants: ModuleUnitEditorVariantDto[];
}

export class ModuleUnitEditorVariantDto implements ModuleUnitEditorVariantResponse {
  id: number;
  variantLabel: string;
  content: ModuleUnitEditorContentDto;
}

export class ModuleUnitEditorContentDto implements ModuleUnitEditorContentResponse {
  id: number;
  questionUnitId: number;
  questionStem: string;
  questionData: QuestionData;
  type: string;
  hint: string | null;
  source: QuestionSource;
  isArchived: boolean;
}
