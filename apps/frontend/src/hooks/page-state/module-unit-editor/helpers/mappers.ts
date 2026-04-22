// Converts backend module-unit-editor payloads into local editor state with draft-friendly ids.
import { normalizeQuestionType } from '../../../../components/ModuleUnitEditor/question-types/QuestionTypeRegistry';
import type { ModuleUnitEditorGroup } from '../../../../types/module';
import type { QuestionGroup } from './types';
import { normalizeSource } from './source';

export const mapEditorGroupsToState = (
  groups: ModuleUnitEditorGroup[] | undefined,
): QuestionGroup[] =>
  (groups ?? []).map((group) => ({
    id: String(group.id),
    title: group.name,
    sortOrder: group.sortOrder,
    questions: (group.questions ?? []).map((question) => ({
      id: String(question.id),
      title: question.title,
      type: normalizeQuestionType(question.type),
      variants: (question.variants ?? []).map((variant) => ({
        id: String(variant.id),
        label: variant.variantLabel,
        content: variant.content
          ? {
              id: String(variant.content.id),
              questionUnitId: String(variant.content.questionUnitId ?? question.id),
              questionStem: variant.content.questionStem,
              questionData: variant.content.questionData,
              type: normalizeQuestionType(variant.content.type),
              hint: variant.content.hint ?? null,
              source: normalizeSource(variant.content.source),
              isArchived: Boolean(variant.content.isArchived),
            }
          : undefined,
      })),
      coreContent: question.coreContent
        ? {
            id: String(question.coreContent.id),
            questionUnitId: String(question.coreContent.questionUnitId),
            questionStem: question.coreContent.questionStem,
            questionData: question.coreContent.questionData,
            type: normalizeQuestionType(question.coreContent.type),
            hint: question.coreContent.hint ?? null,
            source: normalizeSource(question.coreContent.source),
            isArchived: Boolean(question.coreContent.isArchived),
          }
        : undefined,
    })),
  }));
