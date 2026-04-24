// --- Purpose: Handles module-unit-editor question save orchestration ---
// This hook manages all the logic for saving questions and variants in the Module Unit Editor.
// It keeps persistence logic isolated and testable, so the parent hook and UI stay clean and focused.
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  CreateQuestionPayload,
  CreateVariantPayload,
  QuestionSource,
  UpdateQuestionContentPayload,
} from '@scholarxp/api-contracts';
import { SOURCE_HUMAN } from '@/Authoring/ModuleUnitEditor/page-state/helpers/source';
import type { QuestionData } from '@scholarxp/question-type-dtos';
import { QUESTION_TYPE_CONFIGS } from '@/Authoring/ModuleUnitEditor/components/question-types/QuestionTypeRegistry';
import type {
  QuestionForm,
  QuestionType,
} from '@/Authoring/ModuleUnitEditor/components/question-types/QuestionTypeRegistry';
import type { Question, QuestionGroup, SelectionState } from '@/Authoring/ModuleUnitEditor/page-state/helpers/types';
import {
  replaceDraftGroupId,
  updateQuestionByIds,
  updateQuestionByPredicate,
  updateVariantById,
} from '@/Authoring/ModuleUnitEditor/page-state/helpers/stateTransforms';
import { toPersistedId } from '@/Authoring/ModuleUnitEditor/page-state/helpers/idParsers';
import {
  getQuestionSaveErrorMessage,
  isClientError,
  logModuleUnitEditorError,
} from '@/Authoring/ModuleUnitEditor/page-state/helpers/errorHandling';
import { coreCacheKey, variantCacheKey } from '@/Authoring/ModuleUnitEditor/page-state/helpers/cacheKeys';


// --- Types: define local types for clarity and maintainability ---
// Types are kept close to the hook so it's easy to see what parameters and state are expected.
// This helps future maintainers understand the contract of the hook at a glance.
type UseModuleUnitEditorSaveFlowParams = {
  parsedModuleId: number | null;
  parsedUnitId: number | null;
  selected: SelectionState | null;
  groups: QuestionGroup[];
  form: QuestionForm;
  setSaveError: Dispatch<SetStateAction<string | null>>;
  setIsSavingQuestion: Dispatch<SetStateAction<boolean>>;
  setIsSavingVariant: Dispatch<SetStateAction<boolean>>;
  setGroups: Dispatch<SetStateAction<QuestionGroup[]>>;
  setExpandedGroups: Dispatch<SetStateAction<Set<string>>>;
  setSelected: Dispatch<SetStateAction<SelectionState | null>>;
  formatQuestionLabel: (index: number, isDraft?: boolean) => string;
  formatVariantLabel: (index: number, isDraft?: boolean) => string;
  normalizeSource: (value?: string | null) => QuestionSource;
  clearOtherTypesCache: (cacheKey: string, savedType: QuestionType) => void;
  createQuestionGroupMutation: {
    mutateAsync: (input: {
      moduleUnitId: number;
      name: string;
      sortOrder: number;
    }) => Promise<{ id: number | string }>;
  };
  createQuestionMutation: {
    mutateAsync: (payload: CreateQuestionPayload) => Promise<{
      questionUnit: { id: number | string };
      coreContent: { id: number | string };
    }>;
  };
  createVariantMutation: {
    mutateAsync: (input: {
      questionId: number;
      payload: CreateVariantPayload;
    }) => Promise<{
      variant: {
        id: number | string;
        content: {
          id: number | string;
          questionUnitId?: number | string | null;
          questionStem: string;
          questionData: QuestionData;
          type: string;
          hint?: string | null;
          source?: string | null;
          isArchived?: boolean;
        };
      };
    }>;
  };
  updateQuestionContentMutation: {
    mutateAsync: (input: {
      questionId: number;
      contentId: number;
      payload: UpdateQuestionContentPayload;
    }) => Promise<unknown>;
  };
};

