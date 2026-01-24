export class QuestionAttempt {
  id: number;
  moduleUnitId: number;
  studentId: number;
  questionId: number;
  contentId: number;
  practiceMode: string;
  isCorrect: boolean;
  timeTakenMs: number;
  hintsUsed: number;
  studentAnswer: Record<string, any>;
  attemptedAt: Date;
}
