// Covers module-unit editor page-state so load mapping, live guards, and draft save validation stay reliable.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModuleUnitEditorPageState } from './useModuleUnitEditorPageState';

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
  renameMutateAsync: vi.fn(),
  createGroupMutateAsync: vi.fn(),
  deleteGroupMutateAsync: vi.fn(),
  createQuestionMutateAsync: vi.fn(),
  createVariantMutateAsync: vi.fn(),
  updateQuestionContentMutateAsync: vi.fn(),
  deleteQuestionMutateAsync: vi.fn(),
  deleteVariantMutateAsync: vi.fn(),
}));

let editorDataState: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: unknown;
} = {
  isPending: false,
  isError: false,
  error: null,
  data: null,
};

vi.mock('../../utils/logger', () => ({
  logError: mocks.logError,
}));

vi.mock('../queries/useModuleUnitEditorQueries', () => ({
  useModuleUnitEditorDataQuery: () => editorDataState,
  useUpdateQuestionGroupNameMutation: () => ({ mutateAsync: mocks.renameMutateAsync }),
  useCreateQuestionGroupMutation: () => ({ mutateAsync: mocks.createGroupMutateAsync }),
  useDeleteQuestionGroupMutation: () => ({ mutateAsync: mocks.deleteGroupMutateAsync }),
  useCreateQuestionMutation: () => ({ mutateAsync: mocks.createQuestionMutateAsync }),
  useCreateVariantMutation: () => ({ mutateAsync: mocks.createVariantMutateAsync }),
  useUpdateQuestionContentMutation: () => ({ mutateAsync: mocks.updateQuestionContentMutateAsync }),
  useDeleteQuestionMutation: () => ({ mutateAsync: mocks.deleteQuestionMutateAsync }),
  useDeleteVariantMutation: () => ({ mutateAsync: mocks.deleteVariantMutateAsync }),
}));

function buildEditorData({
  status = 'draft',
  questionGroups,
}: {
  status?: 'draft' | 'live';
  questionGroups: unknown[];
}) {
  return {
    unit: {
      id: 2,
      title: 'Unit Alpha',
      variantContext: 'Instructor guidance',
      questionGroups,
    },
    moduleUnits: [
      {
        id: 2,
        status,
      },
    ],
  };
}

describe('useModuleUnitEditorPageState', () => {
  beforeEach(() => {
    editorDataState = {
      isPending: false,
      isError: false,
      error: null,
      data: null,
    };

    mocks.logError.mockReset();
    mocks.renameMutateAsync.mockReset();
    mocks.createGroupMutateAsync.mockReset();
    mocks.deleteGroupMutateAsync.mockReset();
    mocks.createQuestionMutateAsync.mockReset();
    mocks.createVariantMutateAsync.mockReset();
    mocks.updateQuestionContentMutateAsync.mockReset();
    mocks.deleteQuestionMutateAsync.mockReset();
    mocks.deleteVariantMutateAsync.mockReset();
  });

  it('maps loaded editor data into local state and initial selection/form', () => {
    editorDataState = {
      isPending: false,
      isError: false,
      error: null,
      data: buildEditorData({
        status: 'live',
        questionGroups: [
          {
            id: 100,
            name: 'Group 1',
            sortOrder: 1,
            questions: [
              {
                id: 200,
                title: 'Question 1',
                type: 'mcq',
                coreContent: {
                  id: 300,
                  questionUnitId: 200,
                  questionStem: 'Loaded stem',
                  questionData: {
                    options: [
                      { optionText: 'A', explanation: 'EA' },
                      { optionText: 'B', explanation: 'EB' },
                    ],
                    correctOptionIndex: 0,
                  },
                  type: 'mcq',
                  hint: 'Loaded hint',
                  source: 'human',
                  isArchived: false,
                },
                variants: [],
              },
            ],
          },
        ],
      }),
    };

    const { result } = renderHook(() =>
      useModuleUnitEditorPageState({ moduleIdParam: '10', unitIdParam: '2' }),
    );

    expect(result.current.unitTitle).toBe('Unit Alpha');
    expect(result.current.variantInstructions).toBe('Instructor guidance');
    expect(result.current.isUnitLive).toBe(true);
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.selected).toEqual({
      groupId: '100',
      questionId: '200',
      variantId: null,
    });
    expect(result.current.form.stem).toBe('Loaded stem');
  });

  it('blocks add-group action for live units and surfaces safe message', () => {
    editorDataState = {
      isPending: false,
      isError: false,
      error: null,
      data: buildEditorData({
        status: 'live',
        questionGroups: [],
      }),
    };

    const { result } = renderHook(() =>
      useModuleUnitEditorPageState({ moduleIdParam: '10', unitIdParam: '2' }),
    );

    act(() => {
      result.current.handleAddGroup();
    });

    expect(result.current.saveError).toBe('This module unit is live. New groups cannot be added.');
    expect(result.current.groups).toHaveLength(0);
  });

  it('adds a draft question to a non-live group and selects it', () => {
    editorDataState = {
      isPending: false,
      isError: false,
      error: null,
      data: buildEditorData({
        status: 'draft',
        questionGroups: [
          {
            id: 100,
            name: 'Group 1',
            sortOrder: 1,
            questions: [],
          },
        ],
      }),
    };

    const { result } = renderHook(() =>
      useModuleUnitEditorPageState({ moduleIdParam: '10', unitIdParam: '2' }),
    );

    act(() => {
      result.current.handleAddQuestion('100');
    });

    expect(result.current.groups[0]?.questions).toHaveLength(1);
    expect(result.current.groups[0]?.questions[0]?.isDraft).toBe(true);
    expect(result.current.selected).toEqual({
      groupId: '100',
      questionId: result.current.groups[0]?.questions[0]?.id,
      variantId: null,
    });
  });

  it('prevents save when draft question stem is empty', async () => {
    editorDataState = {
      isPending: false,
      isError: false,
      error: null,
      data: buildEditorData({
        status: 'draft',
        questionGroups: [
          {
            id: 100,
            name: 'Group 1',
            sortOrder: 1,
            questions: [],
          },
        ],
      }),
    };

    const { result } = renderHook(() =>
      useModuleUnitEditorPageState({ moduleIdParam: '10', unitIdParam: '2' }),
    );

    act(() => {
      result.current.handleAddQuestion('100');
    });

    await act(async () => {
      await result.current.handleSaveQuestion();
    });

    expect(result.current.saveError).toBe('Question stem is required.');
    expect(mocks.createQuestionMutateAsync).not.toHaveBeenCalled();
  });
});
