// Encapsulates ModuleUnitEditor route orchestration so the route can stay focused on rendering.
import { formatQuestionLabel, formatVariantLabel } from '@/Authoring/ModuleUnitEditor/page-state/helpers/formatting';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { getModuleUnitGroupName } from '@scholarxp/api-contracts';
import { normalizeSource } from '@/Authoring/ModuleUnitEditor/page-state/helpers/source';
import {
  emptyMcqTemplate,
  DEFAULT_QUESTION_TYPE,
  TrueFalseQuestionSchema,
} from '@scholarxp/question-type-dtos';
import {
  QUESTION_TYPE_CONFIGS,
  makeId,
  normalizeQuestionType,
} from '@/Authoring/ModuleUnitEditor/components/question-types/QuestionTypeRegistry';
import type {
  QuestionType,
  QuestionForm,
} from '@/Authoring/ModuleUnitEditor/components/question-types/QuestionTypeRegistry';
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
} from '@/Authoring/ModuleUnitEditor/queries/useModuleUnitEditorQueries';
import type {
  DeleteTarget,
  Question,
  QuestionGroup,
  QuestionContent,
  SelectionState,
} from '@/Authoring/ModuleUnitEditor/page-state/helpers/types';
import { useModuleUnitEditorDeleteFlow } from '@/Authoring/ModuleUnitEditor/page-state/useModuleUnitEditorDeleteFlow';
import { useModuleUnitEditorSaveFlow } from '@/Authoring/ModuleUnitEditor/page-state/useModuleUnitEditorSaveFlow';
import {
  appendDraftQuestionToGroup,
  appendDraftVariantToQuestion,
  updateGroupById,
} from '@/Authoring/ModuleUnitEditor/page-state/helpers/stateTransforms';
import { mapEditorGroupsToState } from '@/Authoring/ModuleUnitEditor/page-state/helpers/mappers';
import { coreCacheKey, variantCacheKey } from '@/Authoring/ModuleUnitEditor/page-state/helpers/cacheKeys';
import {
  getClientSafeErrorMessage,
  logModuleUnitEditorError,
} from '@/Authoring/ModuleUnitEditor/page-state/helpers/errorHandling';
import { toPersistedId } from '@/Authoring/ModuleUnitEditor/page-state/helpers/idParsers';

// ===== Types =====
type UseModuleUnitEditorPageStateParams = {
  moduleIdParam: string | undefined;
  unitIdParam: string | undefined;
  initialQuestionIdParam?: string;
};

// Derives the next persisted sort order without coupling order to editable group labels.
const deriveNextGroupSortOrder = (existingGroups: QuestionGroup[]) =>
  existingGroups.reduce((maxValue, group) => Math.max(maxValue, group.sortOrder), 0) + 1;

