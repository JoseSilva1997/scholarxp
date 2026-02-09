// Verifies question API helpers keep module/unit/question route and payload contracts stable.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createQuestionForUnit,
  createVariantForQuestion,
  deleteQuestionFromUnit,
  deleteVariantFromQuestion,
  updateQuestionContentScoped,
} from './questions';
import type { CreateQuestionPayload, CreateVariantPayload } from '@scholarxp/api-contracts';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('./client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('questions api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('creates question with POST /module/:moduleId/unit/:unitId/questions', async () => {
    const payload = {
      questionGroupId: 3,
      title: 'Question A',
      questionStem: 'What is 2+2?',
      type: 'mcq' as const,
      questionData: { options: [{ optionText: 'A', explanation: undefined }, { optionText: 'B', explanation: undefined }, { optionText: 'C', explanation: undefined }, { optionText: 'D', explanation: undefined }], correctOptionIndex: 0 },
      source: 'human' as const,
      isArchived: false,
    } as CreateQuestionPayload;

    await createQuestionForUnit(4, 9, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/4/unit/9/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('creates variant with POST /module/:moduleId/unit/:unitId/questions/:questionId/variants', async () => {
    const payload = {
      variantLabel: 'B',
      questionStem: 'What is 3+3?',
      type: 'true-false' as const,
      questionData: { options: [{ optionText: 'True', explanation: undefined }, { optionText: 'False', explanation: undefined }], correctOptionIndex: 0 },
      source: 'human' as const,
      isArchived: false,
    } as CreateVariantPayload;

    await createVariantForQuestion(4, 9, 88, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/4/unit/9/questions/88/variants', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('updates question content with PATCH /module/:moduleId/unit/:unitId/questions/:questionId/content/:contentId', async () => {
    const payload = {
      questionStem: 'Updated stem',
      hint: 'Updated hint',
    };

    await updateQuestionContentScoped(4, 9, 88, 101, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/4/unit/9/questions/88/content/101', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  });

  it('deletes question with DELETE /module/:moduleId/unit/:unitId/questions/:questionId', async () => {
    await deleteQuestionFromUnit(4, 9, 88);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/4/unit/9/questions/88', {
      method: 'DELETE',
    });
  });

  it('deletes variant with DELETE /module/:moduleId/unit/:unitId/questions/:questionId/variants/:variantId', async () => {
    await deleteVariantFromQuestion(4, 9, 88, 7);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/4/unit/9/questions/88/variants/7', {
      method: 'DELETE',
    });
  });
});
