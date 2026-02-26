export class QuestionAttempt {
  id: number;
  moduleUnitId: number;
  studentId: number;
  questionId: number;
  contentId: number;
  // Session id is the canonical link to session-level origin/type metadata.
  sessionId: string;
  isCorrect: boolean;
  timeTakenMs: number;
  hintsUsed: number;
  studentAnswer: Record<string, any>;
  attemptedAt: Date;
}
