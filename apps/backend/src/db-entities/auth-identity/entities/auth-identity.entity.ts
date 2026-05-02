// Represents a user's external authentication credential. A single user may have multiple
// auth identities (e.g., a Google identity and a local password identity simultaneously).
import { AuthProvider } from '@prisma/client';

export class AuthIdentity {
  id: number;
  userId: number;
  provider: AuthProvider;
  // The provider's own unique identifier for this user (e.g., Google's `sub` claim), not our internal ID.
  providerUserId: string;
  // May differ from the user's primary email if the provider account has its own address.
  email: string | null;
  createdAt: Date;
}
