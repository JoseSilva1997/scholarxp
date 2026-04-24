// Computes option-level feedback state for submitted practice answers so rendering can stay declarative and swappable.
import type { PracticeQuestion } from '@scholarxp/api-contracts';

export type PracticeOptionFeedback = {
  isCorrectOption: boolean;
  isSelected: boolean;
  isSelectedIncorrect: boolean;
  statusLabel: 'Correct' | 'Incorrect' | null;
  explanation: string | null;
};

type BuildPracticeRoomAnswerFeedbackParams = {
  question: PracticeQuestion;
  selectedOptionIndex: number | null;
  hasSubmitted: boolean;
  optionCount: number;
};

// This helper centralizes presentation-only grading feedback so we can later replace it with backend-provided feedback.
export function buildPracticeRoomAnswerFeedback({
  question,
  selectedOptionIndex,
  hasSubmitted,
  optionCount,
}: BuildPracticeRoomAnswerFeedbackParams): PracticeOptionFeedback[] {
  const feedback = Array.from({ length: optionCount }, (_, optionIndex) => ({
    isCorrectOption: false,
    isSelected: selectedOptionIndex === optionIndex,
    isSelectedIncorrect: false,
    statusLabel: null,
    explanation: null,
  }));

  if (!hasSubmitted) {
    return feedback;
  }

  if (question.type === 'mcq') {
    return applyMcqFeedback(feedback, question, selectedOptionIndex);
  }

  if (question.type === 'true-false') {
    return applyTrueFalseFeedback(feedback, question, selectedOptionIndex);
  }

  return feedback;
}

// MCQ feedback uses saved option explanations and the configured correct-option index.
function applyMcqFeedback(
  baseFeedback: PracticeOptionFeedback[],
  question: PracticeQuestion,
  selectedOptionIndex: number | null,
): PracticeOptionFeedback[] {
  if (!question.questionData || typeof question.questionData !== 'object') {
    return baseFeedback;
  }

  const candidate = question.questionData as {
    correctOptionIndex: unknown;
    options?: Array<{ explanation?: string }>;
  };
  if (typeof candidate.correctOptionIndex !== 'number') {
    return baseFeedback;
  }

  const correctOptionIndex = candidate.correctOptionIndex as number;
  const options = candidate.options;
  const selectedIsCorrect = selectedOptionIndex === correctOptionIndex;

  return baseFeedback.map((entry, optionIndex) => {
    const isSelected = selectedOptionIndex === optionIndex;
    const isSelectedIncorrect = isSelected && !selectedIsCorrect;
    const explanationSource = options?.[optionIndex];
    const explanation =
      isSelected && (selectedIsCorrect || isSelectedIncorrect)
        ? explanationSource?.explanation ?? null
        : null;
    const statusLabel = isSelected
      ? selectedIsCorrect
        ? 'Correct'
        : 'Incorrect'
      : null;

    return {
      ...entry,
      // Core-only feedback intentionally does not reveal the correct option when the student is incorrect.
      isCorrectOption: isSelected && selectedIsCorrect,
      isSelected,
      isSelectedIncorrect,
      statusLabel,
      explanation,
    };
  });
}

// True/false feedback maps the fixed pair of options to their configured correctness/explanations.
function applyTrueFalseFeedback(
  baseFeedback: PracticeOptionFeedback[],
  question: PracticeQuestion,
  selectedOptionIndex: number | null,
): PracticeOptionFeedback[] {
  if (!question.questionData || typeof question.questionData !== 'object') {
    return baseFeedback;
  }

  const candidate = question.questionData as {
    trueOption: { isCorrect: unknown; explanation?: unknown };
    falseOption: { isCorrect: unknown; explanation?: unknown };
  };
  if (
    !candidate.trueOption ||
    typeof candidate.trueOption.isCorrect !== 'boolean' ||
    !candidate.falseOption ||
    typeof candidate.falseOption.isCorrect !== 'boolean'
  ) {
    return baseFeedback;
  }

  const trueOptionIsCorrect = candidate.trueOption.isCorrect as boolean;
  const falseOptionIsCorrect = candidate.falseOption.isCorrect as boolean;
  const trueOptionExplanation = candidate.trueOption.explanation;
  const falseOptionExplanation = candidate.falseOption.explanation;
  const selectedIsCorrect =
    selectedOptionIndex === 0
      ? trueOptionIsCorrect
      : selectedOptionIndex === 1
        ? falseOptionIsCorrect
        : false;

  return baseFeedback.map((entry, optionIndex) => {
    const isSelected = selectedOptionIndex === optionIndex;
    const isSelectedIncorrect = isSelected && !selectedIsCorrect;
    const explanationCandidate =
      optionIndex === 0 ? trueOptionExplanation : falseOptionExplanation;
    const explanation =
      isSelected && (selectedIsCorrect || isSelectedIncorrect)
        ? typeof explanationCandidate === 'string'
          ? explanationCandidate
          : null
        : null;
    const statusLabel = isSelected
      ? selectedIsCorrect
        ? 'Correct'
        : 'Incorrect'
      : null;

    return {
      ...entry,
      // Core-only feedback intentionally does not reveal the correct option when the student is incorrect.
      isCorrectOption: isSelected && selectedIsCorrect,
      isSelected,
      isSelectedIncorrect,
      statusLabel,
      explanation,
    };
  });
}
