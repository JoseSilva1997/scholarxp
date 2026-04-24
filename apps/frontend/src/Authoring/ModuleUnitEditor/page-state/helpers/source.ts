// Centralizes question source normalization and constants for module-unit-editor flows.
import type { QuestionSource } from '@scholarxp/api-contracts';

export const SOURCE_HUMAN: QuestionSource = 'human';
export const SOURCE_AI: QuestionSource = 'ai-generated';

export const normalizeSource = (value?: string | null): QuestionSource =>
  value === SOURCE_AI ? SOURCE_AI : SOURCE_HUMAN;
