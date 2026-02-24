// Ensures question-type registry helpers keep authoring defaults, payload mapping, and validation stable.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUESTION_TYPE,
  emptyMcqTemplate,
} from '@scholarxp/question-type-dtos';
import {
  QUESTION_TYPE_CONFIGS,
  normalizeQuestionType,
  type QuestionForm,
} from './QuestionTypeRegistry';

function buildBaseForm(overrides: Partial<QuestionForm> = {}): QuestionForm {
  const template = emptyMcqTemplate();
  return {
    stem: 'Sample stem',
    type: DEFAULT_QUESTION_TYPE,
    options: template.options.map((option, index) => ({
      id: `opt-${index}`,
      value: option.optionText,
      isCorrect: index === 0,
    })),
    // Normalize optional explanations to string because the form model expects concrete text values.
    explanations: template.options.map((option) => option.explanation ?? ''),
    hint: 'hint',
    ...overrides,
  };
}

describe('QuestionTypeRegistry', () => {
  it('normalizes unknown and missing types to the shared default', () => {
    expect(normalizeQuestionType(undefined)).toBe(DEFAULT_QUESTION_TYPE);
    expect(normalizeQuestionType('unknown-type')).toBe(DEFAULT_QUESTION_TYPE);
    expect(normalizeQuestionType('mcq')).toBe('mcq');
  });

  it('builds MCQ question data from editor form state', () => {
    const form = buildBaseForm({
      options: [
        { id: 'a', value: 'A', isCorrect: false },
        { id: 'b', value: 'B', isCorrect: true },
        { id: 'c', value: 'C', isCorrect: false },
      ],
      explanations: ['EA', 'EB', 'EC'],
    });

    const payload = QUESTION_TYPE_CONFIGS.mcq.buildQuestionData(form);

    if (!('correctOptionIndex' in payload) || !('options' in payload)) {
      throw new Error('Expected MCQ payload shape');
    }

    expect(payload.correctOptionIndex).toBe(1);
    expect(payload.options).toEqual([
      { optionText: 'A', explanation: 'EA' },
      { optionText: 'B', explanation: 'EB' },
      { optionText: 'C', explanation: 'EC' },
    ]);
  });

  it('rejects MCQ save when no option is marked correct', () => {
    const template = emptyMcqTemplate();
    const form = buildBaseForm({
      options: template.options.map((_option, index) => ({
        id: `o-${index}`,
        value: `Option ${index + 1}`,
        isCorrect: false,
      })),
      explanations: template.options.map((_option, index) => `Explanation ${index + 1}`),
    });

    const error = QUESTION_TYPE_CONFIGS.mcq.validate(form);

    expect(error).toBe('Please select a correct option');
  });

  it('builds true/false payload as explicit true and false branches', () => {
    const form = buildBaseForm({
      type: 'true-false',
      options: [
        { id: 'a', value: 'True', isCorrect: false },
        { id: 'b', value: 'False', isCorrect: true },
        { id: 'c', value: 'Extra', isCorrect: true },
      ],
      explanations: ['ET', 'EF', 'EX'],
    });

    const payload = QUESTION_TYPE_CONFIGS['true-false'].buildQuestionData(form);

    if (!('trueOption' in payload) || !('falseOption' in payload)) {
      throw new Error('Expected true/false payload shape');
    }

    expect(payload.trueOption).toEqual({ isCorrect: false, explanation: 'ET' });
    expect(payload.falseOption).toEqual({ isCorrect: true, explanation: 'EF' });
  });
});
