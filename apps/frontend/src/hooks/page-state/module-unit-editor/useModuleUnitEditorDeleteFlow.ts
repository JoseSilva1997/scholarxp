// Handles module-unit-editor delete state orchestration so the parent hook can stay focused on composition.
import { useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { logError } from '../../../utils/logger';
import type { QuestionForm } from '../../../components/question-types/QuestionTypeRegistry';
import type { DeleteCopy, DeleteTarget, Question, QuestionGroup, SelectionState } from './types';

type DeleteResult = {
  nextGroups: QuestionGroup[];
  nextSelected: SelectionState | null;
  nextExpanded: Set<string>;
};

type DeleteQuestionGroupMutation = {
  mutateAsync: (questionGroupId: number) => Promise<unknown>;
};

type DeleteQuestionMutation = {
  mutateAsync: (questionId: number) => Promise<unknown>;
};

type DeleteVariantMutation = {
  mutateAsync: (input: { questionId: number; variantId: number }) => Promise<unknown>;
};

type UseModuleUnitEditorDeleteFlowParams = {
  parsedModuleId: number | null;
  parsedUnitId: number | null;
  isUnitLive: boolean;
  deleteTarget: DeleteTarget | null;
  groupsRef: MutableRefObject<QuestionGroup[]>;
  selectedRef: MutableRefObject<SelectionState | null>;
  expandedGroupsRef: MutableRefObject<Set<string>>;
  editingGroupIdRef: MutableRefObject<string | null>;
  setDeleteTarget: Dispatch<SetStateAction<DeleteTarget | null>>;
  setDeleteError: Dispatch<SetStateAction<string | null>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
  setIsDeleting: Dispatch<SetStateAction<boolean>>;
  setEditingGroupId: Dispatch<SetStateAction<string | null>>;
  setGroups: Dispatch<SetStateAction<QuestionGroup[]>>;
  setExpandedGroups: Dispatch<SetStateAction<Set<string>>>;
  setSelected: Dispatch<SetStateAction<SelectionState | null>>;
  setForm: Dispatch<SetStateAction<QuestionForm>>;
  buildInitialForm: () => QuestionForm;
  deleteQuestionGroupMutation: DeleteQuestionGroupMutation;
  deleteQuestionMutation: DeleteQuestionMutation;
  deleteVariantMutation: DeleteVariantMutation;
  clearQuestionCaches: (question: Question) => void;
  clearVariantCache: (questionId: string, variantId: string) => void;
};

const removeQuestionGroup = (groups: QuestionGroup[], groupId: string) =>
  groups.filter((group) => group.id !== groupId);

const removeQuestionFromGroup = (
  groups: QuestionGroup[],
  groupId: string,
  questionId: string,
) =>
  groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          questions: group.questions.filter((question) => question.id !== questionId),
        }
      : group,
  );

const removeVariantFromQuestion = (
  groups: QuestionGroup[],
  groupId: string,
  questionId: string,
  variantId: string,
) =>
  groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          questions: group.questions.map((question) =>
            question.id === questionId
              ? {
                  ...question,
                  variants: question.variants.filter((variant) => variant.id !== variantId),
                }
              : question,
          ),
        }
      : group,
  );

const computeFallbackSelection = (nextGroups: QuestionGroup[]): SelectionState | null => {
  // Fall back to the first remaining question to keep the editor focused on a valid target.
  for (const group of nextGroups) {
    const firstQuestion = group.questions[0];
    if (firstQuestion) {
      return { groupId: group.id, questionId: firstQuestion.id, variantId: null };
    }
  }
  return null;
};

