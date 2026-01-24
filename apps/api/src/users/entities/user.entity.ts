import { GlobalRole } from '@prisma/client';

export class User {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  globalRole: GlobalRole;
  createdAt: Date;
}
