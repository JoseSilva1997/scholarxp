import { AuthProvider } from '@prisma/client';

export class AuthIdentity {
  id: number;
  userId: number;
  provider: AuthProvider;
  providerUserId: string;
  email: string | null;
  createdAt: Date;
}
