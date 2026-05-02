// Records a user's enrollment in a module. Students have a separate module-level XP and level
// progression distinct from their global avatar XP, tracking achievement within each module independently.
import { EnrollmentSource } from '@prisma/client';

export class UserModule {
  id: number;
  moduleId: number;
  userId: number;
  // 'student' or 'teacher'; determines which capabilities the user has within this module.
  roleInModule: string;
  // Module-scoped level; increments as currentExp crosses MODULE_UNIT_BASELINE_EXP thresholds.
  userModuleLevel: number;
  // XP accumulated within the current level; resets to the remainder after each level-up.
  currentExp: number;
  // Records how the student was enrolled (e.g., invite link vs. direct admin enrolment).
  enrolledVia: EnrollmentSource;
  createdAt: Date;
}
