// Query/mutation helpers for module-unit editor server interactions while keeping editor UI state local.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateQuestionPayload,
  CreateVariantPayload,
  ModuleUnitEditorResponse,
  ModuleUnitGroupResponse,
  ModuleUnitResponse,
  UpdateQuestionContentPayload,
  UpdateModuleUnitQuestionGroupNamePayload,
} from '@scholarxp/api-contracts';
import {
  createModuleUnitQuestionGroup,
  deleteModuleUnitQuestionGroup,
  getModuleUnitEditor,
  getModuleUnits,
  updateModuleUnitQuestionGroupName,
} from '@/Authoring/api/modules';
import {
  createQuestionForUnit,
  createVariantForQuestion,
  deleteQuestionFromUnit,
  deleteVariantFromQuestion,
  updateQuestionContentScoped,
} from '@/Authoring/ModuleUnitEditor/api/questions';
import { queryKeys } from '@/shared/hooks/query-keys';

type ModuleUnitEditorQueryResult = {
  unit: ModuleUnitEditorResponse;
  moduleUnits: ModuleUnitResponse[];
};

type ScopedEditorIds = {
  moduleId: number;
  unitId: number;
};

// Invalidates module-unit cache after editor mutations so parent module screens reflect content changes.
function invalidateModuleUnitsCache(queryClient: ReturnType<typeof useQueryClient>, moduleId: number) {
  // Keep module-page unit metadata fresh after editor mutations (question counts/group labels can change).
  return queryClient.invalidateQueries({ queryKey: queryKeys.modules.units(moduleId) });
}

// Loads the editor document and sibling units together for navigation-aware editing.
export function useModuleUnitEditorDataQuery(moduleId: number | null, unitId: number | null) {
  return useQuery({
    queryKey:
      moduleId !== null && unitId !== null
        ? ['module-unit-editor', moduleId, unitId]
        : ['module-unit-editor', 0, 0],
    queryFn: async (): Promise<ModuleUnitEditorQueryResult> => {
      const [unit, moduleUnits] = await Promise.all([
        getModuleUnitEditor(moduleId!, unitId!),
        getModuleUnits(moduleId!),
      ]);
      return { unit, moduleUnits };
    },
    // Delay loading until route params are valid numbers.
    enabled: moduleId !== null && unitId !== null,
    staleTime: 30_000,
  });
}

// Persists a question-group rename for the current module/unit scope.
export function useUpdateQuestionGroupNameMutation(scope: ScopedEditorIds | null) {
  return useMutation({
    mutationFn: ({ questionGroupId, payload }: {
      questionGroupId: number;
      payload: UpdateModuleUnitQuestionGroupNamePayload;
    }) => {
      if (!scope) throw new Error('Missing module/unit scope for group rename.');
      return updateModuleUnitQuestionGroupName(scope.moduleId, scope.unitId, questionGroupId, payload);
    },
  });
}

// Creates a persisted question group and refreshes parent unit metadata afterward.
export function useCreateQuestionGroupMutation(scope: ScopedEditorIds | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      moduleUnitId: number;
      name: string;
      sortOrder: number;
    }): Promise<ModuleUnitGroupResponse> => {
      if (!scope) throw new Error('Missing module/unit scope for group creation.');
      return createModuleUnitQuestionGroup(scope.moduleId, scope.unitId, payload);
    },
    onSettled: async () => {
      if (!scope) return;
      await invalidateModuleUnitsCache(queryClient, scope.moduleId);
    },
  });
}

// Deletes a persisted question group and invalidates unit metadata affected by the removal.
export function useDeleteQuestionGroupMutation(scope: ScopedEditorIds | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionGroupId: number) => {
      if (!scope) throw new Error('Missing module/unit scope for group deletion.');
      return deleteModuleUnitQuestionGroup(scope.moduleId, scope.unitId, questionGroupId);
    },
    onSettled: async () => {
      if (!scope) return;
      await invalidateModuleUnitsCache(queryClient, scope.moduleId);
    },
  });
}

// Creates a persisted question in the current editor scope.
export function useCreateQuestionMutation(scope: ScopedEditorIds | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateQuestionPayload) => {
      if (!scope) throw new Error('Missing module/unit scope for question creation.');
      return createQuestionForUnit(scope.moduleId, scope.unitId, payload);
    },
    onSettled: async () => {
      if (!scope) return;
      await invalidateModuleUnitsCache(queryClient, scope.moduleId);
    },
  });
}

// Creates a persisted variant for an existing question in the current editor scope.
export function useCreateVariantMutation(scope: ScopedEditorIds | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      payload,
    }: {
      questionId: number;
      payload: CreateVariantPayload;
    }) => {
      if (!scope) throw new Error('Missing module/unit scope for variant creation.');
      return createVariantForQuestion(scope.moduleId, scope.unitId, questionId, payload);
    },
    onSettled: async () => {
      if (!scope) return;
      await invalidateModuleUnitsCache(queryClient, scope.moduleId);
    },
  });
}

// Persists content changes for a question or variant and refreshes derived editor metadata.
export function useUpdateQuestionContentMutation(scope: ScopedEditorIds | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      contentId,
      payload,
    }: {
      questionId: number;
      contentId: number;
      payload: UpdateQuestionContentPayload;
    }) => {
      if (!scope) throw new Error('Missing module/unit scope for question-content update.');
      return updateQuestionContentScoped(scope.moduleId, scope.unitId, questionId, contentId, payload);
    },
    // Invalidate the editor data cache so question badges (type) update immediately across the UI.
    onSettled: async () => {
      if (!scope) return;
      await invalidateModuleUnitsCache(queryClient, scope.moduleId);
    },
  });
}

// Deletes a persisted question through the current editor scope.
export function useDeleteQuestionMutation(scope: ScopedEditorIds | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionId: number) => {
      if (!scope) throw new Error('Missing module/unit scope for question deletion.');
      return deleteQuestionFromUnit(scope.moduleId, scope.unitId, questionId);
    },
    onSettled: async () => {
      if (!scope) return;
      await invalidateModuleUnitsCache(queryClient, scope.moduleId);
    },
  });
}

// Deletes a persisted variant while preserving the parent question.
export function useDeleteVariantMutation(scope: ScopedEditorIds | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      variantId,
    }: {
      questionId: number;
      variantId: number;
    }) => {
      if (!scope) throw new Error('Missing module/unit scope for variant deletion.');
      return deleteVariantFromQuestion(scope.moduleId, scope.unitId, questionId, variantId);
    },
    onSettled: async () => {
      if (!scope) return;
      await invalidateModuleUnitsCache(queryClient, scope.moduleId);
    },
  });
}
