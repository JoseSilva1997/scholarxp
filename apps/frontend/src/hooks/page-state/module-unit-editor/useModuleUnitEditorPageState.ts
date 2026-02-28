// Encapsulates ModuleUnitEditor route orchestration so the route can stay focused on rendering.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  CreateQuestionPayload,
  CreateVariantPayload,
  QuestionSource,
  UpdateQuestionContentPayload,
} from '@scholarxp/api-contracts';
import { getModuleUnitGroupName } from '@scholarxp/api-contracts';
import { ApiError } from '../../../api/client';
import {
  emptyMcqTemplate,
  DEFAULT_QUESTION_TYPE,
  TrueFalseQuestionSchema,
} from '@scholarxp/question-type-dtos';
import { logError } from '../../../utils/logger';
import type { ModuleUnitEditorGroup } from '../../../types/module';
import {
  QUESTION_TYPE_CONFIGS,
  makeId,
  normalizeQuestionType,
} from '../../../components/question-types/QuestionTypeRegistry';
import type {
  QuestionType,
  QuestionForm,
} from '../../../components/question-types/QuestionTypeRegistry';
import {
  useCreateQuestionGroupMutation,
  useCreateQuestionMutation,
  useCreateVariantMutation,
  useDeleteQuestionGroupMutation,
  useDeleteQuestionMutation,
  useDeleteVariantMutation,
  useModuleUnitEditorDataQuery,
  useUpdateModuleUnitMutation,
  useUpdateQuestionContentMutation,
  useUpdateQuestionGroupNameMutation,
} from '../../queries/useModuleUnitEditorQueries';
import type {
  DeleteTarget,
  Question,
  QuestionContent,
  QuestionGroup,
  SelectionState,
  Variant,
} from './types';
import { useModuleUnitEditorDeleteFlow } from './useModuleUnitEditorDeleteFlow';

// ===== Types =====
type UseModuleUnitEditorPageStateParams = {
  moduleIdParam: string | undefined;
  unitIdParam: string | undefined;
  initialQuestionIdParam?: string;
};

// ===== Constants and Labels =====
const SOURCE_HUMAN: QuestionSource = 'human';
const SOURCE_AI: QuestionSource = 'ai-generated';

const formatQuestionLabel = (index: number, isDraft?: boolean) =>
  `Question ${index + 1}${isDraft ? ' (draft)' : ''}`;

const formatVariantLabel = (index: number, isDraft?: boolean) =>
  `Variant ${index + 1}${isDraft ? ' (draft)' : ''}`;

const deriveNextGroupSortOrder = (existingGroups: QuestionGroup[]) =>
  // Keep order independent from labels so renames do not affect persisted sequencing.
  existingGroups.reduce((maxValue, group) => Math.max(maxValue, group.sortOrder), 0) + 1;

const normalizeSource = (value?: string | null): QuestionSource =>
  value === SOURCE_AI ? SOURCE_AI : SOURCE_HUMAN;

// ===== Pure State Helpers =====
// Pure state transformers keep complex updates testable and reduce nested setState logic.
type QuestionUpdater = (question: Question) => Question;

const updateGroupById = (
  groups: QuestionGroup[],
  groupId: string,
  updater: (group: QuestionGroup) => QuestionGroup,
) => groups.map((group) => (group.id === groupId ? updater(group) : group));

const updateQuestionByPredicate = (
  groups: QuestionGroup[],
  groupId: string,
  predicate: (question: Question) => boolean,
  updater: QuestionUpdater,
) =>
  updateGroupById(groups, groupId, (group) => ({
    ...group,
    questions: group.questions.map((question) =>
      predicate(question) ? updater(question) : question,
    ),
  }));

const updateQuestionByIds = (
  groups: QuestionGroup[],
  groupId: string,
  questionIds: string[],
  updater: QuestionUpdater,
) => {
  const idSet = new Set(questionIds);
  return updateQuestionByPredicate(groups, groupId, (question) => idSet.has(question.id), updater);
};

const updateVariantById = (
  question: Question,
  variantId: string,
  updater: (variant: Variant) => Variant,
): Question => ({
  ...question,
  variants: question.variants.map((variant) =>
    variant.id === variantId ? updater(variant) : variant,
  ),
});

