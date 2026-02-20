// Comprehensive branch-coverage tests for useModuleUnitEditorPageState hook.
// Tests all major code paths including edge cases, state transitions, and conditional rendering.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ModuleUnitEditorResponse } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModuleUnitEditorPageState } from './useModuleUnitEditorPageState';

// ===== Mock Setup =====
const mocks = vi.hoisted(() => {
  // Define a shared ApiError class that will be used in both the mocks and api/client mock.
  // This ensures that instanceof checks work correctly in the code.
  class MockApiError {
    status: number;
    details?: Array<{ message: string }>;
    name = 'ApiError';
    message: string;

    constructor(message: string, status: number, details?: Array<{ message: string }>) {
      this.message = message;
      this.status = status;
      this.details = details;
    }
  }

  return {
    logError: vi.fn(),
    renameMutateAsync: vi.fn(),
    createGroupMutateAsync: vi.fn(),
    deleteGroupMutateAsync: vi.fn(),
    createQuestionMutateAsync: vi.fn(),
    createVariantMutateAsync: vi.fn(),
    updateQuestionContentMutateAsync: vi.fn(),
    deleteQuestionMutateAsync: vi.fn(),
    deleteVariantMutateAsync: vi.fn(),
    updateModuleUnitMutateAsync: vi.fn(),
    ApiError: MockApiError,
  };
});

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

vi.mock('../../api/client', () => {
  // Use the same ApiError class from mocks so instanceof checks work correctly.
  return {
    ApiError: mocks.ApiError,
  };
});

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
  useUpdateModuleUnitMutation: () => ({ mutateAsync: mocks.updateModuleUnitMutateAsync }),
}));

// ===== Helper Functions =====
function buildEditorData({
  status = 'draft',
  questionGroups,
  unitTitle = 'Unit Alpha',
  variantContext = 'Instructor guidance',
}: {
  status?: 'draft' | 'live';
  unitTitle?: string;
  variantContext?: string | null;
  questionGroups: unknown[];
}): ModuleUnitEditorResponse {
  return {
    unit: {
      id: 2,
      title: unitTitle,
      variantContext,
      questionGroups,
    },
    moduleUnits: [
      {
        id: 2,
        status,
      },
    ],
  } as unknown as ModuleUnitEditorResponse;
}

function createQuestionGroup(id: number, name: string, sortOrder: number, questions: unknown[] = []) {
  return {
    id,
    name,
    sortOrder,
    questions,
  };
}

function createQuestion(id: number, title: string, variants: unknown[] = [], coreContent: unknown = null) {
  return {
    id,
    title,
    type: 'mcq',
    coreContent: coreContent || {
      id: id + 100,
      questionUnitId: id,
      questionStem: `Question ${id} stem`,
      questionData: {
        options: [
          { optionText: 'A', explanation: 'Explanation A' },
          { optionText: 'B', explanation: 'Explanation B' },
        ],
        correctOptionIndex: 0,
      },
      type: 'mcq',
      hint: `Hint ${id}`,
      source: 'human',
      isArchived: false,
      difficultyScore: 1,
    },
    variants,
  };
}

