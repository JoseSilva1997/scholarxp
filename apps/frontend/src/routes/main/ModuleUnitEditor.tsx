// Module unit authoring workspace UI for adding questions, variants, and context before wiring backend.
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import MainSection from '../../components/MainSection';
import { getModuleUnitEditor } from '../../api/modules';
import {
  createQuestionForUnit,
  createVariantForQuestion,
  updateQuestionContentScoped,
} from '../../api/questions';
import { logError } from '../../utils/logger';
import { emptyMcqTemplate } from '@scholarxp/question-type-dtos';
import type { mcqQuestionDto, TrueFalseQuestionDto } from '@scholarxp/question-type-dtos';
import { McqForm } from '../../components/question-types/McqForm';
import { TrueFalseForm } from '../../components/question-types/TrueFalseForm';
import styles from './ModuleUnitEditor.module.css';

type QuestionType = 'mcq' | 'trueFalse';

type Variant = {
  id: string;
  label: string;
  content?: QuestionContent;
  isDraft?: boolean;
};

type Question = {
  id: string;
  title: string;
  type: QuestionType;
  coreContent?: QuestionContent;
  variants: Variant[];
  isDraft?: boolean;
};

type QuestionContent = {
  id: string;
  questionUnitId: string;
  questionStem: string;
  questionData: Record<string, unknown>;
  type: string;
  hint: string | null;
  difficultyScore: number;
  source: string;
  status: string;
};

type QuestionGroup = {
  id: string;
  title: string;
  questions: Question[];
};

type QuestionForm = {
  stem: string;
  type: QuestionType;
  options: { value: string; isCorrect: boolean; id: string }[];
  explanations: string[];
  hint: string;
};