export function useModuleUnitEditorDeleteFlow({
  parsedModuleId,
  parsedUnitId,
  isUnitLive,
  deleteTarget,
  groupsRef,
  selectedRef,
  expandedGroupsRef,
  editingGroupIdRef,
  setDeleteTarget,
  setDeleteError,
  setSaveError,
  setIsDeleting,
  setEditingGroupId,
  setGroups,
  setExpandedGroups,
  setSelected,
  setForm,
  buildInitialForm,
  deleteQuestionGroupMutation,
  deleteQuestionMutation,
  deleteVariantMutation,
  clearQuestionCaches,
  clearVariantCache,
}: UseModuleUnitEditorDeleteFlowParams) {
  const deleteCopy = useMemo<DeleteCopy>(() => {
    if (!deleteTarget) {
      return { title: '', body: '', confirmLabel: 'Delete' };
    }

    const actionLabel = isUnitLive ? 'Archive' : 'Delete';

    if (deleteTarget.type === 'group') {
      return {
        title: `${actionLabel} group "${deleteTarget.title}"?`,
        body: isUnitLive
          ? 'Archiving this group removes it from future student practice in this live unit, including all questions and variants in the group.'
          : 'Deleting this group will remove all core questions and variants inside it. This keeps the unit list tidy but cannot be undone here.',
        confirmLabel: `${actionLabel} group`,
      };
    }

    if (deleteTarget.type === 'question') {
      return {
        title: `${actionLabel} question "${deleteTarget.title}"?`,
        body: isUnitLive
          ? 'Archiving this question removes it and its variants from future student practice in this live unit.'
          : 'Deleting this question will also remove every variant tied to it. Students will no longer see this question in practice sets.',
        confirmLabel: `${actionLabel} question`,
      };
    }

    return {
      title: `${actionLabel} variant "${deleteTarget.label}"?`,
      body: isUnitLive
        ? 'Archiving this variant removes it from future student practice in this live unit. Other variants and the core question stay intact.'
        : 'Deleting this variant removes it from the question set. Other variants and the core question stay intact.',
      confirmLabel: `${actionLabel} variant`,
    };
  }, [deleteTarget, isUnitLive]);

  const handleDeleteMutationError = (
    err: unknown,
    message: string,
    feature: 'question-group' | 'question' | 'variant',
  ) => {
    setDeleteError(message);
    logError(err, { feature, action: 'delete', unitId: parsedUnitId });
  };

  const deleteGroupTarget = async (
    target: Extract<DeleteTarget, { type: 'group' }>,
    currentSelection: SelectionState | null,
    currentExpanded: Set<string>,
  ): Promise<DeleteResult | null> => {
    const numericId = Number(target.groupId);
    if (Number.isFinite(numericId)) {
      try {
        await deleteQuestionGroupMutation.mutateAsync(numericId);
      } catch (err) {
        handleDeleteMutationError(
          err,
          'Could not delete this group. Please try again.',
          'question-group',
        );
        return null;
      }
    }

    const currentGroups = groupsRef.current;
    const removedGroup = currentGroups.find((group) => group.id === target.groupId);
    removedGroup?.questions.forEach(clearQuestionCaches);
    const nextExpanded = new Set(currentExpanded);
    nextExpanded.delete(target.groupId);

    if (editingGroupIdRef.current === target.groupId) {
      setEditingGroupId(null);
    }

    return {
      nextGroups: removeQuestionGroup(currentGroups, target.groupId),
      nextSelected:
        currentSelection?.groupId === target.groupId ? null : currentSelection,
      nextExpanded,
    };
  };

  const deleteQuestionTarget = async (
    target: Extract<DeleteTarget, { type: 'question' }>,
    currentSelection: SelectionState | null,
    currentExpanded: Set<string>,
  ): Promise<DeleteResult | null> => {
    const numericId = Number(target.questionId);
    if (Number.isFinite(numericId)) {
      try {
        await deleteQuestionMutation.mutateAsync(numericId);
      } catch (err) {
        handleDeleteMutationError(
          err,
          'Could not delete this question. Please try again.',
          'question',
        );
        return null;
      }
    }

    const currentGroups = groupsRef.current;
    const targetGroup = currentGroups.find((group) => group.id === target.groupId);
    const targetQuestion = targetGroup?.questions.find(
      (question) => question.id === target.questionId,
    );
    if (targetQuestion) {
      clearQuestionCaches(targetQuestion);
    }

    const nextGroups = removeQuestionFromGroup(
      currentGroups,
      target.groupId,
      target.questionId,
    );
    let nextSelected = currentSelection;
    if (
      currentSelection?.groupId === target.groupId &&
      currentSelection.questionId === target.questionId
    ) {
      const updatedGroup = nextGroups.find((group) => group.id === target.groupId);
      const fallbackQuestion = updatedGroup?.questions[0];
      nextSelected = fallbackQuestion
        ? { groupId: target.groupId, questionId: fallbackQuestion.id, variantId: null }
        : null;
    }

    return {
      nextGroups,
      nextSelected,
      nextExpanded: new Set(currentExpanded),
    };
  };

  const deleteVariantTarget = async (
    target: Extract<DeleteTarget, { type: 'variant' }>,
    currentSelection: SelectionState | null,
    currentExpanded: Set<string>,
  ): Promise<DeleteResult | null> => {
    const numericQuestionId = Number(target.questionId);
    const numericVariantId = Number(target.variantId);
    if (Number.isFinite(numericQuestionId) && Number.isFinite(numericVariantId)) {
      try {
        await deleteVariantMutation.mutateAsync({
          questionId: numericQuestionId,
          variantId: numericVariantId,
        });
      } catch (err) {
        handleDeleteMutationError(
          err,
          'Could not delete this variant. Please try again.',
          'variant',
        );
        return null;
      }
    }

    clearVariantCache(target.questionId, target.variantId);
    const currentGroups = groupsRef.current;
    const nextSelected =
      currentSelection?.groupId === target.groupId &&
      currentSelection.questionId === target.questionId &&
      currentSelection.variantId === target.variantId
        ? {
            groupId: target.groupId,
            questionId: target.questionId,
            variantId: null,
          }
        : currentSelection;

    return {
      nextGroups: removeVariantFromQuestion(
        currentGroups,
        target.groupId,
        target.questionId,
        target.variantId,
      ),
      nextSelected,
      nextExpanded: new Set(currentExpanded),
    };
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !parsedModuleId || !parsedUnitId) return;

    setIsDeleting(true);
    setDeleteError(null);

    // Freeze selection/expansion at confirmation time so post-delete fallback is deterministic.
    const currentExpanded = new Set(expandedGroupsRef.current);
    const currentSelection = selectedRef.current;
    const deleteResult =
      deleteTarget.type === 'group'
        ? await deleteGroupTarget(deleteTarget, currentSelection, currentExpanded)
        : deleteTarget.type === 'question'
          ? await deleteQuestionTarget(deleteTarget, currentSelection, currentExpanded)
          : await deleteVariantTarget(deleteTarget, currentSelection, currentExpanded);
    if (!deleteResult) {
      setIsDeleting(false);
      return;
    }

    const resolvedSelection =
      deleteResult.nextSelected ?? computeFallbackSelection(deleteResult.nextGroups);
    setGroups(deleteResult.nextGroups);
    setExpandedGroups(deleteResult.nextExpanded);
    setSelected(resolvedSelection);

    if (!resolvedSelection) {
      setForm(buildInitialForm());
    }

    setDeleteTarget(null);
    setSaveError(null);
    setIsDeleting(false);
  };

  return {
    deleteCopy,
    handleConfirmDelete,
  };
}
