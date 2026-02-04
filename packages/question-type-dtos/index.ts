export * from './mcq';
export * from './true-false';

import type { McqQuestionDto } from './mcq';
import type { TrueFalseQuestionDto } from './true-false';

/**
 * Union type for all supported question data structures.
 * Use this to type the 'questionData' field in DTOs and database models.
 */
export type QuestionData = McqQuestionDto | TrueFalseQuestionDto;

/**
 * Runtime array of all supported question types.
 * Use this for validation (e.g. class-validator IsIn).
 */
export const QUESTION_TYPES = ['mcq', 'true-false'] as const;

export type questionType = (typeof QUESTION_TYPES)[number];

/**
 * Default fallback question type for new or unknown content.
 */
export const DEFAULT_QUESTION_TYPE: questionType = 'mcq';