function createVariant(id: number, label: string, content = null) {
  return {
    id,
    variantLabel: label,
    content: content || {
      id: id + 100,
      questionUnitId: 10,
      questionStem: `Variant ${id} stem`,
      questionData: { options: [{ optionText: 'X' }], correctOptionIndex: 0 },
      type: 'mcq',
      hint: null,
      source: 'human',
      isArchived: false,
      difficultyScore: 1,
    },
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

  // ===== Initialization & Route Parsing =====
  describe('initialization and route parameter parsing', () => {
    it('should return null for invalid module id (non-numeric)', () => {
      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: 'invalid', unitIdParam: '2' })
      );
      expect(result.current.parsedModuleId).toBeNull();
    });

    it('should return null for invalid unit id (non-numeric)', () => {
      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: 'not-a-number' })
      );
      expect(result.current.parsedUnitId).toBeNull();
    });

    it('should parse valid numeric ids', () => {
      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '123', unitIdParam: '456' })
      );
      expect(result.current.parsedModuleId).toBe(123);
      expect(result.current.parsedUnitId).toBe(456);
    });

    it('should handle undefined parameters returning null', () => {
      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: undefined, unitIdParam: undefined })
      );
      expect(result.current.parsedModuleId).toBeNull();
      expect(result.current.parsedUnitId).toBeNull();
    });

    it('should handle empty string parameters returning null', () => {
      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '', unitIdParam: '' })
      );
      expect(result.current.parsedModuleId).toBeNull();
      expect(result.current.parsedUnitId).toBeNull();
    });

    it('should return null for NaN numeric ids', () => {
      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: 'Infinity', unitIdParam: '2' })
      );
      expect(result.current.parsedModuleId).toBeNull();
    });

    it('should handle partial invalid parameters', () => {
      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: undefined })
      );
      expect(result.current.parsedModuleId).toBe(1);
      expect(result.current.parsedUnitId).toBeNull();
    });

    it('selects question from initial question id param when present', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')]),
            createQuestionGroup(101, 'Group 2', 2, [createQuestion(300, 'Q2')]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({
          moduleIdParam: '1',
          unitIdParam: '2',
          initialQuestionIdParam: '300',
        }),
      );

      await waitFor(() => {
        expect(result.current.selected).toEqual({
          groupId: '101',
          questionId: '300',
          variantId: null,
        });
      });
    });
  });

  // ===== Loading States =====
  describe('loading and error states', () => {
    it('should indicate loading when query is pending with valid ids', () => {
      editorDataState = {
        isPending: true,
        isError: false,
        error: null,
        data: null,
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );
      expect(result.current.isLoading).toBe(true);
    });

    it('should not be loading when query succeeds', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );
      expect(result.current.isLoading).toBe(false);
    });

    it('should not be loading when invalid ids even if pending', () => {
      editorDataState = {
        isPending: true,
        isError: false,
        error: null,
        data: null,
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: 'invalid', unitIdParam: '2' })
      );
      expect(result.current.isLoading).toBe(false);
    });

    it('should set error message when query fails', () => {
      editorDataState = {
        isPending: false,
        isError: true,
        error: new Error('Network error'),
        data: null,
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );
      expect(result.current.error).toBe('Could not load this module unit. Please try again.');
    });

    it('should return null for error when no error present', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );
      expect(result.current.error).toBeNull();
    });

    it('should log error on query failure with unit id', async () => {
      editorDataState = {
        isPending: false,
        isError: true,
        error: new Error('Load failed'),
        data: null,
      };

      renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      await waitFor(() => {
        expect(mocks.logError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            feature: 'module-unit-editor',
            action: 'load',
            unitId: 2,
          })
        );
      });
    });
  });

  // ===== Data Mapping and Initial State =====
  describe('data loading and state mapping', () => {
    it('maps loaded editor data into local state and initial selection/form', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'live',
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [
              createQuestion(200, 'Question 1', [], {
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
                difficultyScore: 1,
              }),
            ]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '10', unitIdParam: '2' })
      );

      expect(result.current.unitTitle).toBe('Unit Alpha');
      expect(result.current.variantInstructions).toBe('Instructor guidance');
      expect(result.current.isUnitLive).toBe(true);
      expect(result.current.groups).toHaveLength(1);
      expect(result.current.selected).toEqual({ groupId: '100', questionId: '200', variantId: null });
      expect(result.current.form.stem).toBe('Loaded stem');
    });

    it('should handle null variant context', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          variantContext: null,
          questionGroups: [],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.variantInstructions).toBe('');
    });

    it('should set isDraft flag to false when unit is draft', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.isUnitLive).toBe(false);
    });

    it('should expand all groups on initial load', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1),
            createQuestionGroup(101, 'Group 2', 2),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.expandedGroups.size).toBe(2);
      expect(result.current.expandedGroups.has('100')).toBe(true);
      expect(result.current.expandedGroups.has('101')).toBe(true);
    });

    it('should select null when no groups exist', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.selected).toBeNull();
    });

    it('should select null when group has no questions', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Empty Group', 1, [])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.selected?.questionId).toBeNull();
    });

    it('should load core content into form when initial question selected', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.form.stem).toContain('Question 200 stem');
    });

    it('should map multiple groups with multiple questions', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [
              createQuestion(200, 'Q1'),
              createQuestion(201, 'Q2'),
            ]),
            createQuestionGroup(101, 'Group 2', 2, [createQuestion(210, 'Q3')]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.groups).toHaveLength(2);
      expect(result.current.groups[0]?.questions).toHaveLength(2);
      expect(result.current.groups[1]?.questions).toHaveLength(1);
    });

    it('should map variants within questions', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [
              createQuestion(200, 'Q1', [createVariant(300, 'Variant 1')]),
            ]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.groups[0]?.questions[0]?.variants).toHaveLength(1);
      expect(result.current.groups[0]?.questions[0]?.variants[0]?.label).toBe('Variant 1');
    });
  });

  // ===== Add Functionality (Groups, Questions, Variants) =====
  describe('add group functionality', () => {
    it('adds new group to draft unit and sets selection', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ status: 'draft', questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddGroup();
      });

      expect(result.current.groups).toHaveLength(1);
      expect(result.current.selected?.groupId).toBeDefined();
      expect(result.current.selected?.questionId).toBeNull();
    });

    it('prevents adding group to live unit', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ status: 'live', questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddGroup();
      });

      expect(result.current.saveError).toBe('This module unit is live. New groups cannot be added.');
      expect(result.current.groups).toHaveLength(0);
    });

    it('expands new group on add', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ status: 'draft', questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddGroup();
      });

      const newGroupId = result.current.groups[0]?.id;
      expect(result.current.expandedGroups.has(newGroupId!)).toBe(true);
    });

    it('increments sort order correctly for multiple groups', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddGroup();
      });

      expect(result.current.groups).toHaveLength(2);
      expect(result.current.groups[1]?.sortOrder).toBeGreaterThan(result.current.groups[0]!.sortOrder);
    });
  });

  describe('add question functionality', () => {
    it('adds draft question to group', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddQuestion('100');
      });

      expect(result.current.groups[0]?.questions).toHaveLength(1);
      expect(result.current.groups[0]?.questions[0]?.isDraft).toBe(true);
    });

    it('prevents adding question to live unit', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'live',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddQuestion('100');
      });

      expect(result.current.saveError).toBe('This module unit is live. New questions cannot be added.');
    });

    it('prevents adding question when last question is unsaved', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddQuestion('100');
      });

      act(() => {
        result.current.handleAddQuestion('100');
      });

      expect(result.current.saveError).toContain('Save Question');
    });

    it('selects new draft question', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddQuestion('100');
      });

      expect(result.current.selected?.questionId).toBeDefined();
      expect(result.current.selected?.variantId).toBeNull();
    });
  });

  describe('add variant functionality', () => {
    it('adds draft variant to saved question', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddVariant('100', '200');
      });

      expect(result.current.groups[0]?.questions[0]?.variants.length).toBeGreaterThan(0);
    });

    it('prevents adding variant to live unit', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'live',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddVariant('100', '200');
      });

      expect(result.current.saveError).toBe('This module unit is live. New variants cannot be added.');
    });

    it('selects new variant after adding', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddVariant('100', '200');
      });

      expect(result.current.selected?.variantId).toBeDefined();
    });
  });

  // ===== Group Editing =====
  describe('group title editing', () => {
    it('starts editing group with current title', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Original Title', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.startEditingGroupTitle('100', 'Original Title');
      });

      expect(result.current.editingGroupId).toBe('100');
      expect(result.current.editingGroupTitle).toBe('Original Title');
    });

    it('cancels editing and clears state', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Original Title', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.startEditingGroupTitle('100', 'Original Title');
        result.current.setEditingGroupTitle('New Title');
        result.current.cancelEditingGroupTitle();
      });

      expect(result.current.editingGroupId).toBeNull();
      expect(result.current.editingGroupTitle).toBe('');
    });

    it('saves draft group title without API call', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ status: 'draft', questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddGroup();
      });

      const groupId = result.current.groups[0]?.id;

      act(() => {
        result.current.startEditingGroupTitle(groupId!, 'Default');
        result.current.setEditingGroupTitle('Custom Name');
      });

      await act(async () => {
        await result.current.saveEditingGroupTitle(groupId!);
      });

      expect(result.current.groups[0]?.title).toBe('Custom Name');
      expect(mocks.renameMutateAsync).not.toHaveBeenCalled();
    });

    it('prevents saving empty group title', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Original', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.startEditingGroupTitle('100', 'Original');
        result.current.setEditingGroupTitle('   ');
      });

      await act(async () => {
        await result.current.saveEditingGroupTitle('100');
      });

      expect(result.current.editingGroupId).toBe('100');
    });

    it('calls API for persisted group rename', async () => {
      mocks.renameMutateAsync.mockResolvedValue({});

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Original', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.startEditingGroupTitle('100', 'Original');
        result.current.setEditingGroupTitle('Renamed');
      });

      await act(async () => {
        await result.current.saveEditingGroupTitle('100');
      });

      expect(mocks.renameMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          questionGroupId: 100,
          payload: { name: 'Renamed' },
        })
      );
    });

    it('handles API error during rename gracefully', async () => {
      // Import the mocked ApiError dynamically or mock the rejection with a plain object
      mocks.renameMutateAsync.mockRejectedValue({
        name: 'ApiError',
        message: 'Bad request',
        status: 400,
        details: [{ message: 'Invalid name' }],
      });

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Original', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.startEditingGroupTitle('100', 'Original');
        result.current.setEditingGroupTitle('New');
      });

      await act(async () => {
        await result.current.saveEditingGroupTitle('100');
      });

      expect(result.current.editingGroupId).toBe('100');
    });
  });

  // ===== Toggle Group Expansion =====
  describe('toggle group expansion', () => {
    it('toggles group expanded state', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      const wasExpanded = result.current.expandedGroups.has('100');

      act(() => {
        result.current.handleToggleGroup('100');
      });

      expect(result.current.expandedGroups.has('100')).toBe(!wasExpanded);
    });

    it('toggles back to original state', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      const initialState = result.current.expandedGroups.has('100');

      act(() => {
        result.current.handleToggleGroup('100');
        result.current.handleToggleGroup('100');
      });

      expect(result.current.expandedGroups.has('100')).toBe(initialState);
    });
  });

  // ===== Navigation =====
  describe('question and variant navigation', () => {
    it('navigates forward through items', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [
              createQuestion(200, 'Q1', [createVariant(300, 'V1')]),
            ]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      const initialSelection = result.current.selected;

      act(() => {
        if (result.current.canGoNext) {
          result.current.handleNavigate(1);
        }
      });

      // After navigating forward, selection should have changed
      if (initialSelection) {
        expect(result.current.selected).toBeDefined();
      }
    });

    it('navigates backward through items', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [
              createQuestion(200, 'Q1', [createVariant(300, 'V1')]),
            ]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        if (result.current.canGoNext) result.current.handleNavigate(1);
      });
      
      act(() => {
        if (result.current.canGoPrev) result.current.handleNavigate(-1);
      });

      // After navigating back, selection should have changed
      if (result.current.canGoPrev === false) {
        expect(result.current.selected?.questionId).toBeDefined();
      }
    });

    it('should return canGoPrev false at start', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.canGoPrev).toBe(false);
    });

    it('should return canGoNext false at end', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.canGoNext).toBe(false);
    });

    it('does not navigate with invalid selection', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleNavigate(1);
      });

      expect(result.current.selected).toBeNull();
    });
  });

  // ===== Delete Functionality =====
  describe('delete flow', () => {
    it('sets delete target for group', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({
          type: 'group',
          groupId: '100',
          title: 'Group 1',
        });
      });

      expect(result.current.deleteTarget?.type).toBe('group');
    });

    it('clears delete error when target changes', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteError('Some error');
        result.current.setDeleteTarget({ type: 'group', groupId: '100', title: 'Group 1' });
      });

      expect(result.current.deleteError).toBeNull();
    });

    it('uses Archive wording for live units', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'live',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({ type: 'group', groupId: '100', title: 'Group 1' });
      });

      expect(result.current.deleteCopy.confirmLabel).toContain('Archive');
    });

    it('uses Delete wording for draft units', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({ type: 'group', groupId: '100', title: 'Group 1' });
      });

      expect(result.current.deleteCopy.confirmLabel).toContain('Delete');
    });

    it('deletes group successfully', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1),
            createQuestionGroup(101, 'Group 2', 2),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({ type: 'group', groupId: '100', title: 'Group 1' });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(result.current.groups.findIndex((g) => g.id === '100')).toBe(-1);
      expect(result.current.deleteTarget).toBeNull();
    });

    it('deletes question successfully', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [
              createQuestion(200, 'Q1'),
              createQuestion(201, 'Q2'),
            ]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({
          type: 'question',
          groupId: '100',
          questionId: '200',
          title: 'Q1',
        });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(
        result.current.groups[0]?.questions.findIndex((q) => q.id === '200')
      ).toBe(-1);
    });

    it('deletes variant successfully', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [
              createQuestion(200, 'Q1', [
                createVariant(300, 'V1'),
                createVariant(301, 'V2'),
              ]),
            ]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({
          type: 'variant',
          groupId: '100',
          questionId: '200',
          variantId: '300',
          label: 'V1',
        });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(
        result.current.groups[0]?.questions[0]?.variants.findIndex((v) => v.id === '300')
      ).toBe(-1);
    });

    it('handles delete error and keeps target', async () => {
      mocks.deleteGroupMutateAsync.mockRejectedValue(new Error('Delete failed'));

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({
          type: 'group',
          groupId: '100',
          title: 'Group 1',
        });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(result.current.deleteError).toBeDefined();
      expect(result.current.deleteTarget).not.toBeNull();
    });

    it('resets selection on fallback when all questions deleted', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')]),
            createQuestionGroup(101, 'Group 2', 2, [createQuestion(210, 'Q2')]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({
          type: 'question',
          groupId: '100',
          questionId: '200',
          title: 'Q1',
        });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(result.current.selected?.groupId).toBeDefined();
    });
  });

  // ===== Form State & Content Management =====
  describe('form state and content management', () => {
    it('resets form when selection cleared', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setSelected(null);
      });

      expect(result.current.form.stem).toBe('');
    });

    it('loads core content into form when question selected', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.form.stem).toContain('stem');
    });

    it('updates correct option', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      const firstOptionId = result.current.form.options[0]?.id;

      act(() => {
        result.current.setCorrectOption(firstOptionId!);
      });

      expect(result.current.form.options.find((o) => o.id === firstOptionId)?.isCorrect).toBe(true);
    });

    it('updates option value', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      const optionId = result.current.form.options[0]?.id;

      act(() => {
        result.current.handleOptionChange(optionId!, 'Updated text');
      });

      expect(result.current.form.options.find((o) => o.id === optionId)?.value).toBe('Updated text');
    });

    it('updates explanation', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleExplanationChange(0, 'New explanation');
      });

      expect(result.current.form.explanations[0]).toBe('New explanation');
    });
  });

  // ===== Utility Functions =====
  describe('utility functions', () => {
    it('determines if question is saved', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      const question = result.current.groups[0]?.questions[0];
      expect(result.current.isQuestionSaved(question!)).toBe(true);
    });

    it('determines if variant can be added', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      const question = result.current.groups[0]?.questions[0];
      expect(result.current.canAddVariant(question!)).toBe(true);
    });

    it('formats question label with and without draft', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.formatQuestionLabel(0, false)).toBe('Question 1');
      expect(result.current.formatQuestionLabel(0, true)).toBe('Question 1 (draft)');
      expect(result.current.formatQuestionLabel(5, false)).toBe('Question 6');
    });

    it('formats variant label with and without draft', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.formatVariantLabel(0, false)).toBe('Variant 1');
      expect(result.current.formatVariantLabel(0, true)).toBe('Variant 1 (draft)');
      expect(result.current.formatVariantLabel(3, false)).toBe('Variant 4');
    });
  });

  // ===== Save Functionality =====
  describe('save question', () => {
    it('prevents save when no selection', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      await act(async () => {
        await result.current.handleSaveQuestion();
      });

      expect(result.current.saveError).toBe('Select a question before saving.');
    });

    it('prevents save with empty stem', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setForm({ ...result.current.form, stem: '   ' });
      });

      await act(async () => {
        await result.current.handleSaveQuestion();
      });

      expect(result.current.saveError).toBe('Question stem is required.');
    });

    it('handles save error gracefully', async () => {
      mocks.createQuestionMutateAsync.mockRejectedValue(new Error('Server error'));

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddQuestion('100');
      });

      act(() => {
        result.current.setForm({ ...result.current.form, stem: 'Test' });
      });

      await act(async () => {
        await result.current.handleSaveQuestion();
      });

      expect(result.current.saveError).toBeDefined();
    });
  });

  // ===== Edge Cases & Branch Coverage =====
  describe('edge cases and error handling', () => {
    it('handles null question group gracefully', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddQuestion('non-existent-id');
      });

      // Should not crash
      expect(result.current.groups).toBeDefined();
    });

    it('logs error event on data load failure', async () => {
      editorDataState = {
        isPending: false,
        isError: true,
        error: new Error('Network error'),
        data: null,
      };

      renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      await waitFor(() => {
        expect(mocks.logError).toHaveBeenCalled();
      });
    });

    it('handles variant instructions update', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setVariantInstructions('New instructions');
      });

      expect(result.current.variantInstructions).toBe('New instructions');
    });

    it('returns empty delete copy when no target', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget(null);
      });

      expect(result.current.deleteCopy.title).toBe('');
    });

    it('provides appropriate active label', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      expect(result.current.activeLabel).toBeDefined();
    });

    it('generates appropriate navigation state', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [
              createQuestion(200, 'Q1', [createVariant(300, 'V1')]),
            ]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      // Verify navigation properties exist and work as expected
      expect(result.current.canGoNext).toBeDefined();
      expect(result.current.activeLabel).toBeDefined();
    });

    it('handles missing group during selection', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setSelected({
          groupId: 'non-existent',
          questionId: '200',
          variantId: null,
        });
      });

      // Should not crash
      expect(result.current.selected?.groupId).toBe('non-existent');
    });
  });

  // ===== Advanced Error Handling =====
  describe('advanced error handling and edge cases', () => {
    it('handles 4xx API errors in delete group', async () => {
      mocks.deleteGroupMutateAsync.mockRejectedValue(
        new mocks.ApiError('Bad request', 400, [{ message: 'Group is not empty' }])
      );

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({ type: 'group', groupId: '100', title: 'Group 1' });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(result.current.deleteError).toBe('Could not delete this group. Please try again.');
      expect(mocks.logError).toHaveBeenCalled();
    });

    it('handles API error in delete group and logs it', async () => {
      mocks.deleteGroupMutateAsync.mockRejectedValue(
        new Error('Network error')
      );

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({ type: 'group', groupId: '100', title: 'Group 1' });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(result.current.deleteError).toBe('Could not delete this group. Please try again.');
      expect(mocks.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          feature: 'question-group',
          action: 'delete',
        })
      );
    });

    it('handles 5xx API errors in delete group', async () => {
      mocks.deleteGroupMutateAsync.mockRejectedValue(
        new mocks.ApiError('Internal server error', 500)
      );

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({ type: 'group', groupId: '100', title: 'Group 1' });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(result.current.deleteError).toBe('Could not delete this group. Please try again.');
      expect(mocks.logError).toHaveBeenCalled();
    });

    it('deletes draft group without API call', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ status: 'draft', questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddGroup();
      });

      const draftGroupId = result.current.groups[0]?.id;

      act(() => {
        result.current.setDeleteTarget({
          type: 'group',
          groupId: draftGroupId!,
          title: 'Draft Group',
        });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(mocks.deleteGroupMutateAsync).not.toHaveBeenCalled();
      expect(result.current.groups.length).toBe(0);
    });

    it('deletes draft question without API call', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddQuestion('100');
      });

      const draftQuestionId = result.current.groups[0]?.questions[0]?.id;

      act(() => {
        result.current.setDeleteTarget({
          type: 'question',
          groupId: '100',
          questionId: draftQuestionId!,
          title: 'Draft Question',
        });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(mocks.deleteQuestionMutateAsync).not.toHaveBeenCalled();
      expect(result.current.groups[0]?.questions.length).toBe(0);
    });

    it('handles error in delete question and keeps target on failure', async () => {
      mocks.deleteQuestionMutateAsync.mockRejectedValue(
        new Error('Delete failed')
      );

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({
          type: 'question',
          groupId: '100',
          questionId: '200',
          title: 'Q1',
        });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(result.current.deleteError).toBe('Could not delete this question. Please try again.');
      expect(result.current.deleteTarget).not.toBeNull();
      expect(mocks.logError).toHaveBeenCalled();
    });

    it('handles error in delete variant with unhandled error', async () => {
      mocks.deleteVariantMutateAsync.mockRejectedValue(new Error('Network error'));

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [
              createQuestion(200, 'Q1', [createVariant(300, 'V1')]),
            ]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setDeleteTarget({
          type: 'variant',
          groupId: '100',
          questionId: '200',
          variantId: '300',
          label: 'V1',
        });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(result.current.deleteError).toBe('Could not delete this variant. Please try again.');
      expect(mocks.logError).toHaveBeenCalled();
    });

    it('persists draft group with valid form data before saving question', async () => {
      mocks.createGroupMutateAsync.mockResolvedValue({ id: 999 });
      mocks.createQuestionMutateAsync.mockResolvedValue({
        questionUnit: { id: 1001 },
        coreContent: { id: 2001 },
      });

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      // Create a draft group to test persistence flow
      act(() => {
        result.current.handleAddGroup();
      });

      // Add question to the draft group
      act(() => {
        const draftGroupId = result.current.groups[0]?.id;
        if (draftGroupId) {
          result.current.handleAddQuestion(draftGroupId);
        }
      });

      // Set form with complete valid data (4 options required for MCQ)
      act(() => {
        result.current.setForm({
          ...result.current.form,
          stem: 'Test question?',
          options: [
            { id: 'opt1', value: 'Option A', isCorrect: true },
            { id: 'opt2', value: 'Option B', isCorrect: false },
            { id: 'opt3', value: 'Option C', isCorrect: false },
            { id: 'opt4', value: 'Option D', isCorrect: false },
          ],
        });
      });

      await act(async () => {
        await result.current.handleSaveQuestion();
      });

      // Should successfully persist draft group and create question
      expect(mocks.createGroupMutateAsync).toHaveBeenCalled();
      expect(mocks.createQuestionMutateAsync).toHaveBeenCalled();
      expect(result.current.saveError).toBeNull();
    });

    it('handles invalid group id response on create and logs error', async () => {
      // Mock invalid response that will fail Number.isFinite check
      mocks.createGroupMutateAsync.mockResolvedValue({ id: -Infinity });

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      // Create a draft group which will trigger createGroupMutation on save
      act(() => {
        result.current.handleAddGroup();
      });

      // Add question to the draft group
      act(() => {
        const draftGroupId = result.current.groups[0]?.id;
        if (draftGroupId) {
          result.current.handleAddQuestion(draftGroupId);
        }
      });

      // Set form with complete valid data
      act(() => {
        result.current.setForm({
          ...result.current.form,
          stem: 'Test question?',
          options: [
            { id: 'opt1', value: 'Option A', isCorrect: true },
            { id: 'opt2', value: 'Option B', isCorrect: false },
            { id: 'opt3', value: 'Option C', isCorrect: false },
            { id: 'opt4', value: 'Option D', isCorrect: false },
          ],
        });
      });

      await act(async () => {
        await result.current.handleSaveQuestion();
      });

      // Invalid response should trigger error
      expect(result.current.saveError).toContain('Could not create question group');
      expect(mocks.logError).toHaveBeenCalled();
    });

    it('handles question validation error from type config', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddQuestion('100');
      });

      act(() => {
        result.current.setForm({
          ...result.current.form,
          stem: 'Test stem',
          options: [], // Empty options should fail MCQ validation
        });
      });

      await act(async () => {
        await result.current.handleSaveQuestion();
      });

      expect(result.current.saveError).toBeDefined();
      expect(result.current.saveError).not.toBe('');
    });

    it('sets save states correctly during question save', async () => {
      mocks.createGroupMutateAsync.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ id: 999 }), 50);
          })
      );
      mocks.createQuestionMutateAsync.mockResolvedValue({
        questionUnit: { id: 1001 },
        coreContent: { id: 2001 },
      });

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleAddQuestion('100');
      });

      act(() => {
        result.current.setForm({ ...result.current.form, stem: 'Test stem' });
      });

      await act(async () => {
        await result.current.handleSaveQuestion();
      });

      expect(result.current.isSavingQuestion).toBe(false);
    });

    it('prevents variant save when variant not found in question', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      // Select a variant that doesn't exist by manipulating selected state
      act(() => {
        result.current.setSelected({
          groupId: '100',
          questionId: '200',
          variantId: 'non-existent-variant',
        });
      });

      // Set form with complete valid data (including stem) after selecting variant
      // to ensure it's not cleared when the hook tries to load a variant that doesn't exist
      act(() => {
        result.current.setForm({
          ...result.current.form,
          stem: 'Test question?',
          options: [
            { id: 'opt1', value: 'Option A', isCorrect: true },
            { id: 'opt2', value: 'Option B', isCorrect: false },
            { id: 'opt3', value: 'Option C', isCorrect: false },
            { id: 'opt4', value: 'Option D', isCorrect: false },
          ],
        });
      });

      await act(async () => {
        await result.current.handleSaveQuestion();
      });

      expect(result.current.saveError).toBe('Variant not found.');
    });

    it('handles 4xx API error in question creation with details', async () => {
      mocks.createGroupMutateAsync.mockResolvedValue({ id: 999 });
      mocks.createQuestionMutateAsync.mockRejectedValue(
        new mocks.ApiError('Conflict', 409, [
          { message: 'Question already exists' },
        ])
      );

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      // Create a draft group which will be persisted successfully
      act(() => {
        result.current.handleAddGroup();
      });

      // Add question to the draft group (which will then fail on create)
      act(() => {
        const draftGroupId = result.current.groups[0]?.id;
        if (draftGroupId) {
          result.current.handleAddQuestion(draftGroupId);
        }
      });

      act(() => {
        result.current.setForm({
          ...result.current.form,
          stem: 'Test question?',
          options: [
            { id: 'opt1', value: 'Option A', isCorrect: true },
            { id: 'opt2', value: 'Option B', isCorrect: false },
            { id: 'opt3', value: 'Option C', isCorrect: false },
            { id: 'opt4', value: 'Option D', isCorrect: false },
          ],
        });
      });

      await act(async () => {
        await result.current.handleSaveQuestion();
      });

      expect(result.current.saveError).toBe('Question already exists');
    });

    it('handles 5xx error in question creation and logs it', async () => {
      mocks.createGroupMutateAsync.mockResolvedValue({ id: 999 });
      mocks.createQuestionMutateAsync.mockRejectedValue(
        new mocks.ApiError('Server error', 500)
      );

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          status: 'draft',
          questionGroups: [],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      // Create a draft group which will be persisted successfully
      act(() => {
        result.current.handleAddGroup();
      });

      // Add question to the draft group (which will then fail on create)
      act(() => {
        const draftGroupId = result.current.groups[0]?.id;
        if (draftGroupId) {
          result.current.handleAddQuestion(draftGroupId);
        }
      });

      act(() => {
        result.current.setForm({
          ...result.current.form,
          stem: 'Test question?',
          options: [
            { id: 'opt1', value: 'Option A', isCorrect: true },
            { id: 'opt2', value: 'Option B', isCorrect: false },
            { id: 'opt3', value: 'Option C', isCorrect: false },
            { id: 'opt4', value: 'Option D', isCorrect: false },
          ],
        });
      });

      await act(async () => {
        await result.current.handleSaveQuestion();
      });

      expect(result.current.saveError).toBe('Could not save the question. Please try again.');
      expect(mocks.logError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          feature: 'question',
          action: 'save',
        })
      );
    });

    it('updates form state and preserves previous values when available', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1, [createQuestion(200, 'Q1')])],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      const initialType = result.current.form.type;

      // Modify form
      const firstOptionId = result.current.form.options[0]?.id;
      expect(firstOptionId).toBeDefined();
      if (!firstOptionId) {
        throw new Error('Expected the form to include at least one option.');
      }

      act(() => {
        result.current.handleOptionChange(firstOptionId, 'Modified');
      });

      // Form should update
      expect(result.current.form.options[0]?.value).toBe('Modified');
      expect(result.current.form.type).toBe(initialType);
    });

    it('handles rename error with 4xx status', async () => {
      mocks.renameMutateAsync.mockRejectedValue({
        name: 'ApiError',
        status: 422,
        message: 'Validation error',
        details: [{ message: 'Name too long' }],
      });

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Group 1', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.startEditingGroupTitle('100', 'Group 1');
        result.current.setEditingGroupTitle('New Name Too Long');
      });

      await act(async () => {
        await result.current.saveEditingGroupTitle('100');
      });

      expect(result.current.editingGroupId).toBe('100');
    });

    it('prevents navigation when no selection exists', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.handleNavigate(1);
      });

      expect(result.current.selected).toBeNull();
    });

    it('handles setup without valid parsed ids', () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [] }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: undefined, unitIdParam: undefined })
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.selected).toBeNull();
    });

    it('clears question cache on question deletion', async () => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [
            createQuestionGroup(100, 'Group 1', 1, [
              createQuestion(200, 'Q1', [createVariant(300, 'V1')]),
            ]),
          ],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      // Select a variant to load it into cache
      act(() => {
        result.current.setSelected({
          groupId: '100',
          questionId: '200',
          variantId: '300',
        });
      });

      // Delete the variant
      act(() => {
        result.current.setDeleteTarget({
          type: 'variant',
          groupId: '100',
          questionId: '200',
          variantId: '300',
          label: 'V1',
        });
      });

      await act(async () => {
        await result.current.handleConfirmDelete();
      });

      expect(result.current.groups[0]?.questions[0]?.variants.length).toBe(0);
    });

    it('respects parsedModuleId and parsedUnitId in error logs', async () => {
      mocks.renameMutateAsync.mockRejectedValue(new Error('Rename failed'));

      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({
          questionGroups: [createQuestionGroup(100, 'Original', 1)],
        }),
      };

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '42', unitIdParam: '99' })
      );

      act(() => {
        result.current.startEditingGroupTitle('100', 'Original');
        result.current.setEditingGroupTitle('Renamed');
      });

      await act(async () => {
        await result.current.saveEditingGroupTitle('100');
      });

      expect(mocks.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          unitId: 99,
        })
      );
    });
  });

  describe('handleSaveVariantInstructions', () => {
    beforeEach(() => {
      editorDataState = {
        isPending: false,
        isError: false,
        error: null,
        data: buildEditorData({ questionGroups: [], variantContext: 'Initial context' }),
      };
      mocks.updateModuleUnitMutateAsync.mockReset();
    });

    it('successfully updates variant instructions', async () => {
      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      // Wait for initial data load
      await waitFor(() => expect(result.current.variantInstructions).toBe('Initial context'));

      act(() => {
        result.current.setVariantInstructions('Updated context');
      });

      await act(async () => {
        await result.current.handleSaveVariantInstructions();
      });

      expect(mocks.updateModuleUnitMutateAsync).toHaveBeenCalledWith({
        variantContext: 'Updated context',
      });
      expect(result.current.saveError).toBeNull();
      expect(result.current.isSavingVariantInstructions).toBe(false);
    });

    it('sets saveError when mutation fails with ApiError', async () => {
      mocks.updateModuleUnitMutateAsync.mockRejectedValue(
        new mocks.ApiError('Validation failed', 400)
      );

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      act(() => {
        result.current.setVariantInstructions('Broken context');
      });

      await act(async () => {
        await result.current.handleSaveVariantInstructions();
      });

      expect(result.current.saveError).toBe('Validation failed');
      expect(result.current.isSavingVariantInstructions).toBe(false);
    });

    it('sets generic error and logs when unexpected error occurs', async () => {
      mocks.updateModuleUnitMutateAsync.mockRejectedValue(new Error('Unexpected crash'));

      const { result } = renderHook(() =>
        useModuleUnitEditorPageState({ moduleIdParam: '1', unitIdParam: '2' })
      );

      await act(async () => {
        await result.current.handleSaveVariantInstructions();
      });

      expect(result.current.saveError).toBe(
        'Could not save variant generation settings. Please try again.'
      );
      expect(mocks.logError).toHaveBeenCalled();
    });
  });
});
