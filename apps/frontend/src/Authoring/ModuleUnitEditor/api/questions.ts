// Question creation API helpers scoped to module/unit authoring.
import { apiFetch } from '@/shared/api/client';
import type {
  CreateQuestionPayload,
  CreateQuestionResponse,
  CreateVariantPayload,
  CreateVariantResponse,
  UpdateQuestionContentPayload,
} from '@scholarxp/api-contracts';

export async function createQuestionForUnit(
  moduleId: number,
  unitId: number,
  payload: CreateQuestionPayload,
): Promise<CreateQuestionResponse> {
  return apiFetch<CreateQuestionResponse>(`/module/${moduleId}/unit/${unitId}/questions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createVariantForQuestion(
  moduleId: number,
  unitId: number,
  questionId: number,
  payload: CreateVariantPayload,
): Promise<CreateVariantResponse> {
  return apiFetch<CreateVariantResponse>(
    `/module/${moduleId}/unit/${unitId}/questions/${questionId}/variants`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export type UpdateQuestionContentRequest = UpdateQuestionContentPayload;

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
