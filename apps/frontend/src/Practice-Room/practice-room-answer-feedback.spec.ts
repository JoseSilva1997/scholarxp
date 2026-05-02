// Verifies presentation-only answer feedback mapping for MCQ and true/false practice questions.
import { describe, expect, it } from 'vitest';
import type { PracticeQuestion } from '@scholarxp/api-contracts';
import { buildPracticeRoomAnswerFeedback } from '@/Practice-Room/practice-room-answer-feedback';

function buildMcqQuestion(): PracticeQuestion {
  return {
    id: 1,
    type: 'mcq',
    questionStem: 'MCQ?',
    questionData: {
      options: [
        { optionText: 'A', explanation: 'Because A' },
        { optionText: 'B', explanation: 'Because B' },
        { optionText: 'C', explanation: 'Because C' },
        { optionText: 'D', explanation: 'Because D' },
      ],
      correctOptionIndex: 2,
    },
    hint: null,
  };
}

function buildTrueFalseQuestion(): PracticeQuestion {
  return {
    id: 2,
    type: 'true-false',
    questionStem: 'TF?',
    questionData: {
      trueOption: { isCorrect: true, explanation: 'True explanation' },
      falseOption: { isCorrect: false, explanation: 'False explanation' },
    },
    hint: null,
  };
}

describe('buildPracticeRoomAnswerFeedback', () => {
  it('returns neutral state when question is not submitted', () => {
    const feedback = buildPracticeRoomAnswerFeedback({
      question: buildMcqQuestion(),
      selectedOptionIndex: 1,
      hasSubmitted: false,
      optionCount: 4,
    });

    expect(feedback.every((entry) => entry.statusLabel === null)).toBe(true);
    expect(feedback.every((entry) => entry.explanation === null)).toBe(true);
  });

  it('marks only the selected incorrect MCQ option after submit', () => {
    const feedback = buildPracticeRoomAnswerFeedback({
      question: buildMcqQuestion(),
      selectedOptionIndex: 1,
      hasSubmitted: true,
      optionCount: 4,
    });

    expect(feedback[2]).toMatchObject({
      isCorrectOption: false,
      statusLabel: null,
      explanation: null,
    });
    expect(feedback[1]).toMatchObject({
      isSelectedIncorrect: true,
      statusLabel: 'Incorrect',
      explanation: 'Because B',
    });
  });

  it('marks selected correct true/false option after submit', () => {
    const feedback = buildPracticeRoomAnswerFeedback({
      question: buildTrueFalseQuestion(),
      selectedOptionIndex: 0,
      hasSubmitted: true,
      optionCount: 2,
    });

    expect(feedback[0]).toMatchObject({
      isCorrectOption: true,
      statusLabel: 'Correct',
      explanation: 'True explanation',
    });
    expect(feedback[1].statusLabel).toBeNull();
  });

  it('marks selected incorrect true/false option after submit', () => {
    const feedback = buildPracticeRoomAnswerFeedback({
      question: buildTrueFalseQuestion(),
      selectedOptionIndex: 1,
      hasSubmitted: true,
      optionCount: 2,
    });

    expect(feedback[0]).toMatchObject({
      isCorrectOption: false,
      statusLabel: null,
      explanation: null,
    });
    expect(feedback[1]).toMatchObject({
      isSelectedIncorrect: true,
      statusLabel: 'Incorrect',
      explanation: 'False explanation',
    });
  });
});
