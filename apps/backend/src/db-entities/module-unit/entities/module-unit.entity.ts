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
