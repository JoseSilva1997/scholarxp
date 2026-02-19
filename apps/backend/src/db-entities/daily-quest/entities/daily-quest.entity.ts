export class DailyQuest {
  id: number;
  moduleId: number;
  // Null when this quest targets a module as a whole instead of a single lesson.
  moduleUnitId: number | null;
  userId: number;
  type: string;
  expGranted: number;
  isCompleted: boolean;
  // Stores the canonical UTC day this quest belongs to.
  questDateUtc: Date;
  generatedAt: Date;
  // Remains null until the quest is completed.
  completedAt: Date | null;
}
