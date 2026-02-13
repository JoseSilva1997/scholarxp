// Tests module-unit editor query hooks so scope guards and cache invalidation stay predictable.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type {
  ModuleUnitEditorResponse,
  ModuleUnitResponse,
  QuestionContentResponse,
} from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateQuestionGroupMutation,
  useCreateQuestionMutation,
  useCreateVariantMutation,
  useDeleteQuestionGroupMutation,
  useDeleteQuestionMutation,
  useDeleteVariantMutation,
  useModuleUnitEditorDataQuery,
  useUpdateQuestionContentMutation,
  useUpdateQuestionGroupNameMutation,
} from './useModuleUnitEditorQueries';
import { queryKeys } from '../query-keys';

const apiMocks = vi.hoisted(() => ({
  getModuleUnitEditor: vi.fn(),
  getModuleUnits: vi.fn(),
  createModuleUnitQuestionGroup: vi.fn(),
  deleteModuleUnitQuestionGroup: vi.fn(),
  updateModuleUnitQuestionGroupName: vi.fn(),
  createQuestionForUnit: vi.fn(),
  createVariantForQuestion: vi.fn(),
  updateQuestionContentScoped: vi.fn(),
  deleteQuestionFromUnit: vi.fn(),
  deleteVariantFromQuestion: vi.fn(),
}));

vi.mock('../../api/modules', async () => {
  const actual = await vi.importActual<typeof import('../../api/modules')>('../../api/modules');
  return {
    ...actual,
    getModuleUnitEditor: apiMocks.getModuleUnitEditor,
    getModuleUnits: apiMocks.getModuleUnits,
    createModuleUnitQuestionGroup: apiMocks.createModuleUnitQuestionGroup,
    deleteModuleUnitQuestionGroup: apiMocks.deleteModuleUnitQuestionGroup,
    updateModuleUnitQuestionGroupName: apiMocks.updateModuleUnitQuestionGroupName,
  };
});

vi.mock('../../api/questions', async () => {
  const actual = await vi.importActual<typeof import('../../api/questions')>('../../api/questions');
  return {
    ...actual,
    createQuestionForUnit: apiMocks.createQuestionForUnit,
    createVariantForQuestion: apiMocks.createVariantForQuestion,
    updateQuestionContentScoped: apiMocks.updateQuestionContentScoped,
    deleteQuestionFromUnit: apiMocks.deleteQuestionFromUnit,
    deleteVariantFromQuestion: apiMocks.deleteVariantFromQuestion,
  };
});

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function makeModuleUnit(partial: Partial<ModuleUnitResponse> = {}): ModuleUnitResponse {
  return {
    id: 1,
    moduleId: 10,
    variantContext: 'default',
    title: 'Unit',
    questionCount: 1,
    isCompleted: false,
    status: 'draft',
    sortOrder: 1,
    createdAt: '2026-02-09T00:00:00.000Z',
    questionGroups: [],
    ...partial,
  };
}

function makeEditor(): ModuleUnitEditorResponse {
  const content: QuestionContentResponse = {
    id: 201,
    questionUnitId: 101,
    questionStem: 'Stem',
    questionData: { options: [{ optionText: 'A' }, { optionText: 'B' }, { optionText: 'C' }, { optionText: 'D' }], correctOptionIndex: 0 },
    type: 'mcq',
    hint: null,
    difficultyScore: 0.5,
    source: 'human',
    isArchived: false,
  };

  return {
    id: 10,
    moduleId: 2,
    title: 'Editor Unit',
    variantContext: 'default',
    questionGroups: [
      {
        id: 1,
        moduleUnitId: 10,
        name: 'Group 1',
        sortOrder: 1,
        questions: [
          {
            id: 101,
            questionGroupId: 1,
            title: 'Q1',
            type: 'multiple_choice',
            coreContent: content,
            variants: [],
          },
        ],
      },
    ],
  };
}

