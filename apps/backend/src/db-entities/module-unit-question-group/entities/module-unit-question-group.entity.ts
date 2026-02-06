export class ModuleUnitQuestionGroup {
  id: number;
  moduleUnitId: number;
  name: string;
  sortOrder: number;
  // Mirrors persistence-level archive state so callers can distinguish active vs hidden groups.
  isArchived: boolean;
}
