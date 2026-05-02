// A single question within a module unit. A question unit acts as a container linking a title,
// a group, and one or more content records (one core content plus optional variants).
export class QuestionUnit {
  id: number;
  moduleUnitId: number | null;
  questionGroupId: number | null;
  title: string;
  // Soft-delete flag. Set instead of hard-deleting when the unit is live or has existing attempts,
  // so historical attempt records remain historically valid.
  isArchived: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
