// Question creation API helpers scoped to module/unit authoring.
import { apiFetch } from './client';

// Shared payload for question content endpoints; kept narrow to satisfy backend whitelist validation.
export type QuestionContentRequest = {
  questionStem: string;
  questionType: 'mcq' | 'trueFalse';
  questionData: Record<string, unknown>;
  hint?: string | null;
  difficultyScore: number;
  source: string;
  status: string;
};

export type CreateQuestionRequest = QuestionContentRequest & {
  questionGroupId?: number;
  title: string;
};

export type CreateQuestionResponse = {
  questionUnit: {
    id: number;
    moduleUnitId: number | null;
    questionGroupId: number | null;
    title: string;
  };
  coreContent: {
    id: number;
    questionUnitId: number;
    isCore: boolean;
    questionStem: string;
    questionData: Record<string, unknown>;
    type: string;
    hint: string | null;
    difficultyScore: number;
    source: string;
    status: string;
  };
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

export type CreateVariantRequest = QuestionContentRequest & { variantLabel: string };

export type CreateVariantResponse = {
  variant: {
    id: number;
    variantLabel: string;
    content: {
      id: number;
      questionUnitId: number;
      questionStem: string;
      questionData: Record<string, unknown>;
      type: string;
      hint: string | null;
      difficultyScore: number;
      source: string;
      status: string;
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
