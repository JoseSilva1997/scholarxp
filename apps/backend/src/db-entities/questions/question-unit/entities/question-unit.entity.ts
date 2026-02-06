export class QuestionUnit {
  id: number;
  moduleUnitId: number | null;
  questionGroupId: number | null;
  title: string;
  // Mirrors persistence-level archive state so selection logic can exclude archived questions.
  isArchived: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
