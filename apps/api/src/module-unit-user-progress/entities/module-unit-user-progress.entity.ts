export class ModuleUnitUserProgress {
  id: number;
  moduleUnitId: number;
  studentId: number;
  currentMasteryScore: number;
  isCompleted: boolean;
  noOfCorrectAnswers: number;
  completedAt: Date | null;
  lastPracticedAt: Date | null;
}
