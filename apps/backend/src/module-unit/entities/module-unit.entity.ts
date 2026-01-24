import { ModuleUnitStatus } from '@prisma/client';

export class ModuleUnit {
  id: number;
  moduleId: number;
  variantContext: string;
  title: string;
  questionCount: number;
  status: ModuleUnitStatus;
  sortOrder: number;
  createdAt: Date;
}
