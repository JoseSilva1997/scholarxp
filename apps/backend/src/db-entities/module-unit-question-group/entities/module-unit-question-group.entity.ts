// A named, ordered group of questions within a module unit. Groups provide authoring organisation
// and are displayed to students as labelled sections within a lesson.
export class ModuleUnitQuestionGroup {
  id: number;
  moduleUnitId: number;
  name: string;
  sortOrder: number;
  // Mirrors persistence-level archive state so callers can distinguish active vs hidden groups.
  isArchived: boolean;
}
