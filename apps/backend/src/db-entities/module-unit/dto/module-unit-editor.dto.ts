// DTO for the module unit editor read endpoint; expanded as nested question/variant payloads are added.
export class ModuleUnitEditorDto {
  id: number;
  moduleId: number | null;
  title: string;
  variantContext: string | null;
  questionGroups: {
    id: number;
    moduleUnitId: number;
    name: string;
    sortOrder: number;
  }[];
}
