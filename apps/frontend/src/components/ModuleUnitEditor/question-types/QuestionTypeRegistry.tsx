/**
 * Central registry for question types in the ScholarXP authoring tool.
 * This file provides a uniform interface for rendering forms, validating input, and building API payloads.
 */
import React from 'react';
import {
  DEFAULT_QUESTION_TYPE,
  McqQuestionSchema,
  TrueFalseQuestionSchema,
} from '@scholarxp/question-type-dtos';
import type { McqQuestionDto, TrueFalseQuestionDto, questionType, QuestionData } from '@scholarxp/question-type-dtos';
import { McqForm } from './forms/McqForm';
import { TrueFalseForm } from './forms/TrueFalseForm';

// Helper to keep IDs predictable for the UI session
// These are used for client-side keys and matching until content is persisted to the backend.
let nextId = 1;
export const makeId = () => `local-${nextId++}`;

export type QuestionType = questionType;

/**
 * Normalizes question type strings and provides a safe default.
 * Use this when loading content from the backend to ensure the editor state is valid.
 */
export const normalizeQuestionType = (type: string | undefined | null): QuestionType => {
  if (type && QUESTION_TYPE_CONFIGS[type as QuestionType]) {
    return type as QuestionType;
  }

  return DEFAULT_QUESTION_TYPE; // Default to shared fallback for unknown or missing types
};

/**
 * Standard props shared by all question type form components.
 */
export interface BaseQuestionFormProps {
  options: { id: string; value: string; isCorrect: boolean; explanation: string }[];
  onChangeOption: (id: string, value: string) => void;
  onChangeExplanation: (id: string, value: string) => void;
  onSelectCorrect: (id: string) => void;
  // Optional — MCQ uses this; True/False ignores it since its options are fixed.
  onDeleteOption?: (id: string) => void;
}

/**
 * Represents the internal state of the question being edited.
 */
export type QuestionForm = {
  stem: string;
  type: QuestionType;
  options: { value: string; isCorrect: boolean; id: string }[];
  explanations: string[];
  hint: string;
};

/**
 * Configuration schema for a specific question type.
 * Defining these properties allows the editor to handle any type generically.
 */
export interface QuestionTypeConfig {
  type: QuestionType;
  label: string;
  component: React.ComponentType<BaseQuestionFormProps>;
  // Generates empty options/explanations when creating a new question or switching types.
  getInitialOptions: (mcqOptionSlots: number) => { options: QuestionForm['options']; explanations: string[] };
  // Transforms the generic form state into the specific DTO expected by the backend API.
  buildQuestionData: (form: QuestionForm) => QuestionData;
  // Quality check before permitting a save; returns an error message or null if valid.
  validate: (form: QuestionForm) => string | null;
}

/**
 * The single source of truth for supported question types in the editor.
 * Adding a new type here (along with a Form component) automatically updates the Editor UI.
 */
export const QUESTION_TYPE_CONFIGS: Record<QuestionType, QuestionTypeConfig> = {
  mcq: {
    type: 'mcq',
    label: 'MCQ',
    component: McqForm,
    getInitialOptions: (slots) => ({
      // Seed with empty MCQ slots based on the provided template length.
      options: Array.from({ length: slots }, () => ({ id: makeId(), value: '', isCorrect: false })),
      explanations: Array.from({ length: slots }, () => ''),
    }),
    buildQuestionData: (form) => {
      // Map options and explanations into the McqQuestionDto structure.
      const correctIndex = form.options.findIndex((opt) => opt.isCorrect);
      return {
        options: form.options.map((opt, idx) => ({
          optionText: opt.value,
          explanation: form.explanations[idx] ?? '',
        })),
        correctOptionIndex: correctIndex,
      } as McqQuestionDto;
    },
    validate: (form) => {
      // Use shared Zod schema for structural validation.
      const payload = QUESTION_TYPE_CONFIGS.mcq.buildQuestionData(form) as McqQuestionDto;
      const result = McqQuestionSchema.safeParse(payload);
      
      if (!result.success) {
        // Map the first zod error to a user-friendly string for the simple editor UI.
        const firstError = result.error.issues[0];
        if (firstError.path.includes('options')) {
          return 'All options must have text.';
        }
        return firstError.message;
      }

      // Check for 'Select which option' manually as index 0 is valid but might be unselected.
      const correctIndex = form.options.findIndex((opt) => opt.isCorrect);
      if (correctIndex === -1) return 'Select which option is correct before saving.';

      return null;
    },
  },
  'true-false': {
    type: 'true-false',
    label: 'True/False',
    component: TrueFalseForm,
    getInitialOptions: () => ({
      // T/F uses fixed labels to keep the content model explicit and avoid free-form option text drift.
      options: [
        { id: makeId(), value: 'True', isCorrect: false },
        { id: makeId(), value: 'False', isCorrect: false },
      ],
      explanations: ['', ''],
    }),
    buildQuestionData: (form) => {
      // We read only the first two slots because the form is binary and always modeled as True/False.
      const correctIndex = form.options.findIndex((opt) => opt.isCorrect);
      return {
        trueOption: {
          isCorrect: correctIndex === 0,
          explanation: form.explanations[0] ?? '',
        },
        falseOption: {
          isCorrect: correctIndex === 1,
          explanation: form.explanations[1] ?? '',
        },
      } as TrueFalseQuestionDto;
    },
    validate: (form) => {
      // Use shared Zod schema for structural validation.
      const payload = QUESTION_TYPE_CONFIGS['true-false'].buildQuestionData(form) as TrueFalseQuestionDto;
      const result = TrueFalseQuestionSchema.safeParse(payload);
      
      if (!result.success) {
        return result.error.issues[0]?.message ?? 'Select which option is correct before saving.';
      }

      return null;
    },
  },
};
