// Handles module-unit-editor question save orchestration so persistence logic stays isolated and testable.
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  CreateQuestionPayload,
  CreateVariantPayload,
  QuestionSource,
  UpdateQuestionContentPayload,
} from '@scholarxp/api-contracts';
import type { QuestionData } from '@scholarxp/question-type-dtos';
import { ApiError } from '../../../api/client';
import { QUESTION_TYPE_CONFIGS } from '../../../components/question-types/QuestionTypeRegistry';
import type {
  QuestionForm,
  QuestionType,
} from '../../../components/question-types/QuestionTypeRegistry';
import { logError } from '../../../utils/logger';
import type { Question, QuestionGroup, SelectionState } from './types';
import {
  replaceDraftGroupId,
  updateQuestionByIds,
  updateQuestionByPredicate,
  updateVariantById,
} from './stateTransforms';

const SOURCE_HUMAN: QuestionSource = 'human';

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
  const ensurePersistedGroupId = useCallback(
    async (targetGroupId: string, targetGroup: QuestionGroup): Promise<number | null> => {
      const numericGroupId = Number(targetGroupId);
      if (Number.isFinite(numericGroupId)) {
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
        logError(err, {
          feature: 'question-group',
          action: 'create',
          unitId: parsedUnitId,
        });
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
          `${persistedQuestionId}-variant-${createdVariant.variant.id}`,
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
        `${persistedQuestionId}-variant-${selectedVariantId}`,
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

      clearOtherTypesCache(`${persistedQuestionId}-core`, payload.type as QuestionType);
      return true;
    },
    [clearOtherTypesCache, setGroups, setSaveError, updateQuestionContentMutation],
  );

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
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        const detailMessage = err.details?.[0]?.message;
        setSaveError(
          detailMessage ??
            err.message ??
            'Could not save the question. Please review your input.',
        );
      } else {
        setSaveError('Could not save the question. Please try again.');
        logError(err, { feature: 'question', action: 'save', unitId: parsedUnitId });
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

  return {
    handleSaveQuestion,
  };
}
