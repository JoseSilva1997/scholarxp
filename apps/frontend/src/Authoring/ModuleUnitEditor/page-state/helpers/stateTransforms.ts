// Centralizes immutable module-unit-editor state transforms so page-state hooks reuse one behavior model.
import type { Question, QuestionGroup, SelectionState, Variant } from '@/Authoring/ModuleUnitEditor/page-state/helpers/types';

type QuestionUpdater = (question: Question) => Question;

// Updates one group immutably while preserving group order and references for untouched groups.
export const updateGroupById = (
  groups: QuestionGroup[],
  groupId: string,
  updater: (group: QuestionGroup) => QuestionGroup,
) => groups.map((group) => (group.id === groupId ? updater(group) : group));

// Updates questions matching a predicate inside one group; useful when persisted and draft ids differ.
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

// Updates a known set of question ids by converting lookup to a Set for repeated checks.
export const updateQuestionByIds = (
  groups: QuestionGroup[],
  groupId: string,
  questionIds: string[],
  updater: QuestionUpdater,
) => {
  const idSet = new Set(questionIds);
  return updateQuestionByPredicate(groups, groupId, (question) => idSet.has(question.id), updater);
};

// Updates one variant immutably within a question while preserving other variants.
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

// Replaces a local draft group id with the persisted backend id after save.
export const replaceDraftGroupId = (
  groups: QuestionGroup[],
  targetGroupId: string,
  persistedGroupId: string,
) =>
  updateGroupById(groups, targetGroupId, (group) => ({ ...group, id: persistedGroupId }));

// Appends a locally drafted question to the selected group before it is persisted.
export const appendDraftQuestionToGroup = (
  groups: QuestionGroup[],
  groupId: string,
  question: Question,
) =>
  updateGroupById(groups, groupId, (group) => ({
    ...group,
    questions: [...group.questions, question],
  }));

// Appends a locally drafted variant to a question before it is persisted.
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

// Removes a group from local editor state after deletion or draft cancellation.
export const removeQuestionGroup = (groups: QuestionGroup[], groupId: string) =>
  groups.filter((group) => group.id !== groupId);

// Removes a question from a specific group while leaving other groups untouched.
export const removeQuestionFromGroup = (
  groups: QuestionGroup[],
  groupId: string,
  questionId: string,
) =>
  updateGroupById(groups, groupId, (group) => ({
    ...group,
    questions: group.questions.filter((question) => question.id !== questionId),
  }));

// Removes one variant from a specific question without changing the core question content.
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

// Chooses the next valid editor selection after deleting the currently selected item.
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
