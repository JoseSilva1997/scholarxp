// A lesson (unit) within a module. Units have a lifecycle status (draft/live) that controls
// student visibility and governs whether deletions are hard-removed or soft-archived.
import { ModuleUnitStatus } from '@prisma/client';

export class ModuleUnit {
  id: number;
  moduleId: number;
  title: string;
  questionCount: number;
  status: ModuleUnitStatus;
  sortOrder: number;
  createdAt: Date;
}
