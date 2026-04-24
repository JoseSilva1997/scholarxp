// Centralizes immutable module-unit-editor state transforms so page-state hooks reuse one behavior model.
import type { Question, QuestionGroup, SelectionState, Variant } from '@/Authoring/ModuleUnitEditor/page-state/helpers/types';

type QuestionUpdater = (question: Question) => Question;

export const updateGroupById = (
  groups: QuestionGroup[],
  groupId: string,
  updater: (group: QuestionGroup) => QuestionGroup,
) => groups.map((group) => (group.id === groupId ? updater(group) : group));

export const updateQuestionByPredicate = (
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

export const updateQuestionByIds = (
  groups: QuestionGroup[],
  groupId: string,
  questionIds: string[],
  updater: QuestionUpdater,
) => {
  const idSet = new Set(questionIds);
  return updateQuestionByPredicate(groups, groupId, (question) => idSet.has(question.id), updater);
};

export const updateVariantById = (
  question: Question,
  variantId: string,
  updater: (variant: Variant) => Variant,
): Question => ({
  ...question,
  variants: question.variants.map((variant) =>
    variant.id === variantId ? updater(variant) : variant,
  ),
});

export const replaceDraftGroupId = (
  groups: QuestionGroup[],
  targetGroupId: string,
  persistedGroupId: string,
) =>
  updateGroupById(groups, targetGroupId, (group) => ({ ...group, id: persistedGroupId }));

export const appendDraftQuestionToGroup = (
  groups: QuestionGroup[],
  groupId: string,
  question: Question,
) =>
  updateGroupById(groups, groupId, (group) => ({
    ...group,
    questions: [...group.questions, question],
  }));

export const appendDraftVariantToQuestion = (
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

export const removeQuestionGroup = (groups: QuestionGroup[], groupId: string) =>
  groups.filter((group) => group.id !== groupId);

export const removeQuestionFromGroup = (
  groups: QuestionGroup[],
  groupId: string,
  questionId: string,
) =>
  updateGroupById(groups, groupId, (group) => ({
    ...group,
    questions: group.questions.filter((question) => question.id !== questionId),
  }));

export const removeVariantFromQuestion = (
  groups: QuestionGroup[],
  groupId: string,
  questionId: string,
  variantId: string,
) =>
  updateQuestionByPredicate(
    groups,
    groupId,
    (question) => question.id === questionId,
    (question) => ({
      ...question,
      variants: question.variants.filter((variant) => variant.id !== variantId),
    }),
  );

export const computeFallbackSelection = (
  nextGroups: QuestionGroup[],
): SelectionState | null => {
  // Fall back to the first remaining question to keep the editor focused on a valid target.
  for (const group of nextGroups) {
    const firstQuestion = group.questions[0];
    if (firstQuestion) {
      return { groupId: group.id, questionId: firstQuestion.id, variantId: null };
    }
  }
  return null;
};
