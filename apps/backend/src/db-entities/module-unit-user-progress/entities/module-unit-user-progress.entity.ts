// Tracks a single student's progress on a single module unit, including FSRS-derived mastery
// and the completion flag that unlocks subsequent lessons in the student view.
export class ModuleUnitUserProgress {
  id: number;
  moduleUnitId: number;
  studentId: number;
  // FSRS-derived mastery value (0–1 scale); used by the daily-practice algorithm to prioritise review.
  currentMasteryScore: number;
  // Set to true when the student has met the completion threshold for this unit.
  isCompleted: boolean;
  // Cumulative count of correct answers used to track progression toward mastery.
  noOfCorrectAnswers: number;
  completedAt: Date | null;
  lastPracticedAt: Date | null;
}
