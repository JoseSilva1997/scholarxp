// Encapsulates ModuleUnitEditor route-level server-state orchestration while keeping draft-editing UI local.
import { useEffect, useMemo } from 'react';
import { logError } from '../../utils/logger';
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
} from '../queries/useModuleUnitEditorQueries';

type UseModuleUnitEditorPageStateParams = {
  moduleIdParam: string | undefined;
  unitIdParam: string | undefined;
};

export function useModuleUnitEditorPageState({
  moduleIdParam,
  unitIdParam,
}: UseModuleUnitEditorPageStateParams) {
  const parsedModuleId = useMemo(() => {
    if (!moduleIdParam) return null;
    const value = Number(moduleIdParam);
    return Number.isFinite(value) ? value : null;
  }, [moduleIdParam]);

  const parsedUnitId = useMemo(() => {
    if (!unitIdParam) return null;
    const value = Number(unitIdParam);
    return Number.isFinite(value) ? value : null;
  }, [unitIdParam]);

  const editorScope = useMemo(
    () =>
      parsedModuleId !== null && parsedUnitId !== null
        ? { moduleId: parsedModuleId, unitId: parsedUnitId }
        : null,
    [parsedModuleId, parsedUnitId],
  );
  const editorDataQuery = useModuleUnitEditorDataQuery(parsedModuleId, parsedUnitId);
  const renameQuestionGroupMutation = useUpdateQuestionGroupNameMutation(editorScope);
  const createQuestionGroupMutation = useCreateQuestionGroupMutation(editorScope);
  const deleteQuestionGroupMutation = useDeleteQuestionGroupMutation(editorScope);
  const createQuestionMutation = useCreateQuestionMutation(editorScope);
  const createVariantMutation = useCreateVariantMutation(editorScope);
  const updateQuestionContentMutation = useUpdateQuestionContentMutation(editorScope);
  const deleteQuestionMutation = useDeleteQuestionMutation(editorScope);
  const deleteVariantMutation = useDeleteVariantMutation(editorScope);
  const isLoading =
    parsedModuleId !== null && parsedUnitId !== null && editorDataQuery.isPending;
  const error = editorDataQuery.isError
    ? 'Could not load this module unit. Please try again.'
    : null;

  useEffect(() => {
    if (!editorDataQuery.error || parsedUnitId === null) return;
    logError(editorDataQuery.error, {
      feature: 'module-unit-editor',
      action: 'load',
      unitId: parsedUnitId,
    });
  }, [editorDataQuery.error, parsedUnitId]);

  return {
    parsedModuleId,
    parsedUnitId,
    editorData: editorDataQuery.data,
    isLoading,
    error,
    renameQuestionGroupMutation,
    createQuestionGroupMutation,
    deleteQuestionGroupMutation,
    createQuestionMutation,
    createVariantMutation,
    updateQuestionContentMutation,
    deleteQuestionMutation,
    deleteVariantMutation,
  };
}

