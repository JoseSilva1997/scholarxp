// Represents a shareable enrollment invite for a module. The raw token is never stored;
// only its SHA-256 hash is persisted so a leaked DB dump cannot be used to enroll new students.
import { InviteType } from '@prisma/client';

export class ModuleInvite {
  id: number;
  moduleId: number;
  createdByUserId: number;
  type: InviteType;
  // SHA-256 hash of the raw invite token. The plaintext token is returned once at creation time.
  tokenHash: string;
  // When set, only the specified email address may redeem this invite.
  emailLock: string | null;
  // Maximum number of times this invite can be redeemed; null means unlimited.
  maxUses: number | null;
  uses: number;
  expiresAt: Date | null;
  // Set when an instructor explicitly revokes the invite before expiry.
  revokedAt: Date | null;
  createdAt: Date;
}