// Helpers keep ids predictable for now; will be replaced by backend ids later.
let nextId = 1;
const makeId = () => `${nextId++}`;

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

  const [selected, setSelected] = useState<{ groupId: string; questionId: string | null; variantId: string | null } | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  // Track per-group counters for default question titles; avoids cross-group interference.
  const groupQuestionCountersRef = useRef<Map<string, number>>(new Map());
  // Cache per-question, per-type option/explanation inputs so toggling types can restore prior edits.
  const questionTypeCacheRef = useRef<
    Map<string, Partial<Record<QuestionType, { options: QuestionForm['options']; explanations: string[] }>>>
  >(new Map());

  const mcqOptionSlots = useMemo(() => emptyMcqTemplate().options.length, []);

  const buildInitialForm = useCallback(
    (): QuestionForm => ({
      stem: '',
      type: 'mcq',
      options: Array.from({ length: mcqOptionSlots }, () => ({ id: makeId(), value: '', isCorrect: false })),
      explanations: Array.from({ length: mcqOptionSlots }, () => ''),
      hint: '',
    }),
    [mcqOptionSlots],
  );

  const resetOptionsForType = useCallback(
    (type: QuestionType) => {
      if (type === 'mcq') {
        return {
          options: Array.from({ length: mcqOptionSlots }, () => ({ id: makeId(), value: '', isCorrect: false })),
          explanations: Array.from({ length: mcqOptionSlots }, () => ''),
        };
      }
      return {
        options: [
          { id: makeId(), value: '', isCorrect: false },
          { id: makeId(), value: '', isCorrect: false },
        ],
        explanations: ['', ''],
      };
    },
    [mcqOptionSlots],
  );

  const clearOppositeTypeCache = useCallback(
    (cacheKey: string, savedType: QuestionType) => {
      const otherType: QuestionType = savedType === 'mcq' ? 'trueFalse' : 'mcq';
      const existing = questionTypeCacheRef.current.get(cacheKey) ?? {};
      questionTypeCacheRef.current.set(cacheKey, {
        ...existing,
        [otherType]: resetOptionsForType(otherType),
      });
    },
    [resetOptionsForType],
  );

  const buildMcqOptions = () => {
    const slots = mcqOptionSlots;
    const opts = form.options.slice(0, slots).map((opt, idx) => ({
      optionText: opt.value,
      explanation: form.explanations[idx] ?? '',
    }));
    while (opts.length < slots) {
      opts.push({ optionText: '', explanation: '' });
    }
    return opts as mcqQuestionDto['options'];
  };

  const buildTrueFalseOptions = () => {
    const opts = form.options.slice(0, 2).map((opt, idx) => ({
      optionText: opt.value,
      explanation: form.explanations[idx] ?? '',
    }));
    while (opts.length < 2) {
      opts.push({ optionText: '', explanation: '' });
    }
    return [opts[0], opts[1]] as TrueFalseQuestionDto['options'];
  };

  const [form, setForm] = useState<QuestionForm>(buildInitialForm);

  const selectedQuestion = useMemo(() => {
    if (!selected) return null;
    const group = groups.find((g) => g.id === selected.groupId);
    if (!group) return null;
    return group.questions.find((q) => q.id === selected.questionId) ?? null;
  }, [groups, selected]);

  // Keep a linear navigation list (core question first, then its variants) to drive prev/next controls.
  const navigationItems = useMemo(() => {
    if (!selected) return [];
    const group = groups.find((g) => g.id === selected.groupId);
    const question = group?.questions.find((q) => q.id === selected.questionId);
    if (!question) return [];
    const items: { questionId: string; variantId: string | null; label: string }[] = [
      { questionId: question.id, variantId: null, label: question.title },
      ...question.variants.map((variant) => ({
        questionId: question.id,
        variantId: variant.id,
        label: variant.label,
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
    if (selected?.variantId) {
      const variant = selectedQuestion.variants.find((v) => v.id === selected.variantId);
      return variant?.label ?? selectedQuestion.title;
    }
    return selectedQuestion.title;
  }, [selectedQuestion, selected]);

  const handleAddGroup = () => {
    const newGroup: QuestionGroup = {
      id: makeId(),
      title: `New Group ${groups.length + 1}`,
      questions: [],
    };
    groupQuestionCountersRef.current.set(newGroup.id, 1);
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

  const loadContentIntoForm = useCallback(
    (content: QuestionContent | undefined, cacheKey: string) => {
      if (!content) {
        setForm(buildInitialForm());
        return;
      }
      const type = content.type === 'trueFalse' ? 'trueFalse' : 'mcq';
      const data = content.questionData as { options?: { optionText: string; explanation?: string }[]; correctOptionIndex?: number };
      const correctIndex = Number.isInteger(data?.correctOptionIndex) ? (data?.correctOptionIndex as number) : 0;
      const baseOptions =
        type === 'mcq'
          ? Array.from({ length: mcqOptionSlots }, () => ({ optionText: '', explanation: '' }))
          : [
              { optionText: '', explanation: '' },
              { optionText: '', explanation: '' },
            ];
      const merged = baseOptions.map((base, idx) => ({
        ...base,
        ...(data?.options?.[idx] ?? {}),
      }));
      const mappedOptions = merged.map((opt, idx) => ({
        id: makeId(),
        value: opt.optionText ?? '',
        isCorrect: idx === correctIndex,
      }));
      const mappedExplanations = merged.map((opt) => opt.explanation ?? '');
      setForm({
        stem: content.questionStem,
        type,
        options: mappedOptions,
        explanations: mappedExplanations,
        hint: content.hint ?? '',
      });
      // Store loaded content in cache so type toggles can restore it later.
      questionTypeCacheRef.current.set(cacheKey, {
        ...(questionTypeCacheRef.current.get(cacheKey) ?? {}),
        [type]: {
          options: mappedOptions,
          explanations: mappedExplanations,
        },
      });
    },
    [buildInitialForm, mcqOptionSlots],
  );

  const handleAddQuestion = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    const lastQuestion = group?.questions[group.questions.length - 1];
    if (lastQuestion && !isQuestionSaved(lastQuestion)) {
      setSaveError(`Save ${lastQuestion.title} before adding another question in this group.`);
      return;
    }
    const draftQuestionId = `temp-${makeId()}`;
    const currentCount = groupQuestionCountersRef.current.get(groupId) ?? 1;
    const questionLabel = `Question ${currentCount} (draft)`;
    groupQuestionCountersRef.current.set(groupId, currentCount + 1);
    const newQuestion: Question = {
      id: draftQuestionId,
      title: questionLabel,
      type: 'mcq',
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
    // Seed cache for MCQ type so toggling away and back restores inputs.
    questionTypeCacheRef.current.set(draftQuestionId, {
      mcq: {
        options: buildInitialForm().options,
        explanations: buildInitialForm().explanations,
      },
      trueFalse: resetOptionsForType('trueFalse'),
    });
    setExpandedGroups((prev) => new Set([...prev, groupId]));
    setSelected({ groupId, questionId: draftQuestionId, variantId: null });
    setForm(buildInitialForm());
    setSaveError(null);
  };

  const handleAddVariant = (groupId: string, questionId: string) => {
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
          ? `Save ${lastVariant.label} before creating another variant.`
          : 'Save the core question before creating variants.',
      );
      return;
    }
    const nextLabel = question ? `Variant ${question.variants.length + 1} (draft)` : 'Variant (draft)';
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
                          label: nextLabel,
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
    const numericGroupId = Number(targetGroupId);
    if (!Number.isFinite(numericGroupId)) {
      setSaveError('Save or choose an existing question group before saving questions.');
      return;
    }
    const targetQuestion = targetGroup.questions.find((q) => q.id === selected.questionId);
    if (!targetQuestion) {
      setSaveError('Pick a question to save.');
      return;
    }
    // Prevent saving a variant when the parent is still draft; enforce core-first save order.
    const correctIndex = form.options.findIndex((opt) => opt.isCorrect);
    if (correctIndex === -1) {
      setSaveError('Select which option is correct before saving.');
      return;
    }

    const payload =
      form.type === 'mcq'
        ? ({
            questionGroupId: numericGroupId,
            title: targetQuestion.title,
            questionStem: form.stem,
            questionType: 'mcq',
            questionData: {
              options: buildMcqOptions(),
              correctOptionIndex: correctIndex,
            } satisfies mcqQuestionDto,
            hint: form.hint,
            difficultyScore: 0,
            source: 'author',
            status: 'draft',
        } as const)
        : ({
            questionGroupId: numericGroupId,
            title: targetQuestion.title,
            questionStem: form.stem,
            questionType: 'trueFalse',
            questionData: {
              options: buildTrueFalseOptions(),
              correctOptionIndex: Math.min(correctIndex, 1),
            } satisfies TrueFalseQuestionDto,
            hint: form.hint,
            difficultyScore: 0,
            source: 'author',
            status: 'draft',
          } as const);

    setIsSavingQuestion(true);
    if (selected.variantId) {
      setIsSavingVariant(true);
    }
    setSaveError(null);
    try {
      let persistedQuestionId = targetQuestion.id;
      let persistedCoreContentId = targetQuestion.coreContent?.id ?? null;
      let persistedTitle = targetQuestion.title;

      if (targetQuestion.isDraft) {
        // Persist the draft question before handling variants to guarantee a server id.
        const created = await createQuestionForUnit(parsedModuleId, parsedUnitId, payload);
        persistedQuestionId = String(created.questionUnit.id);
        persistedCoreContentId = String(created.coreContent.id);
        persistedTitle = created.questionUnit.title.replace(/\s+\(draft\)$/i, '');
        setGroups((prev) =>
          prev.map((group) =>
            group.id === targetGroupId
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
                            questionData: payload.questionData as Record<string, unknown>,
                            type: payload.questionType,
                            hint: payload.hint ?? null,
                            difficultyScore: payload.difficultyScore,
                            source: payload.source,
                            status: payload.status,
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
            ? { ...prev, questionId: persistedQuestionId }
            : { groupId: targetGroupId, questionId: persistedQuestionId, variantId: selected.variantId },
        );
      }

      if (selected.variantId) {
        // Save or update the selected variant.
        const variant = targetQuestion.variants.find((v) => v.id === selected.variantId);
        if (!variant) {
          setSaveError('Variant not found.');
          return;
        }

        if (variant.isDraft || !variant.content) {
          // Draft variants are created only when the user explicitly saves.
          const variantPayload =
            form.type === 'mcq'
              ? ({
                  variantLabel: (variant.label ?? 'Variant').replace(/\s+\(draft\)$/i, ''),
                  questionStem: form.stem,
                  questionType: 'mcq',
                  questionData: {
                    options: buildMcqOptions(),
                    correctOptionIndex: correctIndex,
                  } satisfies mcqQuestionDto,
                  hint: form.hint,
                  difficultyScore: 0,
                  source: 'author',
                  status: 'draft',
                } as const)
              : ({
                  variantLabel: (variant.label ?? 'Variant').replace(/\s+\(draft\)$/i, ''),
                  questionStem: form.stem,
                  questionType: 'trueFalse',
                  questionData: {
                    options: buildTrueFalseOptions(),
                    correctOptionIndex: Math.min(correctIndex, 1),
                  } satisfies TrueFalseQuestionDto,
                  hint: form.hint,
                  difficultyScore: 0,
                  source: 'author',
                  status: 'draft',
                } as const);

          const createdVariant = await createVariantForQuestion(
            parsedModuleId,
            parsedUnitId,
            Number(persistedQuestionId),
            variantPayload,
          );

          setGroups((prev) =>
            prev.map((group) =>
              group.id === targetGroupId
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
                                    label: variantPayload.variantLabel,
                                    isDraft: false,
                                    content: {
                                      id: String(createdVariant.variant.content.id),
                                      questionUnitId: String(createdVariant.variant.content.questionUnitId ?? persistedQuestionId),
                                      questionStem: createdVariant.variant.content.questionStem,
                                      questionData: createdVariant.variant.content.questionData as Record<string, unknown>,
                                      type: createdVariant.variant.content.type,
                                      hint: createdVariant.variant.content.hint ?? null,
                                      difficultyScore: createdVariant.variant.content.difficultyScore ?? 0,
                                      source: createdVariant.variant.content.source ?? 'author',
                                      status: createdVariant.variant.content.status ?? 'draft',
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

          setSelected({ groupId: targetGroupId, questionId: persistedQuestionId, variantId: String(createdVariant.variant.id) });
          clearOppositeTypeCache(`${persistedQuestionId}-variant-${createdVariant.variant.id}`, payload.questionType as QuestionType);
        } else {
          await updateQuestionContentScoped(
            parsedModuleId,
            parsedUnitId,
            Number(persistedQuestionId),
            Number(variant.content.id),
            {
              questionStem: payload.questionStem,
              questionData: payload.questionData as Record<string, unknown>,
              type: payload.questionType,
              hint: payload.hint,
              difficultyScore: payload.difficultyScore,
              source: payload.source,
              status: payload.status,
            },
          );
          setGroups((prev) =>
            prev.map((group) =>
              group.id === targetGroupId
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
                                        questionData: {},
                                        type: payload.questionType,
                                        hint: null,
                                        difficultyScore: payload.difficultyScore,
                                        source: payload.source,
                                        status: payload.status,
                                      }),
                                      questionStem: payload.questionStem,
                                      questionData: payload.questionData as Record<string, unknown>,
                                      type: payload.questionType,
                                      hint: payload.hint ?? null,
                                      difficultyScore: payload.difficultyScore,
                                      source: payload.source,
                                      status: payload.status,
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
          clearOppositeTypeCache(`${persistedQuestionId}-variant-${selected.variantId}`, payload.questionType as QuestionType);
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
        await updateQuestionContentScoped(
          parsedModuleId,
          parsedUnitId,
          Number(persistedQuestionId),
          Number(persistedCoreContentId),
          {
            questionStem: payload.questionStem,
            questionData: payload.questionData as Record<string, unknown>,
            type: payload.questionType,
            hint: payload.hint,
            difficultyScore: payload.difficultyScore,
            source: payload.source,
            status: payload.status,
          },
        );
        setGroups((prev) =>
          prev.map((group) =>
            group.id === targetGroupId
              ? {
                  ...group,
                  questions: group.questions.map((q) =>
                      q.id === persistedQuestionId || q.id === targetQuestion.id
                        ? {
                            ...q,
                            coreContent: {
                              ...(q.coreContent ?? { id: persistedCoreContentId, questionUnitId: persistedQuestionId }),
                              questionStem: payload.questionStem,
                              questionData: payload.questionData,
                              type: payload.questionType,
                              hint: payload.hint ?? null,
                              difficultyScore: payload.difficultyScore,
                              source: payload.source,
                              status: payload.status,
                            },
                          }
                        : q,
                  ),
                }
              : group,
          ),
        );
        clearOppositeTypeCache(`${persistedQuestionId}-core`, payload.questionType as QuestionType);
      }
    } catch (err) {
      setSaveError('Could not save the question. Please try again.');
      logError(err, { feature: 'question', action: 'save', unitId: parsedUnitId });
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
        const unit = await getModuleUnitEditor(parsedModuleId, parsedUnitId);
        if (cancelled) return;
        setUnitTitle(unit.title);
        setVariantInstructions(unit.variantContext ?? '');
        const mappedGroups = (unit.questionGroups ?? []).map((g) => {
          const questions = (g.questions ?? []).map((q) => ({
            id: String(q.id),
            title: q.title,
            type: (q.type === 'trueFalse' ? 'trueFalse' : 'mcq') as QuestionType,
            variants: (q.variants ?? []).map((v) => ({
              id: String(v.id),
              label: v.variantLabel,
              content: v.content
                ? {
                    id: String(v.content.id),
                    questionUnitId: String(v.content.questionUnitId ?? q.id),
                    questionStem: v.content.questionStem,
                    questionData: v.content.questionData,
                    type: v.content.type,
                    hint: v.content.hint ?? null,
                    difficultyScore: v.content.difficultyScore ?? 0,
                    source: v.content.source ?? 'author',
                    status: v.content.status ?? 'draft',
                  }
                : undefined,
            })),
            coreContent: q.coreContent
              ? {
                  id: String(q.coreContent.id),
                  questionUnitId: String(q.coreContent.questionUnitId),
                  questionStem: q.coreContent.questionStem,
                  questionData: q.coreContent.questionData,
                  type: q.coreContent.type,
                  hint: q.coreContent.hint ?? null,
                  difficultyScore: q.coreContent.difficultyScore ?? 0,
                  source: q.coreContent.source ?? 'author',
                  status: q.coreContent.status ?? 'draft',
                }
              : undefined,
          }));
          // Seed per-group counters based on existing questions.
          groupQuestionCountersRef.current.set(String(g.id), questions.length + 1);
          return {
            id: String(g.id),
            title: g.name,
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
        <div className={styles.statusCard} role="alert">
          Module unit not found.
        </div>
      </MainSection>
    );
  }

  return (
    <MainSection className={styles.page}>
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
            <button type="button" className={styles.saveButton}>
              Save
            </button>
          </div>

          <div className={styles.grid}>
            <div className={styles.leftColumn}>
              <div className={styles.sectionHeader}>
                <h2>Questions</h2>
              </div>

              {groups.map((group) => (
                <div key={group.id} className={styles.groupCard}>
                  <button
                    type="button"
                    className={styles.groupHeader}
                    onClick={() => handleToggleGroup(group.id)}
                  >
                    {editingGroupId === group.id ? (
                      <input
                        type="text"
                        value={group.title}
                        onChange={(e) => handleUpdateGroupTitle(group.id, e.target.value)}
                        onBlur={() => setEditingGroupId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingGroupId(null);
                        }}
                        className={styles.groupTitleInput}
                        autoFocus
                      />
                    ) : (
                      <h3 onClick={(e) => { e.stopPropagation(); setEditingGroupId(group.id); }}>{group.title}</h3>
                    )}
                    <span className={styles.expandIcon}>
                      {expandedGroups.has(group.id) ? '▼' : '▶'}
                    </span>
                  </button>
                  {expandedGroups.has(group.id) && (
                    <div className={styles.questionList}>
                      {group.questions.map((question) => {
                        const isSelected = selected?.groupId === group.id && selected?.questionId === question.id;
                        const isVariantSelected = Boolean(isSelected && selected?.variantId);
                        const allowNewVariant = canAddVariant(question);
                        return (
                          <div key={question.id} className={styles.questionItem}>
                            <button
                              type="button"
                              className={`${styles.questionBlock} ${isSelected ? styles.selected : ''} ${isVariantSelected ? styles.variantSelected : ''}`}
                              onClick={() => setSelected({ groupId: group.id, questionId: question.id, variantId: null })}
                            >
                              <span className={styles.questionLabel}>{question.title}</span>
                              <span className={styles.questionType}>{question.type === 'mcq' ? 'MCQ' : 'True/False'}</span>
                            </button>
                            <div className={styles.variantList}>
                              {question.variants.map((variant) => (
                                <button
                                  key={variant.id}
                                  type="button"
                                  className={`${styles.variantBlock} ${selected?.questionId === question.id ? styles.selectedVariant : ''} ${selected?.variantId === variant.id ? styles.selectedVariantFull : ''}`}
                                  onClick={() => setSelected({ groupId: group.id, questionId: question.id, variantId: variant.id })}
                                >
                                  {variant.label}
                                </button>
                              ))}
                              <button
                                type="button"
                                className={styles.addVariantButton}
                                onClick={() => handleAddVariant(group.id, question.id)}
                                aria-label="Add variant"
                                disabled={isSavingVariant || !allowNewVariant}
                              >
                                <div className={styles.addVariantIcon}>+</div>
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
                        disabled={!allowNewQuestion}
                      >
                        <div className={styles.addQuestionIcon}>+</div>
                        Add Question
                      </button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}

              <button type="button" className={styles.addGroup} onClick={handleAddGroup}>
                <div className={styles.addGroupIcon}>+</div>
                New Group
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
                    ◀
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
                    ▶
                  </button>
                </div>
              ) : (
                <div className={styles.editingMeta}>
                  <span className={styles.editingLabel}>Pick a question to edit</span>
                </div>
              )}
              </div>
              <div className={styles.typeToggle}>
                <button
                  type="button"
                  className={`${styles.typeChip} ${form.type === 'mcq' ? styles.typeChipActive : ''}`}
                  onClick={() => handleTypeChange('mcq')}
                >
                  Multiple Choice
                </button>
                <button
                  type="button"
                  className={`${styles.typeChip} ${form.type === 'trueFalse' ? styles.typeChipActive : ''}`}
                  onClick={() => handleTypeChange('trueFalse')}
                >
                  True/False
                </button>
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

              {form.type === 'mcq' ? (
                <McqForm
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
              ) : (
                <TrueFalseForm
                  options={form.options.slice(0, 2).map((opt, idx) => ({
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
              )}

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
            <button type="button" className={styles.secondaryButton}>
              Generate Variant
            </button>
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
    </MainSection>
  );
}