// Coordinates the unit editor's route scope, local draft state, persistence flows, and selection model.
export function useModuleUnitEditorPageState({
  moduleIdParam,
  unitIdParam,
  initialQuestionIdParam,
}: UseModuleUnitEditorPageStateParams) {
  // ===== Route Scope and Server State =====
  // Parse route params and set up all server state hooks.
  // This ensures all downstream hooks are guarded by valid IDs, and keeps the logic robust against bad input.
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

  const isLoading =
    parsedModuleId !== null && parsedUnitId !== null && editorDataQuery.isPending;
  const error = editorDataQuery.isError
    ? 'Could not load this module unit. Please try again.'
    : null;

  useEffect(() => {
    if (!editorDataQuery.error || parsedUnitId === null) return;
    logModuleUnitEditorError(editorDataQuery.error, 'module-unit-editor', 'load', parsedUnitId);
  }, [editorDataQuery.error, parsedUnitId]);

  // ===== Local Editor State =====
  // All local UI state is managed here, so the page can respond to user actions and keep everything in sync.
  // This includes form state, selection, expanded/collapsed groups, and error banners.
  const [unitTitle, setUnitTitle] = useState('');
  const [groups, setGroups] = useState<QuestionGroup[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [isSavingVariant, setIsSavingVariant] = useState(false);
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

  // Builds a clean question form using the shared default type and current MCQ slot template.
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
    // This keeps the UI feedback relevant to the user's current action.
    setDeleteError(null);
  }, [deleteTarget]);

  useEffect(() => {
    // Sync refs each render so async delete flows always read the latest editor state.
    // This avoids bugs where async handlers operate on stale state.
    groupsRef.current = groups;
    selectedRef.current = selected;
    expandedGroupsRef.current = expandedGroups;
    editingGroupIdRef.current = editingGroupId;
  }, [groups, selected, expandedGroups, editingGroupId]);

  // Wraps selection changes from the UI so stale save errors are cleared with the user's new context.
  const setSelectedFromUi = useCallback<
    Dispatch<SetStateAction<SelectionState | null>>
  >((value) => {
    // When the user selects a new item, clear any old error banners so the UI feels responsive and clean.
    setSaveError(null);
    setSelected(value);
  }, []);

  // --- Helpers: cache and transform logic for question/variant forms ---
  // These helpers keep the form logic DRY and make it easy to support multiple question types.
  // Creates type-specific default option/explanation arrays through the question-type strategy registry.
  const resetOptionsForType = useCallback(
    (type: QuestionType) => QUESTION_TYPE_CONFIGS[type].getInitialOptions(mcqOptionSlots),
    [mcqOptionSlots],
  );

  // Resets cached forms for non-saved question types so old shape data cannot leak after saving.
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

  // Loads question or variant content into the form, merging with defaults and handling legacy/edge cases.
  // This ensures the editor always shows a valid, complete form for the selected item.
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

  // --- Derived Values: compute values from state for rendering or logic ---
  // These selectors make it easy for the UI to get the current question, navigation items, etc.
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
  // All UI event handlers and orchestration logic lives here.
  // This keeps the UI components simple and lets us test logic in isolation.
  // Moves between the selected core question and its variants while preserving group context.
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

  // Treats a question as saved only when it has both a persisted id and persisted core content.
  const isQuestionSaved = useCallback(
    (question: Question) => !question.isDraft && Boolean(question.coreContent),
    [],
  );

  // Permits a new variant only after the core question and latest variant are both saved.
  const canAddVariant = useCallback(
    (question: Question) => {
      if (!isQuestionSaved(question)) return false;
      const lastVariant = question.variants[question.variants.length - 1];
      return !lastVariant || (!lastVariant.isDraft && Boolean(lastVariant.content));
    },
    [isQuestionSaved],
  );

  // Adds a local draft group unless live-unit constraints block structural changes.
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

  // Toggles a group expansion entry without mutating the previous Set instance.
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

  // Updates a group title in local editor state.
  const handleUpdateGroupTitle = (groupId: string, newTitle: string) => {
    setGroups((prev) =>
      updateGroupById(prev, groupId, (group) => ({ ...group, title: newTitle })),
    );
  };

  // Starts inline group-title editing using the current title as the cancel baseline.
  const startEditingGroupTitle = (groupId: string, currentTitle: string) => {
    // Keep title edits isolated so cancel can cleanly revert to persisted/current value.
    setEditingGroupId(groupId);
    setEditingGroupTitle(currentTitle);
  };

  // Cancels inline group-title editing and clears browser validation state.
  const cancelEditingGroupTitle = () => {
    setEditingGroupId(null);
    setEditingGroupTitle('');
    if (editingGroupInputRef.current) {
      editingGroupInputRef.current.setCustomValidity('');
    }
  };

  // Saves a group title locally for draft groups or through the backend for persisted groups.
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

    const numericGroupId = toPersistedId(groupId);
    if (numericGroupId === null) {
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
        const message = getClientSafeErrorMessage(
          err,
          'Could not rename this group. Please try again.',
        );
        inputEl.setCustomValidity(message);
        inputEl.reportValidity();
      }
      logModuleUnitEditorError(err, 'question-group', 'rename', parsedUnitId);
    } finally {
      setRenamingGroupId(null);
    }
  };

  // Adds a local draft question to a group after ensuring there is no unsaved trailing question.
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

  // Adds a local draft variant to a saved question after enforcing one-unsaved-variant-at-a-time.
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

  // Clears all cached forms associated with a question before deletion removes its ids.
  const clearQuestionCaches = (question: Question) => {
    // Remove all cached form variants for deleted questions so no stale data leaks into new drafts.
    // This prevents bugs where old form state appears in new questions.
    questionTypeCacheRef.current.delete(coreCacheKey(question.id));
    question.variants.forEach((variant) => {
      questionTypeCacheRef.current.delete(variantCacheKey(question.id, variant.id));
    });
  };

  // Clears cached form state for one variant after it has been deleted.
  const clearVariantCache = (questionId: string, variantId: string) => {
    // Variant cache entries are scoped by question and variant ids to avoid cross-item leakage.
    // This keeps the form state for each variant isolated and predictable.
    questionTypeCacheRef.current.delete(variantCacheKey(questionId, variantId));
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

  // --- Form Handlers: update form state in response to user actions ---
  // These handlers keep the form state in sync with user input.

  // Clears one MCQ option slot without removing it — the backend schema requires exactly 4 options,
  // so a "delete" here means clearing text/correct state rather than removing the slot.
  const handleDeleteOption = (id: string) => {
    setForm((prev) => {
      const idx = prev.options.findIndex((opt) => opt.id === id);
      if (idx < 0) return prev;
      const nextExplanations = [...prev.explanations];
      nextExplanations[idx] = '';
      return {
        ...prev,
        options: prev.options.map((opt, i) =>
          i === idx ? { ...opt, value: '', isCorrect: false } : opt,
        ),
        explanations: nextExplanations,
      };
    });
  };

  // Marks one answer option as correct, preserving radio-button semantics in form state.
  const setCorrectOption = (id: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option) => ({
        ...option,
        isCorrect: option.id === id,
      })),
    }));
  };

  // Updates option text for the controlled question-type form.
  const handleOptionChange = (id: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option) =>
        option.id === id ? { ...option, value } : option,
      ),
    }));
  };

  // Updates explanation text by index because DTO payloads store explanations alongside options.
  const handleExplanationChange = (index: number, value: string) => {
    setForm((prev) => {
      const nextExplanations = [...prev.explanations];
      nextExplanations[index] = value;
      return { ...prev, explanations: nextExplanations };
    });
  };

  // Switches question type while caching the previous type's option/explanation state.
  const handleTypeChange = (type: QuestionType) => {
    if (!selectedQuestion || !selected) return;

    const cacheKey = selected.variantId
      ? variantCacheKey(selectedQuestion.id, selected.variantId)
      : coreCacheKey(selectedQuestion.id);

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

  // --- Save Logic: orchestrate saving questions and variants ---
  // This logic is kept in a separate hook for testability and separation of concerns.
  const { handleSaveQuestion } = useModuleUnitEditorSaveFlow({
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
  });

  // ===== Effects =====
  // Effects keep the local state in sync with server data and selection changes.
  // This ensures the editor always reflects the latest backend state and user actions.
  useEffect(() => {
    // On initial load, map API responses into editor-local state with string ids for draft compatibility.
    // This also supports deep-linking to a specific question if requested.
    if (!editorDataQuery.data || parsedUnitId === null) return;

    const { unit, moduleUnits } = editorDataQuery.data;
    const currentUnit = moduleUnits.find((candidate) => candidate.id === parsedUnitId);
    setIsUnitLive(currentUnit?.status === 'live');

    setUnitTitle(unit.title);

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
      loadContentIntoForm(selectedQuestion.coreContent, coreCacheKey(selectedQuestion.id));
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
    // When the selection changes, rehydrate form state from either core content or selected variant content.
    // This keeps the form in sync with what the user is editing.
    if (!selected) return;

    const group = groups.find((candidate) => candidate.id === selected.groupId);
    if (!group) return;

    const question = group.questions.find(
      (candidate) => candidate.id === selected.questionId,
    );
    if (!question) return;

    const cacheKey = selected.variantId
      ? variantCacheKey(question.id, selected.variantId)
      : coreCacheKey(question.id);

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
  // Everything below is returned for the route/page to use. This keeps the UI focused on rendering,
  // and lets us test and maintain all logic in one place.
  return {
    parsedModuleId,
    parsedUnitId,
    isLoading,
    error,
    unitTitle,
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
    handleDeleteOption,
    setCorrectOption,
    handleTypeChange,
    handleSaveQuestion,
    handleConfirmDelete,
  };
}
