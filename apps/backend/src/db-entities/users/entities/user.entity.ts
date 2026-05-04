// Core user account record. The globalRole determines system-wide capabilities (admin/teacher/student);
// per-module roles are stored separately in UserModule for cases where the same user acts as
// a student in one module and a teacher in another.
import { GlobalRole } from '@prisma/client';

export class User {
  id: number;
  firstName: string;
  lastName: string;
  // Null for OAuth-only accounts where the provider does not expose an email.
  email: string | null;
  // System-wide role; drives capability checks across all modules.
  globalRole: GlobalRole;
  createdAt: Date;
}