const replaceDraftGroupId = (
  groups: QuestionGroup[],
  targetGroupId: string,
  persistedGroupId: string,
) =>
  updateGroupById(groups, targetGroupId, (group) => ({ ...group, id: persistedGroupId }));

const appendDraftQuestionToGroup = (
  groups: QuestionGroup[],
  groupId: string,
  question: Question,
) =>
  updateGroupById(groups, groupId, (group) => ({
    ...group,
    questions: [...group.questions, question],
  }));

const appendDraftVariantToQuestion = (
  groups: QuestionGroup[],
  groupId: string,
  questionId: string,
  variant: Variant,
) =>
  updateQuestionByPredicate(
    groups,
    groupId,
    (question) => question.id === questionId,
    (question) => ({ ...question, variants: [...question.variants, variant] }),
  );

const mapEditorGroupsToState = (
  groups: ModuleUnitEditorGroup[] | undefined,
): QuestionGroup[] =>
  (groups ?? []).map((group) => ({
    id: String(group.id),
    title: group.name,
    sortOrder: group.sortOrder,
    questions: (group.questions ?? []).map((question) => ({
      id: String(question.id),
      title: question.title,
      type: normalizeQuestionType(question.type),
      variants: (question.variants ?? []).map((variant) => ({
        id: String(variant.id),
        label: variant.variantLabel,
        content: variant.content
          ? {
              id: String(variant.content.id),
              questionUnitId: String(variant.content.questionUnitId ?? question.id),
              questionStem: variant.content.questionStem,
              questionData: variant.content.questionData,
              type: normalizeQuestionType(variant.content.type),
              hint: variant.content.hint ?? null,
              difficultyScore: variant.content.difficultyScore,
              source: normalizeSource(variant.content.source),
              isArchived: Boolean(variant.content.isArchived),
            }
          : undefined,
      })),
      coreContent: question.coreContent
        ? {
            id: String(question.coreContent.id),
            questionUnitId: String(question.coreContent.questionUnitId),
            questionStem: question.coreContent.questionStem,
            questionData: question.coreContent.questionData,
            type: normalizeQuestionType(question.coreContent.type),
            hint: question.coreContent.hint ?? null,
            difficultyScore: question.coreContent.difficultyScore,
            source: normalizeSource(question.coreContent.source),
            isArchived: Boolean(question.coreContent.isArchived),
          }
        : undefined,
    })),
  }));

