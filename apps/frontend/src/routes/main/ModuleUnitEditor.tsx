// Module unit authoring workspace UI for adding questions, variants, and context before wiring backend.
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArchive, FiCheck, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import { VscSparkleFilled } from "react-icons/vsc";
import { FaCirclePlus, FaCircleChevronLeft, FaCircleChevronRight } from "react-icons/fa6";
import { IconContext } from 'react-icons';
import type {
  CreateQuestionPayload,
  CreateVariantPayload,
  QuestionSource,
  UpdateQuestionContentPayload,
} from '@scholarxp/api-contracts';
import { getModuleUnitGroupName } from '@scholarxp/api-contracts';
import MainSection from '../../components/MainSection';
import {
  getModuleUnitEditor,
  getModuleUnits,
  createModuleUnitQuestionGroup,
  deleteModuleUnitQuestionGroup,
  updateModuleUnitQuestionGroupName,
} from '../../api/modules';
import { ApiError } from '../../api/client';
import {
  createQuestionForUnit,
  createVariantForQuestion,
  updateQuestionContentScoped,
  deleteQuestionFromUnit,
  deleteVariantFromQuestion,
} from '../../api/questions';
import { logError } from '../../utils/logger';
import { emptyMcqTemplate, DEFAULT_QUESTION_TYPE } from '@scholarxp/question-type-dtos';
import type { 
  ModuleUnitEditorContent, 
  ModuleUnitEditorQuestion, 
  ModuleUnitEditorGroup 
} from '../../types/module';
import { 
  QUESTION_TYPE_CONFIGS, 
  makeId,
  normalizeQuestionType,
} from '../../components/question-types/QuestionTypeRegistry';
import type { 
  QuestionType, 
  QuestionForm, 
  QuestionTypeConfig, 
} from '../../components/question-types/QuestionTypeRegistry';
import ConfirmDeleteModal from '../../components/Modals/ConfirmDeleteModal';
import styles from './ModuleUnitEditor.module.css';

// Local editor types derived from API contracts but allow local UI state (like isDraft and string IDs for temp items).
type QuestionContent = Omit<ModuleUnitEditorContent, 'id' | 'questionUnitId' | 'difficultyScore'> & {
  id: string;
  questionUnitId: string;
  // Backend owns defaulting difficulty on create, so editor drafts can omit it.
  difficultyScore?: number;
};

type Variant = {
  id: string;
  label: string;
  content?: QuestionContent;
  isDraft?: boolean;
};

type Question = Omit<ModuleUnitEditorQuestion, 'id' | 'coreContent' | 'variants' | 'type' | 'moduleUnitId' | 'questionGroupId'> & {
  id: string;
  title: string;
  type: QuestionType;
  coreContent?: QuestionContent;
  variants: Variant[];
  isDraft?: boolean;
};

type QuestionGroup = Omit<ModuleUnitEditorGroup, 'id' | 'questions' | 'name' | 'moduleUnitId' | 'sortOrder'> & {
  id: string;
  title: string;
  sortOrder: number;
  questions: Question[];
};

type DeleteTarget =
  | { type: 'group'; groupId: string; title: string }
  | { type: 'question'; groupId: string; questionId: string; title: string }
  | { type: 'variant'; groupId: string; questionId: string; variantId: string; label: string };

