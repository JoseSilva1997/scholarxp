export class DailyQuest {
  id: number;
  moduleId: number;
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
