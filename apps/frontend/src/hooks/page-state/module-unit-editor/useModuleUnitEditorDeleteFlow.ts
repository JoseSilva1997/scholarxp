// --- Purpose: Handles module-unit-editor delete state orchestration ---
// This hook manages all the logic for deleting groups, questions, and variants in the Module Unit Editor.
// It keeps the parent hook focused on composition and UI, while all delete-related logic lives here for clarity and maintainability.
import { useMemo, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { QuestionForm } from '../../../components/ModuleUnitEditor/question-types/QuestionTypeRegistry';
import type { DeleteCopy, DeleteTarget, Question, QuestionGroup, SelectionState } from './helpers/types';
import {
  computeFallbackSelection,
  removeQuestionFromGroup,
  removeQuestionGroup,
  removeVariantFromQuestion,
} from './helpers/stateTransforms';
import { toPersistedId } from './helpers/idParsers';
import { logModuleUnitEditorError } from './helpers/errorHandling';

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

// --- Types: define local types for clarity and maintainability ---
// Types are kept close to the hook so it's easy to see what parameters and state are expected.
// This helps future maintainers understand the contract of the hook at a glance.
type UseModuleUnitEditorDeleteFlowParams = {
  parsedModuleId: number | null;
  parsedUnitId: number | null;
  isUnitLive: boolean;
  deleteTarget: DeleteTarget | null;
  groupsRef: RefObject<QuestionGroup[]>;
  selectedRef: RefObject<SelectionState | null>;
  expandedGroupsRef: RefObject<Set<string>>;
  editingGroupIdRef: RefObject<string | null>;
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

// --- Main Hook: useModuleUnitEditorDeleteFlow ---
// This hook manages all delete flows for the Module Unit Editor page.
// It handles confirmation, mutation, error handling, and state updates for deletes.
//
// Sections below are separated by comments to make navigation and understanding easier.
// Comments explain why things are done, not just what is happening.
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
  // --- Delete Copy: builds the UI copy for delete/archiving dialogs based on context ---
  // This ensures the user always sees the right message for what they're deleting and whether the unit is live.
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

  // --- Error Handling: centralizes error reporting for all delete mutations ---
  // This keeps error handling DRY and ensures all errors are logged and surfaced to the user in a safe way.
  const handleDeleteMutationError = (
    err: unknown,
    message: string,
    feature: 'question-group' | 'question' | 'variant',
  ) => {
    setDeleteError(message);
    logModuleUnitEditorError(err, feature, 'delete', parsedUnitId);
  };

  // --- Delete Group: handles deleting a group and all its questions/variants ---
  // This ensures all related state and caches are cleaned up, and the UI updates correctly.
  const deleteGroupTarget = async (
    target: Extract<DeleteTarget, { type: 'group' }>,
    currentSelection: SelectionState | null,
    currentExpanded: Set<string>,
  ): Promise<DeleteResult | null> => {
    const numericId = toPersistedId(target.groupId);
    if (numericId !== null) {
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

  // --- Delete Question: handles deleting a question and all its variants ---
  // This ensures all related state and caches are cleaned up, and the UI updates correctly.
  const deleteQuestionTarget = async (
    target: Extract<DeleteTarget, { type: 'question' }>,
    currentSelection: SelectionState | null,
    currentExpanded: Set<string>,
  ): Promise<DeleteResult | null> => {
    const numericId = toPersistedId(target.questionId);
    if (numericId !== null) {
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

  // --- Delete Variant: handles deleting a single variant from a question ---
  // This ensures all related state and caches are cleaned up, and the UI updates correctly.
  const deleteVariantTarget = async (
    target: Extract<DeleteTarget, { type: 'variant' }>,
    currentSelection: SelectionState | null,
    currentExpanded: Set<string>,
  ): Promise<DeleteResult | null> => {
    const numericQuestionId = toPersistedId(target.questionId);
    const numericVariantId = toPersistedId(target.variantId);
    if (numericQuestionId !== null && numericVariantId !== null) {
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

  // --- Confirm Delete: orchestrates the full delete flow when the user confirms ---
  // This freezes selection/expansion at confirmation time so fallback is deterministic, and updates all state accordingly.
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

  // --- Public API: expose delete copy and confirm handler to the parent/page ---
  // This keeps the parent focused on UI and lets this hook handle all delete logic.
  return {
    deleteCopy,
    handleConfirmDelete,
  };
}
