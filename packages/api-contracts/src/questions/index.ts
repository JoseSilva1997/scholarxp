/**
 * Shared API interfaces for Question related operations.
 */
import type { QuestionData, questionType } from '@scholarxp/question-type-dtos';

/**
 * Supported sources for question content.
 */
export type QuestionSource = 'human' | 'ai-generated';

/**
 * Base structure for any question content (core or variant).
 */
export interface QuestionContentPayload {
  questionStem: string;
  type: questionType;
  questionData: QuestionData;
  hint?: string | null;
  difficultyScore: number;
  source: QuestionSource;
  status: string;
}

/**
 * Payload for creating a new question unit along with its initial content.
 */
export interface CreateQuestionPayload extends QuestionContentPayload {
  questionGroupId?: number;
  title: string;
}

/**
 * Payload for creating a new variant for an existing question.
 */
export interface CreateVariantPayload extends QuestionContentPayload {
  variantLabel: string;
}

/**
 * Standard response structure for question content.
 */
export interface QuestionContentResponse {
  id: number;
  questionUnitId: number;
  questionStem: string;
  questionData: QuestionData;
  type: string;
  hint: string | null;
  difficultyScore: number;
  source: QuestionSource;
  status: string;
}

/**
 * Standard response structure for a Question Unit.
 */
export interface QuestionUnitResponse {
  id: number;
  moduleUnitId: number | null;
  questionGroupId: number | null;
  title: string;
}