// --- Main Hook: useModuleUnitEditorSaveFlow ---
// This hook manages all save flows for the Module Unit Editor page.
// It handles persistence, mutation, error handling, and state updates for saves.
//
// Sections below are separated by comments to make navigation and understanding easier.
// Comments explain why things are done, not just what is happening.
export function useModuleUnitEditorSaveFlow({
  parsedModuleId,
  parsedUnitId,
  selected,
  groups,
  form,
  setSaveError,
  setIsSavingQuestion,
  setIsSavingVariant,
  setGroups,
  setExpandedGroups,
  setSelected,
  formatQuestionLabel,
  formatVariantLabel,
  normalizeSource,
  clearOtherTypesCache,
  createQuestionGroupMutation,
  createQuestionMutation,
  createVariantMutation,
  updateQuestionContentMutation,
}: UseModuleUnitEditorSaveFlowParams) {
  // --- Ensure Persisted Group ID: creates a group on the backend if needed ---
  // This lets users create questions in draft groups, and only persists the group when saving a question for the first time.
  const ensurePersistedGroupId = useCallback(
    async (targetGroupId: string, targetGroup: QuestionGroup): Promise<number | null> => {
      const numericGroupId = toPersistedId(targetGroupId);
      if (numericGroupId !== null) {
        return numericGroupId;
      }

      if (parsedUnitId === null) return null;
      try {
        // Draft groups are persisted on first save to keep authoring flow lightweight.
        const createdGroup = await createQuestionGroupMutation.mutateAsync({
          moduleUnitId: parsedUnitId,
          name: targetGroup.title,
          sortOrder: targetGroup.sortOrder,
        });
        const persistedGroupId = Number(createdGroup.id ?? NaN);
        if (!Number.isFinite(persistedGroupId)) {
          throw new Error('Invalid group id');
        }

        setGroups((prev) =>
          replaceDraftGroupId(prev, targetGroupId, String(persistedGroupId)),
        );
        setExpandedGroups(
          (prev) =>
            new Set([
              ...Array.from(prev).filter((id) => id !== targetGroupId),
              String(persistedGroupId),
            ]),
        );
        setSelected((prev) =>
          prev ? { ...prev, groupId: String(persistedGroupId) } : null,
        );

        return persistedGroupId;
      } catch (err) {
        setSaveError('Could not create question group. Please try again.');
        logModuleUnitEditorError(err, 'question-group', 'create', parsedUnitId);
        return null;
      }
    },
    [
      createQuestionGroupMutation,
      parsedUnitId,
      setExpandedGroups,
      setGroups,
      setSaveError,
      setSelected,
    ],
  );

  // --- Persist Draft Question: creates a question on the backend if it's still a draft ---
  // This ensures that draft questions are saved and assigned real IDs before saving content or variants.
  const persistDraftQuestionIfNeeded = useCallback(
    async ({
      payload,
      resolvedGroupId,
      targetQuestion,
      resolvedQuestionTitle,
      selectedVariantId,
    }: {
      payload: CreateQuestionPayload;
      resolvedGroupId: string;
      targetQuestion: Question;
      resolvedQuestionTitle: string;
      selectedVariantId: string | null;
    }): Promise<{ persistedQuestionId: string; persistedCoreContentId: string | null }> => {
      if (!targetQuestion.isDraft) {
        return {
          persistedQuestionId: targetQuestion.id,
          persistedCoreContentId: targetQuestion.coreContent?.id ?? null,
        };
      }

      const created = await createQuestionMutation.mutateAsync(payload);
      const persistedQuestionId = String(created.questionUnit.id);
      const persistedCoreContentId = String(created.coreContent.id);

      setGroups((prev) =>
        updateQuestionByPredicate(
          prev,
          resolvedGroupId,
          (question) => question.id === targetQuestion.id,
          (question) => ({
            ...question,
            id: persistedQuestionId,
            title: resolvedQuestionTitle,
            type: form.type,
            coreContent: {
              id: String(created.coreContent.id),
              questionUnitId: String(created.questionUnit.id),
              questionStem: payload.questionStem,
              questionData: payload.questionData,
              type: payload.type,
              hint: payload.hint ?? null,
              source: payload.source,
              isArchived: payload.isArchived,
            },
            isDraft: false,
          }),
        ),
      );

      setSelected((prev) =>
        prev
          ? { ...prev, questionId: persistedQuestionId, groupId: resolvedGroupId }
          : {
              groupId: resolvedGroupId,
              questionId: persistedQuestionId,
              variantId: selectedVariantId,
            },
      );

      return { persistedQuestionId, persistedCoreContentId };
    },
    [createQuestionMutation, form.type, setGroups, setSelected],
  );

  // --- Save Variant Content: handles saving a variant, either creating or updating as needed ---
  // This ensures that variants are saved correctly, and updates state and caches accordingly.
  const saveVariantContent = useCallback(
    async ({
      payload,
      resolvedGroupId,
      targetQuestion,
      selectedVariantId,
      persistedQuestionId,
    }: {
      payload: CreateQuestionPayload;
      resolvedGroupId: string;
      targetQuestion: Question;
      selectedVariantId: string;
      persistedQuestionId: string;
    }): Promise<boolean> => {
      const variant = targetQuestion.variants.find(
        (candidate) => candidate.id === selectedVariantId,
      );
      if (!variant) {
        setSaveError('Variant not found.');
        return false;
      }

      const variantIndex = targetQuestion.variants.findIndex(
        (candidate) => candidate.id === selectedVariantId,
      );
      const resolvedVariantLabel =
        variantIndex >= 0 ? formatVariantLabel(variantIndex, false) : variant.label;

      if (variant.isDraft || !variant.content) {
        const variantPayload = {
          variantLabel: resolvedVariantLabel,
          questionStem: form.stem,
          type: form.type,
          questionData: QUESTION_TYPE_CONFIGS[form.type].buildQuestionData(form),
          hint: form.hint,
          source: SOURCE_HUMAN,
          isArchived: false,
        } satisfies CreateVariantPayload;

        const createdVariant = await createVariantMutation.mutateAsync({
          questionId: Number(persistedQuestionId),
          payload: variantPayload,
        });

        setGroups((prev) =>
          updateQuestionByIds(
            prev,
            resolvedGroupId,
            [persistedQuestionId, targetQuestion.id],
            (question) =>
              updateVariantById(question, variant.id, (candidateVariant) => ({
                ...candidateVariant,
                id: String(createdVariant.variant.id),
                label: resolvedVariantLabel,
                isDraft: false,
                content: {
                  id: String(createdVariant.variant.content.id),
                  questionUnitId: String(
                    createdVariant.variant.content.questionUnitId ?? persistedQuestionId,
                  ),
                  questionStem: createdVariant.variant.content.questionStem,
                  questionData: createdVariant.variant.content.questionData,
                  type: createdVariant.variant.content.type as QuestionType,
                  hint: createdVariant.variant.content.hint ?? null,
                  source: normalizeSource(createdVariant.variant.content.source),
                  isArchived: Boolean(createdVariant.variant.content.isArchived),
                },
              })),
          ),
        );

        setSelected({
          groupId: resolvedGroupId,
          questionId: persistedQuestionId,
          variantId: String(createdVariant.variant.id),
        });
        clearOtherTypesCache(
          variantCacheKey(persistedQuestionId, String(createdVariant.variant.id)),
          payload.type as QuestionType,
        );
        return true;
      }

      const variantUpdatePayload = {
        questionStem: payload.questionStem,
        questionData: payload.questionData,
        type: payload.type,
        hint: payload.hint,
        source: payload.source,
        isArchived: payload.isArchived,
      } satisfies UpdateQuestionContentPayload;

      await updateQuestionContentMutation.mutateAsync({
        questionId: Number(persistedQuestionId),
        contentId: Number(variant.content.id),
        payload: variantUpdatePayload,
      });

      setGroups((prev) =>
        updateQuestionByIds(
          prev,
          resolvedGroupId,
          [persistedQuestionId, targetQuestion.id],
          (question) =>
            updateVariantById(question, selectedVariantId, (candidateVariant) => ({
              ...candidateVariant,
              content: {
                ...(candidateVariant.content ?? {
                  id: variant.content?.id ?? '',
                  questionUnitId: persistedQuestionId,
                  questionStem: '',
                  questionData: payload.questionData,
                  type: payload.type as QuestionType,
                  hint: null,
                  source: payload.source,
                  isArchived: payload.isArchived,
                }),
                questionStem: payload.questionStem,
                questionData: payload.questionData,
                type: payload.type as QuestionType,
                hint: payload.hint ?? null,
                source: payload.source,
                isArchived: payload.isArchived,
              },
            })),
        ),
      );

      clearOtherTypesCache(
        variantCacheKey(persistedQuestionId, selectedVariantId),
        payload.type as QuestionType,
      );
      return true;
    },
    [
      clearOtherTypesCache,
      createVariantMutation,
      form,
      formatVariantLabel,
      normalizeSource,
      setGroups,
      setSaveError,
      setSelected,
      updateQuestionContentMutation,
    ],
  );

  // --- Save Core Content: handles saving the main question content ---
  // This ensures that the core question is updated on the backend and state stays in sync.
  const saveCoreContent = useCallback(
    async ({
      payload,
      resolvedGroupId,
      targetQuestion,
      persistedQuestionId,
      persistedCoreContentId,
    }: {
      payload: CreateQuestionPayload;
      resolvedGroupId: string;
      targetQuestion: Question;
      persistedQuestionId: string;
      persistedCoreContentId: string | null;
    }): Promise<boolean> => {
      if (targetQuestion.isDraft) {
        return true;
      }

      if (!targetQuestion.coreContent || !persistedCoreContentId) {
        setSaveError('Question content missing.');
        return false;
      }

      const coreUpdatePayload = {
        questionStem: payload.questionStem,
        questionData: payload.questionData,
        type: payload.type,
        hint: payload.hint,
        source: payload.source,
        isArchived: payload.isArchived,
      } satisfies UpdateQuestionContentPayload;

      await updateQuestionContentMutation.mutateAsync({
        questionId: Number(persistedQuestionId),
        contentId: Number(persistedCoreContentId),
        payload: coreUpdatePayload,
      });

      setGroups((prev) =>
        updateQuestionByIds(
          prev,
          resolvedGroupId,
          [persistedQuestionId, targetQuestion.id],
          (question) => ({
            ...question,
            // Update the question's type when core content type changes so badge reflects the change immediately.
            type: payload.type as QuestionType,
            coreContent: {
              ...(question.coreContent ?? {
                id: persistedCoreContentId,
                questionUnitId: persistedQuestionId,
                questionStem: payload.questionStem,
                questionData: payload.questionData,
                type: payload.type as QuestionType,
                hint: payload.hint ?? null,
                source: payload.source,
                isArchived: payload.isArchived,
              }),
              questionStem: payload.questionStem,
              questionData: payload.questionData,
              type: payload.type as QuestionType,
              hint: payload.hint ?? null,
              source: payload.source,
              isArchived: payload.isArchived,
            },
          }),
        ),
      );

      clearOtherTypesCache(coreCacheKey(persistedQuestionId), payload.type as QuestionType);
      return true;
    },
    [clearOtherTypesCache, setGroups, setSaveError, updateQuestionContentMutation],
  );

  // --- Handle Save Question: orchestrates the full save flow when the user saves ---
  // This validates input, persists groups/questions/variants as needed, and updates all state accordingly.
  const handleSaveQuestion = useCallback(async () => {
    if (parsedModuleId === null || parsedUnitId === null) return;

    if (!selected) {
      setSaveError('Select a question before saving.');
      return;
    }

    const targetGroupId = selected.groupId;
    const targetGroup = groups.find((group) => group.id === targetGroupId);
    if (!targetGroup) {
      setSaveError('Pick a question group first.');
      return;
    }

    const numericGroupId = await ensurePersistedGroupId(targetGroupId, targetGroup);
    if (numericGroupId === null) return;

    const resolvedGroupId = String(numericGroupId);
    const targetQuestion = targetGroup.questions.find(
      (question) => question.id === selected.questionId,
    );
    if (!targetQuestion) {
      setSaveError('Pick a question to save.');
      return;
    }

    const questionIndex = targetGroup.questions.findIndex(
      (question) => question.id === targetQuestion.id,
    );
    const resolvedQuestionTitle = formatQuestionLabel(Math.max(questionIndex, 0), false);

    if (!form.stem.trim()) {
      setSaveError('Question stem is required.');
      return;
    }

    const validationError = QUESTION_TYPE_CONFIGS[form.type].validate(form);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const payload = {
      questionGroupId: numericGroupId,
      // Keep server title aligned with deterministic question numbering, without draft suffixes.
      title: resolvedQuestionTitle,
      questionStem: form.stem,
      type: form.type,
      questionData: QUESTION_TYPE_CONFIGS[form.type].buildQuestionData(form),
      hint: form.hint,
      source: SOURCE_HUMAN,
      isArchived: false,
    } satisfies CreateQuestionPayload;

    setIsSavingQuestion(true);
    if (selected.variantId) {
      setIsSavingVariant(true);
    }
    setSaveError(null);

    try {
      const selectedVariantId = selected.variantId;
      const { persistedQuestionId, persistedCoreContentId } =
        await persistDraftQuestionIfNeeded({
          payload,
          resolvedGroupId,
          targetQuestion,
          resolvedQuestionTitle,
          selectedVariantId,
        });

      if (selectedVariantId) {
        const didSaveVariant = await saveVariantContent({
          payload,
          resolvedGroupId,
          targetQuestion,
          selectedVariantId,
          persistedQuestionId,
        });
        if (!didSaveVariant) return;
      } else {
        const didSaveCore = await saveCoreContent({
          payload,
          resolvedGroupId,
          targetQuestion,
          persistedQuestionId,
          persistedCoreContentId,
        });
        if (!didSaveCore) return;
      }
    } catch (err) {
      // Expected validation/permission issues should remain user-actionable and quiet in telemetry.
      if (isClientError(err)) {
        setSaveError(
          getQuestionSaveErrorMessage(
            err,
            'Could not save the question. Please review your input.',
          ),
        );
      } else {
        setSaveError('Could not save the question. Please try again.');
        logModuleUnitEditorError(err, 'question', 'save', parsedUnitId);
      }
    } finally {
      setIsSavingQuestion(false);
      setIsSavingVariant(false);
    }
  }, [
    ensurePersistedGroupId,
    form,
    formatQuestionLabel,
    groups,
    parsedModuleId,
    parsedUnitId,
    persistDraftQuestionIfNeeded,
    saveCoreContent,
    saveVariantContent,
    selected,
    setIsSavingQuestion,
    setIsSavingVariant,
    setSaveError,
  ]);

  // --- Public API: expose the save handler to the parent/page ---
  // This keeps the parent focused on UI and lets this hook handle all save logic.
  return {
    handleSaveQuestion,
  };
}
