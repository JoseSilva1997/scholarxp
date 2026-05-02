// The actual renderable content for a question unit. Each question unit has exactly one core content
// row (isCore=true) and zero or more variant content rows. The questionData JSON shape is
// determined by the `type` field and validated on write using the shared QuestionDataSchema.
import type { QuestionData } from '@scholarxp/question-type-dtos';

export class QuestionContent {
  id: number;
  type: string;
  questionStem: string;
  // Type-specific payload (e.g., options for MCQ, blanks for fill-in). Validated by QuestionDataSchema.
  questionData: QuestionData;
  questionUnitId: number;
  // True for the canonical content row; false for variant alternatives.
  isCore: boolean;
  hint: string | null;
  source: string;
  // Soft-delete flag; archived content is excluded from question selection and student views.
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
