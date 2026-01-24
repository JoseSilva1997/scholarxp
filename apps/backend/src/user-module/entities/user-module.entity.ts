import { EnrollmentSource } from '@prisma/client';

export class UserModule {
  id: number;
  moduleId: number;
  userId: number;
  roleInModule: string;
  userModuleLevel: number;
  currentExp: number;
  enrolledVia: EnrollmentSource;
  createdAt: Date;
}
