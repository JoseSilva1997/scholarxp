export class QuestionContent {
  id: number;
  type: string;
  questionStem: string;
  questionData: Record<string, any>;
  questionUnitId: number;
  isCore: boolean;
  hint: string | null;
  difficultyScore: number;
  source: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