describe('useModuleUnitEditorQueries', () => {
  beforeEach(() => {
    apiMocks.getModuleUnitEditor.mockReset();
    apiMocks.getModuleUnits.mockReset();
    apiMocks.createModuleUnitQuestionGroup.mockReset();
    apiMocks.deleteModuleUnitQuestionGroup.mockReset();
    apiMocks.updateModuleUnitQuestionGroupName.mockReset();
    apiMocks.createQuestionForUnit.mockReset();
    apiMocks.createVariantForQuestion.mockReset();
    apiMocks.updateQuestionContentScoped.mockReset();
    apiMocks.deleteQuestionFromUnit.mockReset();
    apiMocks.deleteVariantFromQuestion.mockReset();
  });

  it('loads editor and module units in one query when scope ids are present', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const editor = makeEditor();
    const units = [makeModuleUnit({ id: 10 }), makeModuleUnit({ id: 11, title: 'Unit 2' })];
    apiMocks.getModuleUnitEditor.mockResolvedValue(editor);
    apiMocks.getModuleUnits.mockResolvedValue(units);

    const { result } = renderHook(() => useModuleUnitEditorDataQuery(2, 10), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiMocks.getModuleUnitEditor).toHaveBeenCalledWith(2, 10);
    expect(apiMocks.getModuleUnits).toHaveBeenCalledWith(2);
    expect(result.current.data).toEqual({ unit: editor, moduleUnits: units });
  });

  it('does not fetch editor query when scope ids are missing', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    renderHook(() => useModuleUnitEditorDataQuery(null, null), {
      wrapper: createWrapper(queryClient),
    });

    expect(apiMocks.getModuleUnitEditor).not.toHaveBeenCalled();
    expect(apiMocks.getModuleUnits).not.toHaveBeenCalled();
  });

  it('calls create-question API and invalidates module-units cache on settle', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    apiMocks.createQuestionForUnit.mockResolvedValue({
      questionUnit: { id: 901, moduleUnitId: 10, questionGroupId: 1, title: 'New Question' },
      coreContent: {
        id: 902,
        questionUnitId: 901,
        questionStem: 'new stem',
        questionData: { content: '' },
        type: 'multiple_choice',
        hint: null,
        difficultyScore: 0.5,
        source: 'human',
        isArchived: false,
        isCore: true,
      },
    });

    const { result } = renderHook(
      () => useCreateQuestionMutation({ moduleId: 2, unitId: 10 }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        questionGroupId: 1,
        title: 'New Question',
        questionStem: 'new stem',
        type: 'mcq',
        questionData: { options: [{ optionText: 'A' }, { optionText: 'B' }, { optionText: 'C' }, { optionText: 'D' }], correctOptionIndex: 0 },
        source: 'human',
        isArchived: false,
      });
    });

    expect(apiMocks.createQuestionForUnit).toHaveBeenCalledWith(2, 10, expect.objectContaining({
      title: 'New Question',
      questionGroupId: 1,
    }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.units(2) });
  });

  it('throws clear error when renaming question group without scope', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { result } = renderHook(() => useUpdateQuestionGroupNameMutation(null), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({ questionGroupId: 77, payload: { name: 'Renamed' } }),
    ).rejects.toThrow('Missing module/unit scope for group rename.');

    expect(apiMocks.updateModuleUnitQuestionGroupName).not.toHaveBeenCalled();
  });

  it('creates/deletes groups and invalidates module-units cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    apiMocks.createModuleUnitQuestionGroup.mockResolvedValue({
      id: 3,
      moduleUnitId: 10,
      name: 'Group 3',
      sortOrder: 3,
    });
    apiMocks.deleteModuleUnitQuestionGroup.mockResolvedValue(undefined);

    const createResult = renderHook(
      () => useCreateQuestionGroupMutation({ moduleId: 2, unitId: 10 }),
      { wrapper: createWrapper(queryClient) },
    );
    await act(async () => {
      await createResult.result.current.mutateAsync({
        moduleUnitId: 10,
        name: 'Group 3',
        sortOrder: 3,
      });
    });
    expect(apiMocks.createModuleUnitQuestionGroup).toHaveBeenCalledWith(2, 10, {
      moduleUnitId: 10,
      name: 'Group 3',
      sortOrder: 3,
    });

    const deleteResult = renderHook(
      () => useDeleteQuestionGroupMutation({ moduleId: 2, unitId: 10 }),
      { wrapper: createWrapper(queryClient) },
    );
    await act(async () => {
      await deleteResult.result.current.mutateAsync(3);
    });
    expect(apiMocks.deleteModuleUnitQuestionGroup).toHaveBeenCalledWith(2, 10, 3);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.units(2) });
  });

  it('creates variants, updates content, deletes questions, and invalidates units cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    apiMocks.createVariantForQuestion.mockResolvedValue({ variant: { id: 1 } });
    apiMocks.updateQuestionContentScoped.mockResolvedValue({});
    apiMocks.deleteQuestionFromUnit.mockResolvedValue(undefined);

    const createVariantResult = renderHook(
      () => useCreateVariantMutation({ moduleId: 2, unitId: 10 }),
      { wrapper: createWrapper(queryClient) },
    );
    await act(async () => {
      await createVariantResult.result.current.mutateAsync({
        questionId: 101,
        payload: {
          variantLabel: 'B',
          questionStem: 'Variant stem',
          type: 'mcq',
          questionData: { options: [{ optionText: 'A' }, { optionText: 'B' }, { optionText: 'C' }, { optionText: 'D' }], correctOptionIndex: 1 },
          source: 'human',
          isArchived: false,
        },
      });
    });
    expect(apiMocks.createVariantForQuestion).toHaveBeenCalled();

    const updateContentResult = renderHook(
      () => useUpdateQuestionContentMutation({ moduleId: 2, unitId: 10 }),
      { wrapper: createWrapper(queryClient) },
    );
    await act(async () => {
      await updateContentResult.result.current.mutateAsync({
        questionId: 101,
        contentId: 201,
        payload: { questionStem: 'Updated stem' },
      });
    });
    expect(apiMocks.updateQuestionContentScoped).toHaveBeenCalledWith(
      2,
      10,
      101,
      201,
      { questionStem: 'Updated stem' },
    );

    const deleteQuestionResult = renderHook(
      () => useDeleteQuestionMutation({ moduleId: 2, unitId: 10 }),
      { wrapper: createWrapper(queryClient) },
    );
    await act(async () => {
      await deleteQuestionResult.result.current.mutateAsync(101);
    });
    expect(apiMocks.deleteQuestionFromUnit).toHaveBeenCalledWith(2, 10, 101);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.units(2) });
  });

  it('throws clear scope errors for scoped editor mutations when scope is missing', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const createGroup = renderHook(() => useCreateQuestionGroupMutation(null), {
      wrapper: createWrapper(queryClient),
    });
    await expect(
      createGroup.result.current.mutateAsync({ moduleUnitId: 10, name: 'G', sortOrder: 1 }),
    ).rejects.toThrow('Missing module/unit scope for group creation.');

    const deleteGroup = renderHook(() => useDeleteQuestionGroupMutation(null), {
      wrapper: createWrapper(queryClient),
    });
    await expect(deleteGroup.result.current.mutateAsync(1)).rejects.toThrow(
      'Missing module/unit scope for group deletion.',
    );

    const createVariant = renderHook(() => useCreateVariantMutation(null), {
      wrapper: createWrapper(queryClient),
    });
    await expect(
      createVariant.result.current.mutateAsync({
        questionId: 1,
        payload: {
          variantLabel: 'V',
          questionStem: 'S',
          type: 'mcq',
          questionData: { options: [{ optionText: 'A' }, { optionText: 'B' }, { optionText: 'C' }, { optionText: 'D' }], correctOptionIndex: 0 },
          source: 'human',
          isArchived: false,
        },
      }),
    ).rejects.toThrow('Missing module/unit scope for variant creation.');

    const updateContent = renderHook(() => useUpdateQuestionContentMutation(null), {
      wrapper: createWrapper(queryClient),
    });
    await expect(
      updateContent.result.current.mutateAsync({ questionId: 1, contentId: 1, payload: {} }),
    ).rejects.toThrow('Missing module/unit scope for question-content update.');

    const deleteQuestion = renderHook(() => useDeleteQuestionMutation(null), {
      wrapper: createWrapper(queryClient),
    });
    await expect(deleteQuestion.result.current.mutateAsync(1)).rejects.toThrow(
      'Missing module/unit scope for question deletion.',
    );

    const deleteVariant = renderHook(() => useDeleteVariantMutation(null), {
      wrapper: createWrapper(queryClient),
    });
    await expect(deleteVariant.result.current.mutateAsync({ questionId: 1, variantId: 1 })).rejects.toThrow(
      'Missing module/unit scope for variant deletion.',
    );
  });

  it('deletes variant and invalidates module-units cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    apiMocks.deleteVariantFromQuestion.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useDeleteVariantMutation({ moduleId: 2, unitId: 10 }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({ questionId: 101, variantId: 201 });
    });

    expect(apiMocks.deleteVariantFromQuestion).toHaveBeenCalledWith(2, 10, 101, 201);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.units(2) });
  });
});
