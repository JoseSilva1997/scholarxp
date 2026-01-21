import { GlobalRole } from '@prisma/client';

export class User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  globalRole: GlobalRole;
  createdAt: Date;
}