export function useModuleUnitEditorPageState({
  moduleIdParam,
  unitIdParam,
  initialQuestionIdParam,
}: UseModuleUnitEditorPageStateParams) {
  // ===== Route Scope and Server State =====
  // Route scope parsing keeps downstream query/mutation hooks guarded by valid numeric ids.
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
  const updateModuleUnitMutation = useUpdateModuleUnitMutation(editorScope);

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

  // ===== Local Editor State =====
  const [unitTitle, setUnitTitle] = useState('');
  const [variantInstructions, setVariantInstructions] = useState('');
  const [groups, setGroups] = useState<QuestionGroup[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [isSavingVariant, setIsSavingVariant] = useState(false);
  const [isSavingVariantInstructions, setIsSavingVariantInstructions] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Keep delete affordances aligned with live-unit archive behavior.
  const [isUnitLive, setIsUnitLive] = useState(false);
  const [selected, setSelected] = useState<SelectionState | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupTitle, setEditingGroupTitle] = useState('');
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);

  // Keep latest snapshots available to async handlers so state math is based on fresh data.
  const groupsRef = useRef<QuestionGroup[]>(groups);
  const selectedRef = useRef<SelectionState | null>(selected);
  const expandedGroupsRef = useRef<Set<string>>(expandedGroups);
  const editingGroupIdRef = useRef<string | null>(editingGroupId);

  const editingGroupInputRef = useRef<HTMLInputElement | null>(null);
  // Cache per-question inputs by type so toggling type does not destroy in-progress edits.
  const questionTypeCacheRef = useRef<
    Map<
      string,
      Partial<
        Record<QuestionType, { options: QuestionForm['options']; explanations: string[] }>
      >
    >
  >(new Map());

  const mcqOptionSlots = useMemo(() => emptyMcqTemplate().options.length, []);

  const buildInitialForm = useCallback(
    (): QuestionForm => ({
      stem: '',
      type: DEFAULT_QUESTION_TYPE,
      options: Array.from({ length: mcqOptionSlots }, () => ({
        id: makeId(),
        value: '',
        isCorrect: false,
      })),
      explanations: Array.from({ length: mcqOptionSlots }, () => ''),
      hint: '',
    }),
    [mcqOptionSlots],
  );

  const [form, setForm] = useState<QuestionForm>(buildInitialForm);

  useEffect(() => {
    // Clear stale delete errors when target changes so modal feedback reflects the current action.
    setDeleteError(null);
  }, [deleteTarget]);

  useEffect(() => {
    // Sync refs each render so async delete flows always read the latest editor state.
    groupsRef.current = groups;
    selectedRef.current = selected;
    expandedGroupsRef.current = expandedGroups;
    editingGroupIdRef.current = editingGroupId;
  }, [groups, selected, expandedGroups, editingGroupId]);

  const setSelectedFromUi = useCallback<
    Dispatch<SetStateAction<SelectionState | null>>
  >((value) => {
    // User-driven target changes should clear stale error banners from the previously edited item.
    setSaveError(null);
    setSelected(value);
  }, []);

  const resetOptionsForType = useCallback(
    (type: QuestionType) => QUESTION_TYPE_CONFIGS[type].getInitialOptions(mcqOptionSlots),
    [mcqOptionSlots],
  );

  const clearOtherTypesCache = useCallback(
    (cacheKey: string, savedType: QuestionType) => {
      const existing = questionTypeCacheRef.current.get(cacheKey) ?? {};
      const nextCache: Partial<
        Record<QuestionType, { options: QuestionForm['options']; explanations: string[] }>
      > = {
        [savedType]: existing[savedType],
      };

      (Object.keys(QUESTION_TYPE_CONFIGS) as QuestionType[]).forEach((type) => {
        if (type !== savedType) {
          nextCache[type] = resetOptionsForType(type);
        }
      });

      questionTypeCacheRef.current.set(cacheKey, nextCache);
    },
    [resetOptionsForType],
  );

  const loadContentIntoForm = useCallback(
    (content: QuestionContent | undefined, cacheKey: string) => {
      if (!content) {
        setForm(buildInitialForm());
        return;
      }

      const type = normalizeQuestionType(content.type);
      const baseOptions = QUESTION_TYPE_CONFIGS[type].getInitialOptions(mcqOptionSlots);
      let mergedOptions = baseOptions.options;
      let mergedExplanations = baseOptions.explanations;

      if (type === 'mcq') {
        const data = content.questionData as {
          options?: { optionText: string; explanation?: string }[];
          correctOptionIndex?: number;
        };
        const correctIndex = Number.isInteger(data?.correctOptionIndex)
          ? (data?.correctOptionIndex as number)
          : 0;

        mergedOptions = baseOptions.options.map((base, idx) => ({
          ...base,
          value: data?.options?.[idx]?.optionText ?? base.value,
          isCorrect: idx === correctIndex,
        }));
        mergedExplanations = baseOptions.explanations.map(
          (base, idx) => data?.options?.[idx]?.explanation ?? base,
        );
      } else {
        // Parse against canonical true/false schema only because legacy payloads are intentionally removed.
        const parsedTrueFalse = TrueFalseQuestionSchema.safeParse(content.questionData);
        if (parsedTrueFalse.success) {
          const trueFalseData = parsedTrueFalse.data;
          mergedOptions = baseOptions.options.map((base, idx) => ({
            ...base,
            value: idx === 0 ? 'True' : 'False',
            isCorrect:
              idx === 0
                ? trueFalseData.trueOption.isCorrect
                : trueFalseData.falseOption.isCorrect,
          }));
          mergedExplanations = baseOptions.explanations.map((base, idx) => {
            if (idx === 0) {
              return trueFalseData.trueOption.explanation ?? base;
            }
            if (idx === 1) {
              return trueFalseData.falseOption.explanation ?? base;
            }
            return base;
          });
        }
      }

      setForm({
        stem: content.questionStem,
        type,
        options: mergedOptions,
        explanations: mergedExplanations,
        hint: content.hint ?? '',
      });

      questionTypeCacheRef.current.set(cacheKey, {
        ...(questionTypeCacheRef.current.get(cacheKey) ?? {}),
        [type]: {
          options: mergedOptions,
          explanations: mergedExplanations,
        },
      });
    },
    [buildInitialForm, mcqOptionSlots],
  );

  const selectedQuestion = useMemo(() => {
    if (!selected) return null;
    const group = groups.find((g) => g.id === selected.groupId);
    if (!group) return null;
    return group.questions.find((q) => q.id === selected.questionId) ?? null;
  }, [groups, selected]);

  useEffect(() => {
    if (!selected) {
      // Reset the form when no item is selected to avoid editing stale values.
      setForm(buildInitialForm());
    }
  }, [selected, buildInitialForm]);

  const navigationItems = useMemo(() => {
    if (!selected) return [];
    const group = groups.find((g) => g.id === selected.groupId);
    const question = group?.questions.find((q) => q.id === selected.questionId);
    if (!question) return [];

    const questionIndex =
      group?.questions.findIndex((candidate) => candidate.id === question.id) ?? 0;

    return [
      {
        questionId: question.id,
        variantId: null,
        label: formatQuestionLabel(questionIndex, question.isDraft),
      },
      ...question.variants.map((variant) => ({
        questionId: question.id,
        variantId: variant.id,
        label: formatVariantLabel(
          question.variants.findIndex((candidate) => candidate.id === variant.id),
          variant.isDraft,
        ),
      })),
    ];
  }, [groups, selected]);

  const selectedIndex = useMemo(
    () =>
      navigationItems.findIndex(
        (item) =>
          item.questionId === selected?.questionId &&
          (item.variantId ?? null) === (selected?.variantId ?? null),
      ),
    [navigationItems, selected],
  );

  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex >= 0 && selectedIndex < navigationItems.length - 1;

  // ===== UI-Level Actions =====
  const handleNavigate = (direction: -1 | 1) => {
    if (selectedIndex < 0 || !selected) return;
    const nextItem = navigationItems[selectedIndex + direction];
    if (!nextItem) return;

    setSelected({
      groupId: selected.groupId,
      questionId: nextItem.questionId,
      variantId: nextItem.variantId,
    });
  };

  const activeLabel = useMemo(() => {
    if (!selectedQuestion) return null;

    const group = selected ? groups.find((g) => g.id === selected.groupId) : null;
    const questionIndex =
      group?.questions.findIndex((q) => q.id === selectedQuestion.id) ?? -1;

    if (selected?.variantId) {
      const variantIndex = selectedQuestion.variants.findIndex(
        (variant) => variant.id === selected.variantId,
      );
      if (variantIndex >= 0) {
        return formatVariantLabel(
          variantIndex,
          selectedQuestion.variants[variantIndex]?.isDraft,
        );
      }
    }

    return questionIndex >= 0
      ? formatQuestionLabel(questionIndex, selectedQuestion.isDraft)
      : selectedQuestion.title;
  }, [groups, selectedQuestion, selected]);

  const isQuestionSaved = useCallback(
    (question: Question) => !question.isDraft && Boolean(question.coreContent),
    [],
  );

  const canAddVariant = useCallback(
    (question: Question) => {
      if (!isQuestionSaved(question)) return false;
      const lastVariant = question.variants[question.variants.length - 1];
      return !lastVariant || (!lastVariant.isDraft && Boolean(lastVariant.content));
    },
    [isQuestionSaved],
  );

  const handleAddGroup = () => {
    if (isUnitLive) {
      setSaveError('This module unit is live. New groups cannot be added.');
      return;
    }

    const nextGroupSortOrder = deriveNextGroupSortOrder(groups);
    const newGroup: QuestionGroup = {
      id: makeId(),
      // Keep default label numbering monotonic even if groups are renamed later.
      title: getModuleUnitGroupName(nextGroupSortOrder),
      sortOrder: nextGroupSortOrder,
      questions: [],
    };

    setGroups((prev) => [...prev, newGroup]);
    setExpandedGroups((prev) => new Set([...prev, newGroup.id]));
    setSelected({ groupId: newGroup.id, questionId: null, variantId: null });
  };

  const handleToggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleUpdateGroupTitle = (groupId: string, newTitle: string) => {
    setGroups((prev) =>
      updateGroupById(prev, groupId, (group) => ({ ...group, title: newTitle })),
    );
  };

  const startEditingGroupTitle = (groupId: string, currentTitle: string) => {
    // Keep title edits isolated so cancel can cleanly revert to persisted/current value.
    setEditingGroupId(groupId);
    setEditingGroupTitle(currentTitle);
  };

  const cancelEditingGroupTitle = () => {
    setEditingGroupId(null);
    setEditingGroupTitle('');
    if (editingGroupInputRef.current) {
      editingGroupInputRef.current.setCustomValidity('');
    }
  };

  const saveEditingGroupTitle = async (groupId: string) => {
    const inputEl = editingGroupInputRef.current;
    if (inputEl) {
      inputEl.setCustomValidity('');
    }

    const nextTitle = editingGroupTitle.trim();
    if (!nextTitle) {
      if (inputEl) {
        inputEl.setCustomValidity('Group name cannot be empty.');
        inputEl.reportValidity();
      }
      return;
    }

    const numericGroupId = Number(groupId);
    if (!Number.isFinite(numericGroupId)) {
      // Draft groups only exist locally until first question save creates the backend group.
      handleUpdateGroupTitle(groupId, nextTitle);
      setEditingGroupId(null);
      setEditingGroupTitle('');
      return;
    }

    if (!parsedModuleId || !parsedUnitId) return;

    setRenamingGroupId(groupId);
    try {
      await renameQuestionGroupMutation.mutateAsync({
        questionGroupId: numericGroupId,
        payload: { name: nextTitle },
      });
      handleUpdateGroupTitle(groupId, nextTitle);
      setEditingGroupId(null);
      setEditingGroupTitle('');
    } catch (err) {
      if (inputEl) {
        // Surface backend-safe expected errors; keep unknown failures generic.
        const message =
          err instanceof ApiError && err.status >= 400 && err.status < 500
            ? err.message
            : 'Could not rename this group. Please try again.';
        inputEl.setCustomValidity(message);
        inputEl.reportValidity();
      }
      logError(err, {
        feature: 'question-group',
        action: 'rename',
        unitId: parsedUnitId,
      });
    } finally {
      setRenamingGroupId(null);
    }
  };

  const handleAddQuestion = (groupId: string) => {
    if (isUnitLive) {
      setSaveError('This module unit is live. New questions cannot be added.');
      return;
    }

    const group = groups.find((candidate) => candidate.id === groupId);
    const lastQuestion = group?.questions[group.questions.length - 1];

    if (lastQuestion && !isQuestionSaved(lastQuestion)) {
      const lastIndex = (group?.questions.length ?? 1) - 1;
      setSaveError(
        `Save ${formatQuestionLabel(
          lastIndex,
          lastQuestion.isDraft,
        )} before adding another question in this group.`,
      );
      return;
    }

    const draftQuestionId = `temp-${makeId()}`;
    const newQuestion: Question = {
      id: draftQuestionId,
      title: formatQuestionLabel(group?.questions.length ?? 0, true),
      type: DEFAULT_QUESTION_TYPE,
      variants: [],
      coreContent: undefined,
      isDraft: true,
    };

    setGroups((prev) => appendDraftQuestionToGroup(prev, groupId, newQuestion));

    const initialCache: Partial<
      Record<QuestionType, { options: QuestionForm['options']; explanations: string[] }>
    > = {};
    (Object.keys(QUESTION_TYPE_CONFIGS) as QuestionType[]).forEach((type) => {
      initialCache[type] = resetOptionsForType(type);
    });
    questionTypeCacheRef.current.set(draftQuestionId, initialCache);

    setExpandedGroups((prev) => new Set([...prev, groupId]));
    setSelected({ groupId, questionId: draftQuestionId, variantId: null });
    setForm(buildInitialForm());
    setSaveError(null);
  };

  const handleAddVariant = (groupId: string, questionId: string) => {
    if (isUnitLive) {
      setSaveError('This module unit is live. New variants cannot be added.');
      return;
    }

    const group = groups.find((candidate) => candidate.id === groupId);
    const question = group?.questions.find((candidate) => candidate.id === questionId);
    if (!question) return;

    if (!isQuestionSaved(question)) {
      setSaveError('Save the core question before adding variants.');
      return;
    }

    if (!canAddVariant(question)) {
      const lastVariant = question.variants[question.variants.length - 1];
      setSaveError(
        lastVariant
          ? `Save ${formatVariantLabel(
              question.variants.length - 1,
              lastVariant.isDraft,
            )} before creating another variant.`
          : 'Save the core question before creating variants.',
      );
      return;
    }

    const draftVariantId = `temp-variant-${makeId()}`;
    setGroups((prev) =>
      appendDraftVariantToQuestion(prev, groupId, questionId, {
        id: draftVariantId,
        label: formatVariantLabel(question.variants.length, true),
        isDraft: true,
      }),
    );

    setSelected({ groupId, questionId, variantId: draftVariantId });
    setForm(buildInitialForm());
    setSaveError(null);
  };

  const clearQuestionCaches = (question: Question) => {
    // Remove all cached form variants for deleted questions so no stale data leaks into new drafts.
    questionTypeCacheRef.current.delete(`${question.id}-core`);
    question.variants.forEach((variant) => {
      questionTypeCacheRef.current.delete(`${question.id}-variant-${variant.id}`);
    });
  };

  const clearVariantCache = (questionId: string, variantId: string) => {
    // Variant cache entries are scoped by question and variant ids to avoid cross-item leakage.
    questionTypeCacheRef.current.delete(`${questionId}-variant-${variantId}`);
  };

  const { deleteCopy, handleConfirmDelete } = useModuleUnitEditorDeleteFlow({
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
  });

  const setCorrectOption = (id: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option) => ({
        ...option,
        isCorrect: option.id === id,
      })),
    }));
  };

  const handleOptionChange = (id: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option) =>
        option.id === id ? { ...option, value } : option,
      ),
    }));
  };

  const handleExplanationChange = (index: number, value: string) => {
    setForm((prev) => {
      const nextExplanations = [...prev.explanations];
      nextExplanations[index] = value;
      return { ...prev, explanations: nextExplanations };
    });
  };

  const handleTypeChange = (type: QuestionType) => {
    if (!selectedQuestion || !selected) return;

    const cacheKey = selected.variantId
      ? `${selectedQuestion.id}-variant-${selected.variantId}`
      : `${selectedQuestion.id}-core`;

    questionTypeCacheRef.current.set(cacheKey, {
      ...(questionTypeCacheRef.current.get(cacheKey) ?? {}),
      [form.type]: {
        options: form.options,
        explanations: form.explanations,
      },
    });

    const cachedForTarget = questionTypeCacheRef.current.get(cacheKey)?.[type];
    const reset = resetOptionsForType(type);

    setForm((prev) => ({
      ...prev,
      type,
      options: cachedForTarget?.options ?? reset.options,
      explanations: cachedForTarget?.explanations ?? reset.explanations,
    }));
  };

  // ===== Save Flow Helpers =====
  const ensurePersistedGroupId = async (
    targetGroupId: string,
    targetGroup: QuestionGroup,
  ): Promise<number | null> => {
    const numericGroupId = Number(targetGroupId);
    if (Number.isFinite(numericGroupId)) {
      return numericGroupId;
    }

    if (!parsedUnitId) return null;
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
  };

  const persistDraftQuestionIfNeeded = async ({
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
  };

  const saveVariantContent = async ({
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
                type: createdVariant.variant.content.type,
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
                type: payload.type,
                hint: null,
                source: payload.source,
                isArchived: payload.isArchived,
              }),
              questionStem: payload.questionStem,
              questionData: payload.questionData,
              type: payload.type,
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
  };

  const saveCoreContent = async ({
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
              type: payload.type,
              hint: payload.hint ?? null,
              source: payload.source,
              isArchived: payload.isArchived,
            }),
            questionStem: payload.questionStem,
            questionData: payload.questionData,
            type: payload.type,
            hint: payload.hint ?? null,
            source: payload.source,
            isArchived: payload.isArchived,
          },
        }),
      ),
    );

    clearOtherTypesCache(`${persistedQuestionId}-core`, payload.type as QuestionType);
    return true;
  };

  // ===== Save Orchestration =====
  const handleSaveQuestion = async () => {
    if (!parsedModuleId || !parsedUnitId) return;

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
  };

  const handleSaveVariantInstructions = async () => {
    if (!parsedUnitId || !editorScope) return;

    setIsSavingVariantInstructions(true);
    setSaveError(null);

    try {
      await updateModuleUnitMutation.mutateAsync({
        variantContext: variantInstructions,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        setSaveError(err.message ?? 'Could not save variant generation settings.');
      } else {
        setSaveError('Could not save variant generation settings. Please try again.');
        logError(err, {
          feature: 'module-unit',
          action: 'save-variant-context',
          unitId: parsedUnitId,
        });
      }
    } finally {
      setIsSavingVariantInstructions(false);
    }
  };

  // ===== Effects =====
  useEffect(() => {
    // Initial load maps API responses into editor-local state with string ids for draft compatibility.
    if (!editorDataQuery.data || parsedUnitId === null) return;

    const { unit, moduleUnits } = editorDataQuery.data;
    const currentUnit = moduleUnits.find((candidate) => candidate.id === parsedUnitId);
    setIsUnitLive(currentUnit?.status === 'live');

    setUnitTitle(unit.title);
    setVariantInstructions(unit.variantContext ?? '');

    const mappedGroups = mapEditorGroupsToState(unit.questionGroups);

    setGroups(mappedGroups);
    setExpandedGroups(new Set(mappedGroups.map((group) => group.id)));

    const firstQuestion = mappedGroups[0]?.questions[0];
    // Deep-link support from module cards: focus a requested question when it exists in this unit.
    const initialQuestionSelection = initialQuestionIdParam
      ? mappedGroups
          .map((group) => ({
            groupId: group.id,
            question: group.questions.find(
              (question) => question.id === initialQuestionIdParam,
            ),
          }))
          .find((candidate) => candidate.question)
      : null;
    const selectedGroupId = initialQuestionSelection?.groupId ?? mappedGroups[0]?.id;
    const selectedQuestion = initialQuestionSelection?.question ?? firstQuestion;
    setSelected(
      selectedGroupId
        ? {
            groupId: selectedGroupId,
            questionId: selectedQuestion?.id ?? null,
            variantId: null,
          }
        : null,
    );

    if (selectedQuestion?.coreContent) {
      loadContentIntoForm(
        selectedQuestion.coreContent,
        `${selectedQuestion.id}-core`,
      );
    } else {
      setForm(buildInitialForm());
    }
  }, [
    editorDataQuery.data,
    parsedUnitId,
    initialQuestionIdParam,
    loadContentIntoForm,
    buildInitialForm,
  ]);

  useEffect(() => {
    // Selection changes rehydrate form state from either core content or selected variant content.
    if (!selected) return;

    const group = groups.find((candidate) => candidate.id === selected.groupId);
    if (!group) return;

    const question = group.questions.find(
      (candidate) => candidate.id === selected.questionId,
    );
    if (!question) return;

    const cacheKey = selected.variantId
      ? `${question.id}-variant-${selected.variantId}`
      : `${question.id}-core`;

    if (selected.variantId) {
      const variant = question.variants.find(
        (candidate) => candidate.id === selected.variantId,
      );
      loadContentIntoForm(variant?.content, cacheKey);
    } else {
      loadContentIntoForm(question.coreContent, cacheKey);
    }
  }, [groups, selected, loadContentIntoForm]);

  // ===== Public API =====
  // Public route API: UI-only route component consumes this contract and renders from it.
  return {
    parsedModuleId,
    parsedUnitId,
    isLoading,
    error,
    unitTitle,
    variantInstructions,
    setVariantInstructions,
    groups,
    expandedGroups,
    selected,
    setSelected: setSelectedFromUi,
    form,
    setForm,
    selectedQuestion,
    canGoPrev,
    canGoNext,
    activeLabel,
    deleteTarget,
    setDeleteTarget,
    deleteCopy,
    isDeleting,
    deleteError,
    setDeleteError,
    isUnitLive,
    saveError,
    isSavingQuestion,
    isSavingVariant,
    isSavingVariantInstructions,
    editingGroupId,
    editingGroupTitle,
    setEditingGroupTitle,
    renamingGroupId,
    editingGroupInputRef,
    formatQuestionLabel,
    formatVariantLabel,
    isQuestionSaved,
    canAddVariant,
    handleNavigate,
    handleToggleGroup,
    handleAddGroup,
    handleAddQuestion,
    handleAddVariant,
    startEditingGroupTitle,
    cancelEditingGroupTitle,
    saveEditingGroupTitle,
    handleOptionChange,
    handleExplanationChange,
    setCorrectOption,
    handleTypeChange,
    handleSaveQuestion,
    handleSaveVariantInstructions,
    handleConfirmDelete,
  };
}
