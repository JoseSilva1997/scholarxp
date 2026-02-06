// Question creation API helpers scoped to module/unit authoring.
import { apiFetch } from './client';
import type { questionType, QuestionData } from '@scholarxp/question-type-dtos';
import type {
  CreateQuestionPayload,
  CreateVariantPayload,
  QuestionContentResponse,
  QuestionSource,
  QuestionUnitResponse,
} from '@scholarxp/api-contracts';

// Shared payload for question content endpoints; kept narrow to satisfy backend whitelist validation.
export type QuestionContentRequest = {
  questionStem: string;
  type: questionType;
  questionData: QuestionData;
  hint?: string | null;
  difficultyScore?: number;
  source: QuestionSource;
  isArchived: boolean;
};

export type CreateQuestionRequest = CreateQuestionPayload;

export type CreateQuestionResponse = {
  questionUnit: QuestionUnitResponse;
  coreContent: QuestionContentResponse & { isCore: boolean };
};

export async function createQuestionForUnit(
  moduleId: number,
  unitId: number,
  payload: CreateQuestionRequest,
): Promise<CreateQuestionResponse> {
  return apiFetch<CreateQuestionResponse>(`/module/${moduleId}/unit/${unitId}/questions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type CreateVariantRequest = CreateVariantPayload;

export type CreateVariantResponse = {
  variant: {
    id: number;
    variantLabel: string;
    content: {
      id: number;
      questionUnitId: number;
      questionStem: string;
      questionData: QuestionData;
      type: string;
      hint: string | null;
      difficultyScore: number;
      source: QuestionSource;
      isArchived: boolean;
    };
  };
};

export async function createVariantForQuestion(
  moduleId: number,
  unitId: number,
  questionId: number,
  payload: CreateVariantRequest,
): Promise<CreateVariantResponse> {
  return apiFetch<CreateVariantResponse>(
    `/module/${moduleId}/unit/${unitId}/questions/${questionId}/variants`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export type UpdateQuestionContentRequest = Partial<QuestionContentRequest> & { type?: string };

export async function updateQuestionContentScoped(
  moduleId: number,
  unitId: number,
  questionId: number,
  contentId: number,
  payload: UpdateQuestionContentRequest,
) {
  return apiFetch(`/module/${moduleId}/unit/${unitId}/questions/${questionId}/content/${contentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteQuestionFromUnit(
  moduleId: number,
  unitId: number,
  questionId: number,
) {
  return apiFetch<void>(`/module/${moduleId}/unit/${unitId}/questions/${questionId}`, {
    method: 'DELETE',
  });
}

export async function deleteVariantFromQuestion(
  moduleId: number,
  unitId: number,
  questionId: number,
  variantId: number,
) {
  return apiFetch<void>(
    `/module/${moduleId}/unit/${unitId}/questions/${questionId}/variants/${variantId}`,
    {
      method: 'DELETE',
    },
  );
}
