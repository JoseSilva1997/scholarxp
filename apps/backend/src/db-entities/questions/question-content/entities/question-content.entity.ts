import type { QuestionData } from '@scholarxp/question-type-dtos';

export class QuestionContent {
  id: number;
  type: string;
  questionStem: string;
  questionData: QuestionData;
  questionUnitId: number;
  isCore: boolean;
  hint: string | null;
  source: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
