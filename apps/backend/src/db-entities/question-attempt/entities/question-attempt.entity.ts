// Records a single question attempt made during a practice session. The studentAnswer field
// is an untyped JSON blob whose shape is determined by the question type at runtime.
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