export default function ModuleUnitEditor() {
  const { moduleId, unitId } = useParams<{ moduleId: string; unitId: string }>();
  const [unitTitle, setUnitTitle] = useState('');
  const [variantInstructions, setVariantInstructions] = useState('');
  const [groups, setGroups] = useState<QuestionGroup[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [isSavingVariant, setIsSavingVariant] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Keep delete UI semantics aligned with unit lifecycle: live units show archive affordances.
  const [isUnitLive, setIsUnitLive] = useState(false);
  useEffect(() => {
    // Reset delete error whenever the target changes to avoid showing stale errors.
    setDeleteError(null);
  }, [deleteTarget]);

  const [selected, setSelected] = useState<{ groupId: string; questionId: string | null; variantId: string | null } | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupTitle, setEditingGroupTitle] = useState('');
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const editingGroupInputRef = useRef<HTMLInputElement | null>(null);
  // Cache per-question, per-type option/explanation inputs so toggling types can restore prior edits.
  const questionTypeCacheRef = useRef<
    Map<string, Partial<Record<QuestionType, { options: QuestionForm['options']; explanations: string[] }>>>
  >(new Map());

const mcqOptionSlots = useMemo(() => emptyMcqTemplate().options.length, []);

const formatQuestionLabel = (index: number, isDraft?: boolean) =>
  `Question ${index + 1}${isDraft ? ' (draft)' : ''}`;

const formatVariantLabel = (index: number, isDraft?: boolean) =>
  `Variant ${index + 1}${isDraft ? ' (draft)' : ''}`;

const deriveNextGroupSortOrder = (existingGroups: QuestionGroup[]) =>
  // Keep order independent from naming by assigning the next sort slot separately.
  existingGroups.reduce((maxValue, group) => Math.max(maxValue, group.sortOrder), 0) + 1;

// Keep source values aligned with api-contracts QuestionSource union.
const SOURCE_HUMAN: QuestionSource = 'human';
const SOURCE_AI: QuestionSource = 'ai-generated';
const normalizeSource = (value?: string | null): QuestionSource =>
  value === SOURCE_AI ? SOURCE_AI : SOURCE_HUMAN;

  const buildInitialForm = useCallback(
    (): QuestionForm => ({
      stem: '',
      type: DEFAULT_QUESTION_TYPE,
      options: Array.from({ length: mcqOptionSlots }, () => ({ id: makeId(), value: '', isCorrect: false })),
      explanations: Array.from({ length: mcqOptionSlots }, () => ''),
      hint: '',
    }),
    [mcqOptionSlots],
  );

  const resetOptionsForType = useCallback(
    (type: QuestionType) => {
      return QUESTION_TYPE_CONFIGS[type].getInitialOptions(mcqOptionSlots);
    },
    [mcqOptionSlots],
  );

  const clearOtherTypesCache = useCallback(
    (cacheKey: string, savedType: QuestionType) => {
      const existing = questionTypeCacheRef.current.get(cacheKey) ?? {};
      const nextCache: Partial<Record<QuestionType, { options: QuestionForm['options']; explanations: string[] }>> = {
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
      const data = content.questionData as { options?: { optionText: string; explanation?: string }[]; correctOptionIndex?: number };
      const correctIndex = Number.isInteger(data?.correctOptionIndex) ? (data?.correctOptionIndex as number) : 0;
      const baseOptions = QUESTION_TYPE_CONFIGS[type].getInitialOptions(mcqOptionSlots);

      const mergedOptions = baseOptions.options.map((base, idx) => ({
        ...base,
        value: data?.options?.[idx]?.optionText ?? base.value,
        isCorrect: idx === correctIndex,
      }));
      const mergedExplanations = baseOptions.explanations.map((base, idx) => {
        return data?.options?.[idx]?.explanation ?? base;
      });

      setForm({
        stem: content.questionStem,
        type,
        options: mergedOptions,
        explanations: mergedExplanations,
        hint: content.hint ?? '',
      });
      // Store loaded content in cache so type toggles can restore it later.
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

  const [form, setForm] = useState<QuestionForm>(buildInitialForm);

  const selectedQuestion = useMemo(() => {
    if (!selected) return null;
    const group = groups.find((g) => g.id === selected.groupId);
    if (!group) return null;
    return group.questions.find((q) => q.id === selected.questionId) ?? null;
  }, [groups, selected]);

  useEffect(() => {
    if (!selected) {
      // Reset the editor form when nothing is selected so stale content is not edited accidentally.
      setForm(buildInitialForm());
    }
  }, [selected, buildInitialForm]);

  // Keep a linear navigation list (core question first, then its variants) to drive prev/next controls.
  const navigationItems = useMemo(() => {
    if (!selected) return [];
    const group = groups.find((g) => g.id === selected.groupId);
    const question = group?.questions.find((q) => q.id === selected.questionId);
    if (!question) return [];
    const questionIndex = group?.questions.findIndex((q) => q.id === question.id) ?? 0;
    const items: { questionId: string; variantId: string | null; label: string }[] = [
      { questionId: question.id, variantId: null, label: formatQuestionLabel(questionIndex, question.isDraft) },
      ...question.variants.map((variant) => ({
        questionId: question.id,
        variantId: variant.id,
        label: formatVariantLabel(question.variants.findIndex((v) => v.id === variant.id), variant.isDraft),
      })),
    ];
    return items;
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

  const handleNavigate = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const nextItem = navigationItems[selectedIndex + direction];
    if (!nextItem) return;
    setSelected({
      groupId: selected!.groupId,
      questionId: nextItem.questionId,
      variantId: nextItem.variantId,
    });
  };

  const activeLabel = useMemo(() => {
    if (!selectedQuestion) return null;
    const group = selected ? groups.find((g) => g.id === selected.groupId) : null;
    const questionIndex = group?.questions.findIndex((q) => q.id === selectedQuestion.id) ?? -1;
    if (selected?.variantId) {
      const variantIndex = selectedQuestion.variants.findIndex((v) => v.id === selected.variantId);
      if (variantIndex >= 0) {
        return formatVariantLabel(variantIndex, selectedQuestion.variants[variantIndex]?.isDraft);
      }
    }
    return questionIndex >= 0 ? formatQuestionLabel(questionIndex, selectedQuestion.isDraft) : selectedQuestion.title;
  }, [groups, selectedQuestion, selected]);

  const deleteCopy = useMemo(() => {
    if (!deleteTarget) {
      return { title: '', body: '', confirmLabel: 'Delete' };
    }
    // Live units archive content for future sessions, so modal language must warn about practice impact.
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

  const handleAddGroup = () => {
    // Live units are treated as content-frozen for new author additions in the editor UI.
    if (isUnitLive) {
      setSaveError('This module unit is live. New groups cannot be added.');
      return;
    }
    const nextGroupSortOrder = deriveNextGroupSortOrder(groups);
    const newGroup: QuestionGroup = {
      id: makeId(),
      // Mirror title numbering with sort order so labels stay monotonic even after manual renames.
      title: getModuleUnitGroupName(nextGroupSortOrder),
      sortOrder: nextGroupSortOrder,
      questions: [],
    };
    setGroups((prev) => [...prev, newGroup]);
    setExpandedGroups((prev) => new Set([...prev, newGroup.id]));
    setSelected({ groupId: newGroup.id, questionId: null, variantId: null });
  };

  // Helper to ensure core content has been persisted before permitting dependent actions.
  const isQuestionSaved = (question: Question) => !question.isDraft && Boolean(question.coreContent);

  // Enforce sequential saves: core must be saved before variants, and each variant before the next.
  const canAddVariant = (question: Question) => {
    if (!isQuestionSaved(question)) return false;
    const lastVariant = question.variants[question.variants.length - 1];
    return !lastVariant || (!lastVariant.isDraft && Boolean(lastVariant.content));
  };

  const handleToggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleUpdateGroupTitle = (groupId: string, newTitle: string) => {
    setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, title: newTitle } : group)));
  };

  const startEditingGroupTitle = (groupId: string, currentTitle: string) => {
    // Keep edits in a dedicated draft state so cancel can restore the original title.
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
      // Clear stale API errors before applying current validation state.
      inputEl.setCustomValidity('');
    }
    // Trim to avoid persisting accidental leading/trailing whitespace in display names.
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
      // Draft groups only exist client-side until first question save creates them on the server.
      handleUpdateGroupTitle(groupId, nextTitle);
      setEditingGroupId(null);
      setEditingGroupTitle('');
      return;
    }

    if (!parsedModuleId || !parsedUnitId) return;

    setRenamingGroupId(groupId);
    try {
      await updateModuleUnitQuestionGroupName(parsedModuleId, parsedUnitId, numericGroupId, {
        name: nextTitle,
      });
      handleUpdateGroupTitle(groupId, nextTitle);
      setEditingGroupId(null);
      setEditingGroupTitle('');
    } catch (err) {
      if (inputEl) {
        // Surface expected backend 4xx messages; keep unexpected failures generic.
        const message =
          err instanceof ApiError && err.status >= 400 && err.status < 500
            ? err.message
            : 'Could not rename this group. Please try again.';
        inputEl.setCustomValidity(message);
        inputEl.reportValidity();
      }
      logError(err, { feature: 'question-group', action: 'rename', unitId: parsedUnitId });
    } finally {
      setRenamingGroupId(null);
    }
  };

  const handleAddQuestion = (groupId: string) => {
    // Prevent new question drafts once the unit is live so authoring matches publish constraints.
    if (isUnitLive) {
      setSaveError('This module unit is live. New questions cannot be added.');
      return;
    }
    const group = groups.find((g) => g.id === groupId);
    const lastQuestion = group?.questions[group.questions.length - 1];
    if (lastQuestion && !isQuestionSaved(lastQuestion)) {
      const lastIndex = (group?.questions.length ?? 1) - 1;
      setSaveError(`Save ${formatQuestionLabel(lastIndex, lastQuestion.isDraft)} before adding another question in this group.`);
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
    // Keep a local draft so authors can edit before committing via Save Question.
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, questions: [...group.questions, newQuestion] } : group,
      ),
    );
    // Seed cache for all types so toggling restores inputs.
    const initialCache: Partial<Record<QuestionType, { options: QuestionForm['options']; explanations: string[] }>> = {};
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
    // Prevent new variant drafts once the unit is live so students do not get shifting assessed scope.
    if (isUnitLive) {
      setSaveError('This module unit is live. New variants cannot be added.');
      return;
    }
    const group = groups.find((g) => g.id === groupId);
    const question = group?.questions.find((q) => q.id === questionId);
    if (!question) return;
    if (!isQuestionSaved(question)) {
      setSaveError('Save the core question before adding variants.');
      return;
    }
    if (!canAddVariant(question)) {
      const lastVariant = question.variants[question.variants.length - 1];
      setSaveError(
        lastVariant
          ? `Save ${formatVariantLabel(question.variants.length - 1, lastVariant.isDraft)} before creating another variant.`
          : 'Save the core question before creating variants.',
      );
      return;
    }
    const draftVariantId = `temp-variant-${makeId()}`;
    // Keep draft variants local until the user explicitly saves.
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              questions: g.questions.map((q) =>
                q.id !== questionId
                  ? q
                  : {
                      ...q,
                          variants: [
                            ...q.variants,
                            {
                              id: draftVariantId,
                              label: formatVariantLabel(q.variants.length, true),
                              isDraft: true,
                            },
                          ],
                        },
              ),
            },
      ),
    );
    setSelected({ groupId, questionId, variantId: draftVariantId });
    setForm(buildInitialForm());
    setSaveError(null);
  };

  const clearQuestionCaches = (question: Question) => {
    // Remove cached option sets tied to a question so deleted items don't leak stale UI state.
    questionTypeCacheRef.current.delete(`${question.id}-core`);
    question.variants.forEach((variant) => {
      questionTypeCacheRef.current.delete(`${question.id}-variant-${variant.id}`);
    });
  };

  const computeFallbackSelection = (nextGroups: QuestionGroup[]) => {
    // Walk groups in order to find the next available question for selection.
    for (const group of nextGroups) {
      const firstQuestion = group.questions[0];
      if (firstQuestion) {
        return { groupId: group.id, questionId: firstQuestion.id, variantId: null };
      }
    }
    return null;
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !parsedModuleId || !parsedUnitId) return;

    setIsDeleting(true);
    setDeleteError(null);

    let nextGroups = groups;
    let nextSelected: typeof selected = selected;
    const nextExpanded = new Set(expandedGroups);

    if (deleteTarget.type === 'group') {
      const { groupId } = deleteTarget;
      const numericId = Number(groupId);
      if (Number.isFinite(numericId)) {
        try {
          await deleteModuleUnitQuestionGroup(parsedModuleId, parsedUnitId, numericId);
        } catch (err) {
          setDeleteError('Could not delete this group. Please try again.');
          logError(err, { feature: 'question-group', action: 'delete', unitId: parsedUnitId });
          setIsDeleting(false);
          return;
        }
      }
      const removedGroup = groups.find((g) => g.id === groupId);
      removedGroup?.questions.forEach(clearQuestionCaches);
      nextExpanded.delete(groupId);
      if (editingGroupId === groupId) {
        setEditingGroupId(null);
      }
      nextGroups = groups.filter((group) => group.id !== groupId);
      if (selected?.groupId === groupId) {
        nextSelected = null;
      }
    } else if (deleteTarget.type === 'question') {
      const { groupId, questionId } = deleteTarget;
      const numericId = Number(questionId);
      if (Number.isFinite(numericId)) {
        try {
          await deleteQuestionFromUnit(parsedModuleId, parsedUnitId, numericId);
        } catch (err) {
          setDeleteError('Could not delete this question. Please try again.');
          logError(err, { feature: 'question', action: 'delete', unitId: parsedUnitId });
          setIsDeleting(false);
          return;
        }
      }
      const targetGroup = groups.find((g) => g.id === groupId);
      const targetQuestion = targetGroup?.questions.find((q) => q.id === questionId);
      if (targetQuestion) {
        clearQuestionCaches(targetQuestion);
      }
      nextGroups = groups.map((group) =>
        group.id === groupId
          ? { ...group, questions: group.questions.filter((q) => q.id !== questionId) }
          : group,
      );
      if (selected?.groupId === groupId && selected.questionId === questionId) {
        const updatedGroup = nextGroups.find((g) => g.id === groupId);
        const fallbackQuestion = updatedGroup?.questions[0];
        nextSelected = fallbackQuestion
          ? { groupId, questionId: fallbackQuestion.id, variantId: null }
          : null;
      }
    } else if (deleteTarget.type === 'variant') {
      const { groupId, questionId, variantId } = deleteTarget;
      const numericQuestionId = Number(questionId);
      const numericVariantId = Number(variantId);
      if (Number.isFinite(numericQuestionId) && Number.isFinite(numericVariantId)) {
        try {
          await deleteVariantFromQuestion(
            parsedModuleId,
            parsedUnitId,
            numericQuestionId,
            numericVariantId,
          );
        } catch (err) {
          setDeleteError('Could not delete this variant. Please try again.');
          logError(err, { feature: 'variant', action: 'delete', unitId: parsedUnitId });
          setIsDeleting(false);
          return;
        }
      }
      nextGroups = groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              questions: group.questions.map((question) =>
                question.id === questionId
                  ? { ...question, variants: question.variants.filter((v) => v.id !== variantId) }
                  : question,
              ),
            }
          : group,
      );
      questionTypeCacheRef.current.delete(`${questionId}-variant-${variantId}`);
      if (
        selected?.groupId === groupId &&
        selected.questionId === questionId &&
        selected.variantId === variantId
      ) {
        // Drop back to the core question so the editor stays on a valid item.
        nextSelected = { groupId, questionId, variantId: null };
      }
    }

    const resolvedSelection = nextSelected ?? computeFallbackSelection(nextGroups);
    setGroups(nextGroups);
    setExpandedGroups(nextExpanded);
    setSelected(resolvedSelection);
    if (!resolvedSelection) {
      setForm(buildInitialForm());
    }
    setDeleteTarget(null);
    setSaveError(null);
    setIsDeleting(false);
  };

  const setCorrectOption = (id: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((opt) => ({ ...opt, isCorrect: opt.id === id })),
    }));
  };

  const handleOptionChange = (id: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((opt) => (opt.id === id ? { ...opt, value } : opt)),
    }));
  };

  const handleExplanationChange = (index: number, value: string) => {
    setForm((prev) => {
      const explanations = [...prev.explanations];
      explanations[index] = value;
      return { ...prev, explanations };
    });
  };

  const handleTypeChange = (type: QuestionType) => {
    if (!selectedQuestion || !selected) return;
    const cacheKey = selected.variantId ? `${selectedQuestion.id}-variant-${selected.variantId}` : `${selectedQuestion.id}-core`;
    // Cache current type inputs before switching.
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

  // Create or update a core question (or selected variant) with current form contents.
  const handleSaveQuestion = async () => {
    if (!parsedModuleId || !parsedUnitId) return;
    if (!selected) {
      setSaveError('Select a question before saving.');
      return;
    }
    const targetGroupId = selected.groupId;
    const targetGroup = groups.find((g) => g.id === targetGroupId);
    if (!targetGroup) {
      setSaveError('Pick a question group first.');
      return;
    }
    let numericGroupId = Number(targetGroupId);
    if (!Number.isFinite(numericGroupId)) {
      try {
        // First save for a draft group: create it on the server so subsequent questions have a stable id.
        const createdGroup = await createModuleUnitQuestionGroup(parsedModuleId, parsedUnitId, {
          moduleUnitId: parsedUnitId,
          name: targetGroup.title,
          sortOrder: targetGroup.sortOrder,
        });
        numericGroupId = Number(createdGroup.id ?? NaN);
        if (!Number.isFinite(numericGroupId)) {
          throw new Error('Invalid group id');
        }
        // Keep UI expanded and selection intact when replacing the temp group id with the persisted one.
        setGroups((prev) =>
          prev.map((group) =>
            group.id === targetGroupId
              ? { ...group, id: String(numericGroupId) }
              : group,
          ),
        );
        setExpandedGroups((prev) => new Set([...Array.from(prev).filter((id) => id !== targetGroupId), String(numericGroupId)]));
        setSelected((prev) =>
          prev
            ? { ...prev, groupId: String(numericGroupId) }
            : null,
        );
      } catch (err) {
        setSaveError('Could not create question group. Please try again.');
        logError(err, { feature: 'question-group', action: 'create', unitId: parsedUnitId });
        return;
      }
    }
    const resolvedGroupId = String(numericGroupId);
    const targetQuestion = targetGroup.questions.find((q) => q.id === selected.questionId);
    if (!targetQuestion) {
      setSaveError('Pick a question to save.');
      return;
    }
    const questionIndex = targetGroup.questions.findIndex((q) => q.id === targetQuestion.id);
    const resolvedQuestionTitle = formatQuestionLabel(Math.max(questionIndex, 0), false);

    const validationError = QUESTION_TYPE_CONFIGS[form.type].validate(form);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const payload = {
      questionGroupId: numericGroupId,
      // For auto-numbered labels we overwrite with the derived title to keep server and UI aligned.
      // We avoid "(draft)" in persisted titles so published lists stay clean.
      title: resolvedQuestionTitle,
      questionStem: form.stem,
      type: form.type,
      questionData: QUESTION_TYPE_CONFIGS[form.type].buildQuestionData(form),
      hint: form.hint,
      source: SOURCE_HUMAN,
      // Draft questions default to live; archive toggle is handled explicitly.
      isArchived: false,
    } satisfies CreateQuestionPayload;

    setIsSavingQuestion(true);
    if (selected.variantId) {
      setIsSavingVariant(true);
    }
    setSaveError(null);
    try {
      let persistedQuestionId = targetQuestion.id;
      let persistedCoreContentId = targetQuestion.coreContent?.id ?? null;
      let persistedTitle = resolvedQuestionTitle;

      if (targetQuestion.isDraft) {
        // Persist the draft question before handling variants to guarantee a server id.
        const created = await createQuestionForUnit(parsedModuleId, parsedUnitId, payload);
        persistedQuestionId = String(created.questionUnit.id);
        persistedCoreContentId = String(created.coreContent.id);
        persistedTitle = resolvedQuestionTitle;
        setGroups((prev) =>
          prev.map((group) =>
            group.id === resolvedGroupId
              ? {
                  ...group,
                  questions: group.questions.map((q) =>
                    q.id === targetQuestion.id
                      ? {
                          ...q,
                          id: persistedQuestionId,
                          title: persistedTitle,
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
                      }
                      : q,
                  ),
                }
              : group,
          ),
        );
        setSelected((prev) =>
          prev
            ? { ...prev, questionId: persistedQuestionId, groupId: resolvedGroupId }
            : { groupId: resolvedGroupId, questionId: persistedQuestionId, variantId: selected.variantId },
        );
      }

      if (selected.variantId) {
        // Save or update the selected variant.
        const variant = targetQuestion.variants.find((v) => v.id === selected.variantId);
        if (!variant) {
          setSaveError('Variant not found.');
          return;
        }
        const variantIndex = targetQuestion.variants.findIndex((v) => v.id === selected.variantId);
        const resolvedVariantLabel = variantIndex >= 0 ? formatVariantLabel(variantIndex, false) : variant.label;

        if (variant.isDraft || !variant.content) {
          // Draft variants are created only when the user explicitly saves.
          const variantPayload = {
            variantLabel: resolvedVariantLabel,
            questionStem: form.stem,
            type: form.type,
            questionData: QUESTION_TYPE_CONFIGS[form.type].buildQuestionData(form),
            hint: form.hint,
            source: SOURCE_HUMAN,
            isArchived: false,
          } satisfies CreateVariantPayload;

          const createdVariant = await createVariantForQuestion(
            parsedModuleId,
            parsedUnitId,
            Number(persistedQuestionId),
            variantPayload,
          );

          setGroups((prev) =>
            prev.map((group) =>
              group.id === resolvedGroupId
                ? {
                    ...group,
                    questions: group.questions.map((q) =>
                      q.id === persistedQuestionId || q.id === targetQuestion.id
                        ? {
                            ...q,
                              variants: q.variants.map((v) =>
                                v.id === variant.id
                                  ? {
                                      ...v,
                                      id: String(createdVariant.variant.id),
                                      label: resolvedVariantLabel,
                                      isDraft: false,
                                      content: {
                                        id: String(createdVariant.variant.content.id),
                                        questionUnitId: String(createdVariant.variant.content.questionUnitId ?? persistedQuestionId),
                                      questionStem: createdVariant.variant.content.questionStem,
                                      questionData: createdVariant.variant.content.questionData,
                                      type: createdVariant.variant.content.type,
                                      hint: createdVariant.variant.content.hint ?? null,
                                      source: normalizeSource(createdVariant.variant.content.source),
                                      isArchived: Boolean(createdVariant.variant.content.isArchived),
                                    },
                                  }
                                : v,
                            ),
                          }
                        : q,
                    ),
                }
              : group,
          ),
        );

          setSelected({ groupId: resolvedGroupId, questionId: persistedQuestionId, variantId: String(createdVariant.variant.id) });
          clearOtherTypesCache(`${persistedQuestionId}-variant-${createdVariant.variant.id}`, payload.type as QuestionType);
        } else {
          const variantUpdatePayload = {
            questionStem: payload.questionStem,
            questionData: payload.questionData,
            type: payload.type,
            hint: payload.hint,
            source: payload.source,
            isArchived: payload.isArchived,
          } satisfies UpdateQuestionContentPayload;

          await updateQuestionContentScoped(
            parsedModuleId,
            parsedUnitId,
            Number(persistedQuestionId),
            Number(variant.content.id),
            variantUpdatePayload,
          );
          setGroups((prev) =>
            prev.map((group) =>
              group.id === resolvedGroupId
                ? {
                    ...group,
                    questions: group.questions.map((q) =>
                      q.id === persistedQuestionId || q.id === targetQuestion.id
                        ? {
                            ...q,
                            variants: q.variants.map((v) =>
                              v.id === selected.variantId
                                ? {
                                    ...v,
                                    content: {
                                      ...(v.content ?? {
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
                                  }
                                : v,
                            ),
                          }
                        : q,
                  ),
                }
              : group,
          ),
        );
          clearOtherTypesCache(`${persistedQuestionId}-variant-${selected.variantId}`, payload.type as QuestionType);
        }
      } else {
        // Save or update the core question content.
        if (targetQuestion.isDraft) {
          // Draft questions are persisted in the earlier branch; nothing else to do.
          return;
        }
        if (!targetQuestion.coreContent || !persistedCoreContentId) {
          setSaveError('Question content missing.');
          return;
        }
        const coreUpdatePayload = {
          questionStem: payload.questionStem,
          questionData: payload.questionData,
          type: payload.type,
          hint: payload.hint,
          source: payload.source,
          isArchived: payload.isArchived,
        } satisfies UpdateQuestionContentPayload;

        await updateQuestionContentScoped(
          parsedModuleId,
          parsedUnitId,
          Number(persistedQuestionId),
          Number(persistedCoreContentId),
          coreUpdatePayload,
        );
        setGroups((prev) =>
          prev.map((group) =>
            group.id === resolvedGroupId
              ? {
                  ...group,
                  questions: group.questions.map((q) =>
                      q.id === persistedQuestionId || q.id === targetQuestion.id
                        ? {
                            ...q,
                            coreContent: {
                              ...(q.coreContent ?? { 
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
                          }
                        : q,
                  ),
                }
              : group,
          ),
        );
        clearOtherTypesCache(`${persistedQuestionId}-core`, payload.type as QuestionType);
      }
    } catch (err) {
      // Validation/permission failures are expected user-fixable flows, so avoid noisy error telemetry.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        const detailMessage = err.details?.[0]?.message;
        setSaveError(detailMessage ?? err.message ?? 'Could not save the question. Please review your input.');
      } else {
        setSaveError('Could not save the question. Please try again.');
        logError(err, { feature: 'question', action: 'save', unitId: parsedUnitId });
      }
    } finally {
      setIsSavingQuestion(false);
      setIsSavingVariant(false);
    }
  };

  const parsedModuleId = useMemo(() => {
    if (!moduleId) return null;
    const value = Number(moduleId);
    return Number.isFinite(value) ? value : null;
  }, [moduleId]);

  const parsedUnitId = useMemo(() => {
    if (!unitId) return null;
    const value = Number(unitId);
    return Number.isFinite(value) ? value : null;
  }, [unitId]);

  useEffect(() => {
    if (!parsedUnitId || !parsedModuleId) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [unit, moduleUnits] = await Promise.all([
          getModuleUnitEditor(parsedModuleId, parsedUnitId),
          getModuleUnits(parsedModuleId),
        ]);
        if (cancelled) return;
        // Use module-unit list as source of truth for status so iconography tracks publish state.
        const currentUnit = moduleUnits.find((candidate) => candidate.id === parsedUnitId);
        setIsUnitLive(currentUnit?.status === 'live');
        setUnitTitle(unit.title);
        setVariantInstructions(unit.variantContext ?? '');
        const mappedGroups = (unit.questionGroups ?? []).map((g) => {
          const questions = (g.questions ?? []).map((q) => ({
            id: String(q.id),
            title: q.title,
            type: normalizeQuestionType(q.type),
            variants: (q.variants ?? []).map((v) => ({
              id: String(v.id),
              label: v.variantLabel,
              content: v.content
                ? {
                    id: String(v.content.id),
                    questionUnitId: String(v.content.questionUnitId ?? q.id),
                    questionStem: v.content.questionStem,
                    questionData: v.content.questionData,
                    type: normalizeQuestionType(v.content.type),
                    hint: v.content.hint ?? null,
                    difficultyScore: v.content.difficultyScore,
                    source: normalizeSource(v.content.source),
                    isArchived: Boolean(v.content.isArchived),
                  }
                : undefined,
            })),
            coreContent: q.coreContent
              ? {
                  id: String(q.coreContent.id),
                  questionUnitId: String(q.coreContent.questionUnitId),
                  questionStem: q.coreContent.questionStem,
                  questionData: q.coreContent.questionData,
                  type: normalizeQuestionType(q.coreContent.type),
                  hint: q.coreContent.hint ?? null,
                  difficultyScore: q.coreContent.difficultyScore,
                  source: normalizeSource(q.coreContent.source),
                  isArchived: Boolean(q.coreContent.isArchived),
                }
              : undefined,
          }));
          return {
            id: String(g.id),
            title: g.name,
            sortOrder: g.sortOrder,
            questions,
          };
        });
        setGroups(mappedGroups);
        setExpandedGroups(new Set(mappedGroups.map((g) => g.id)));
        const firstQuestion = mappedGroups[0]?.questions[0];
        setSelected(
          mappedGroups[0]
            ? {
                groupId: mappedGroups[0].id,
                questionId: firstQuestion?.id ?? null,
                variantId: null,
              }
            : null,
        );
        if (firstQuestion?.coreContent) {
          loadContentIntoForm(firstQuestion.coreContent, `${firstQuestion.id}-core`);
        } else {
          setForm(buildInitialForm());
        }
      } catch {
        if (!cancelled) {
          setError('Could not load this module unit. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [parsedModuleId, parsedUnitId, loadContentIntoForm, buildInitialForm]);

  useEffect(() => {
    if (!selected) return;
    const group = groups.find((g) => g.id === selected.groupId);
    if (!group) return;
    const question = group.questions.find((q) => q.id === selected.questionId);
    if (!question) return;
    const cacheKey = selected.variantId ? `${question.id}-variant-${selected.variantId}` : `${question.id}-core`;
    if (selected.variantId) {
      const variant = question.variants.find((v) => v.id === selected.variantId);
      loadContentIntoForm(variant?.content, cacheKey);
    } else {
      loadContentIntoForm(question.coreContent, cacheKey);
    }
  }, [groups, selected, loadContentIntoForm]);

  if (!parsedUnitId || !parsedModuleId) {
    return (
      <MainSection className={styles.page}>
        <div className={styles.topBar}>
          <Link className={styles.backLink} to={`/main/modules/${moduleId}`}>
            ← Back to module
          </Link>
        </div>
        <div className={styles.statusCard} role="alert">
          Module unit not found.
        </div>
      </MainSection>
    );
  }

  const handleGenerateVariant = () => {
    alert('Comming Soon! 😎')
  }

  return (
    <MainSection className={styles.page}>
      <div className={styles.topBar}>
        <Link className={styles.backLink} to={`/main/modules/${moduleId}`}>
          ← Back to module
        </Link>
      </div>
      {isLoading ? (
        <div className={styles.statusCard}>Loading module unit…</div>
      ) : error ? (
        <div className={styles.statusCard} role="alert">
          {error}
        </div>
      ) : (
        <>
          <div className={styles.pageHeader}>
            <div>
                <h1 className={styles.pageTitle}>{unitTitle || 'Module unit title'}</h1>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.leftColumn}>
              <div className={styles.sectionHeader}>
                <h2>Questions</h2>
              </div>

              {groups.map((group) => (
                <div key={group.id} className={styles.groupCard}>
                  <div className={styles.groupHeader}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={expandedGroups.has(group.id)}
                      className={styles.groupToggle}
                      onClick={() => {
                        if (editingGroupId === group.id) return;
                        handleToggleGroup(group.id);
                      }}
                      onKeyDown={(e) => {
                        if (editingGroupId === group.id) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggleGroup(group.id);
                        }
                      }}
                    >
                      {editingGroupId === group.id ? (
                        <div className={styles.groupTitleEditRow} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            ref={editingGroupInputRef}
                            required
                            value={editingGroupTitle}
                            onChange={(e) => {
                              setEditingGroupTitle(e.target.value);
                              e.currentTarget.setCustomValidity('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void saveEditingGroupTitle(group.id);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelEditingGroupTitle();
                              }
                            }}
                            className={styles.groupTitleInput}
                            autoFocus
                          />
                          <div className={styles.groupEditControls}>
                            <button
                              type="button"
                              className={styles.iconButton}
                              aria-label={`Save group name ${group.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void saveEditingGroupTitle(group.id);
                              }}
                              disabled={!editingGroupTitle.trim() || renamingGroupId === group.id}
                            >
                              <FiCheck aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={styles.iconButton}
                              aria-label={`Cancel renaming ${group.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditingGroupTitle();
                              }}
                              disabled={renamingGroupId === group.id}
                            >
                              <FiX aria-hidden />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.groupTitleRow}>
                          <h3>{group.title}</h3>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={`Rename group ${group.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingGroupTitle(group.id, group.title);
                          }}
                          disabled={renamingGroupId === group.id}
                        >
                            <FiEdit2 aria-hidden />
                          </button>
                        </div>
                      )}
                      <div className={styles.groupHeaderActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={`${isUnitLive ? 'Archive' : 'Delete'} group ${group.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (editingGroupId === group.id) {
                              cancelEditingGroupTitle();
                            }
                            setDeleteTarget({ type: 'group', groupId: group.id, title: group.title });
                          }}
                        >
                          {isUnitLive ? <FiArchive aria-hidden /> : <FiTrash2 aria-hidden />}
                        </button>
                        <span className={styles.expandIcon}>
                          {expandedGroups.has(group.id) ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {expandedGroups.has(group.id) && (
                    <div className={styles.questionList}>
                      {group.questions.map((question, questionIndex) => {
                        const isSelected = selected?.groupId === group.id && selected?.questionId === question.id;
                        const isVariantSelected = Boolean(isSelected && selected?.variantId);
                        const allowNewVariant = canAddVariant(question);
                        const questionDisplayLabel = formatQuestionLabel(questionIndex, question.isDraft);
                        return (
                          <div key={question.id} className={styles.questionItem}>
                            <div className={styles.questionRow}>
                              <div
                                role="button"
                                tabIndex={0}
                                className={`${styles.questionBlock} ${isSelected ? styles.selected : ''} ${isVariantSelected ? styles.variantSelected : ''}`}
                                onClick={() =>
                                  setSelected({ groupId: group.id, questionId: question.id, variantId: null })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelected({ groupId: group.id, questionId: question.id, variantId: null });
                                  }
                                }}
                              >
                                <span className={styles.questionLabel}>{questionDisplayLabel}</span>
                                <div className={styles.questionMeta}>
                                <span className={styles.questionType}>{QUESTION_TYPE_CONFIGS[question.type].label}</span>
                                <button
                                  type="button"
                                  className={`${styles.iconButton} ${styles.dangerIcon}`}
                                  aria-label={`${isUnitLive ? 'Archive' : 'Delete'} question ${questionDisplayLabel}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget({
                                      type: 'question',
                                      groupId: group.id,
                                      questionId: question.id,
                                      title: questionDisplayLabel,
                                    });
                                  }}
                                >
                                  {isUnitLive ? <FiArchive aria-hidden /> : <FiTrash2 aria-hidden />}
                                </button>
                                </div>
                              </div>
                            </div>
                            <div className={styles.variantList}>
                              {question.variants.map((variant, variantIndex) => {
                                const variantDisplayLabel = formatVariantLabel(variantIndex, variant.isDraft);
                                return (
                                  <div key={variant.id} className={styles.variantItem}>
                                    <button
                                      type="button"
                                      className={`${styles.variantBlock} ${selected?.questionId === question.id ? styles.selectedVariant : ''} ${selected?.variantId === variant.id ? styles.selectedVariantFull : ''}`}
                                      onClick={() =>
                                        setSelected({ groupId: group.id, questionId: question.id, variantId: variant.id })
                                      }
                                    >
                                      {variantDisplayLabel}
                                    </button>
                                    <button
                                      type="button"
                                      className={`${styles.iconButton} ${styles.dangerIcon}`}
                                      aria-label={`${isUnitLive ? 'Archive' : 'Delete'} variant ${variantDisplayLabel}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteTarget({
                                          type: 'variant',
                                          groupId: group.id,
                                          questionId: question.id,
                                          variantId: variant.id,
                                          label: variantDisplayLabel,
                                        });
                                      }}
                                    >
                                      {isUnitLive ? <FiArchive aria-hidden /> : <FiTrash2 aria-hidden />}
                                    </button>
                                  </div>
                                );
                              })}
                              <button
                                type="button"
                                className={styles.addVariantButton}
                                onClick={() => handleAddVariant(group.id, question.id)}
                                aria-label="Add variant"
                                disabled={isUnitLive || isSavingVariant || !allowNewVariant}
                              >
                                <IconContext.Provider value={{ className: styles.plusVariantIcon }}>
                                <FaCirclePlus/>
                                </IconContext.Provider>
                                Variant
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {(() => {
                        const lastQuestion = group.questions[group.questions.length - 1];
                        const allowNewQuestion = !lastQuestion || isQuestionSaved(lastQuestion);
                        return (
                      <button
                        type="button"
                        className={styles.addQuestion}
                        onClick={() => handleAddQuestion(group.id)}
                        disabled={isUnitLive || !allowNewQuestion}
                      >
                        <IconContext.Provider value={{ className: styles.plusQuestionIcon }}>
                          <FaCirclePlus/>
                        </IconContext.Provider>
                        Add Question
                      </button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                className={styles.addGroup}
                onClick={handleAddGroup}
                disabled={isUnitLive}
              >
                  <IconContext.Provider value={{ className: styles.plusGroupIcon }}>
                      <FaCirclePlus/>
                  </IconContext.Provider>
                Add Group
              </button>

              <div className={styles.variantInstructions}>
                <div className={styles.sectionHeader}>
                  <h2>Variant generation instructions</h2>
                </div>
                <textarea
                  value={variantInstructions}
                  onChange={(e) => setVariantInstructions(e.target.value)}
                  placeholder="Describe how variants should change context, numbers, or wording while keeping concepts aligned."
                />
              </div>
            </div>

            <div className={styles.rightColumn}>
              <div className={styles.sectionHeader}>
                <h2>Question Editor</h2>
                {selectedQuestion ? (
                <div className={styles.editingMeta}>
                  <button
                    type="button"
                    className={styles.navButton}
                    onClick={() => handleNavigate(-1)}
                    disabled={!canGoPrev}
                    aria-label="Previous question or variant"
                    id='left-nav-button'
                    >
                    <IconContext.Provider value={{ className: styles.navIcon}}>
                        <FaCircleChevronLeft/>
                    </IconContext.Provider>
                  </button>
                  <strong>{activeLabel}</strong>
                  <button
                    type="button"
                    className={styles.navButton}
                    onClick={() => handleNavigate(1)}
                    disabled={!canGoNext}
                    aria-label="Next question or variant"
                    id='right-nav-button'
                  >
                    <IconContext.Provider value={{ className: styles.navIcon}}>
                        <FaCircleChevronRight/>
                    </IconContext.Provider>
                  </button>
                </div>
              ) : (
                <div className={styles.editingMeta}>
                  <span className={styles.editingLabel}>Pick a question to edit</span>
                </div>
              )}
              </div>
              <label className={styles.label} id='question-type-label'>Question Type (Select one):</label>
              <div className={styles.typeToggle}>
                {(Object.values(QUESTION_TYPE_CONFIGS) as QuestionTypeConfig[]).map((config) => (
                  <button
                    key={config.type}
                    type="button"
                    className={`${styles.typeChip} ${form.type === config.type ? styles.typeChipActive : ''}`}
                    onClick={() => handleTypeChange(config.type)}
                  >
                    {config.label}
                  </button>
                ))}
              </div>

              <label className={styles.label}>
                Question Stem
                <textarea
                  value={form.stem}
                  onChange={(e) => setForm((prev) => ({ ...prev, stem: e.target.value }))}
                  placeholder="Enter the question text here..."
                  maxLength={500}
                />
              </label>

              {(() => {
                const Config = QUESTION_TYPE_CONFIGS[form.type];
                const FormComponent = Config.component;
                return (
                  <FormComponent
                    options={form.options.map((opt, idx) => ({
                      ...opt,
                      explanation: form.explanations[idx] ?? '',
                    }))}
                    onChangeOption={handleOptionChange}
                    onChangeExplanation={(id, value) => {
                      const idx = form.options.findIndex((o) => o.id === id);
                      if (idx >= 0) handleExplanationChange(idx, value);
                    }}
                    onSelectCorrect={setCorrectOption}
                  />
                );
              })()}

              <label className={styles.label}>
                💡 Hint (Optional)
                <textarea
              value={form.hint}
              onChange={(e) => setForm((prev) => ({ ...prev, hint: e.target.value }))}
              placeholder="Provide a hint to help students..."
              maxLength={300}
            />
          </label>

          {saveError ? (
            <div className={styles.inlineError} role="alert">
              {saveError}
            </div>
          ) : null}

          <div className={styles.formActions}>
            <div 
              role="button" 
              className={styles.secondaryButton}
              onClick={handleGenerateVariant}>
                Generate Variant
              <IconContext.Provider value={{ className: styles.aiSparkle }}>
                <VscSparkleFilled/>
              </IconContext.Provider>
            </div>
            <button
              type="button"
              className={styles.saveQuestionButton}
              onClick={handleSaveQuestion}
              disabled={isSavingQuestion}
            >
              Save Question
            </button>
          </div>
        </div>
      </div>
        </>
      )}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title={deleteCopy.title}
        body={deleteCopy.body}
        confirmLabel={deleteCopy.confirmLabel}
        isSubmitting={isDeleting}
        errorMessage={deleteError ?? undefined}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </MainSection>
  );
}
