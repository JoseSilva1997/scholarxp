import type { QuestionData } from '@scholarxp/question-type-dtos';

export class QuestionContent {
  id: number;
  type: string;
  questionStem: string;
  questionData: QuestionData;
  questionUnitId: number;
  isCore: boolean;
  hint: string | null;
  difficultyScore: number;
  source: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
