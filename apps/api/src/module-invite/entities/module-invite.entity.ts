import { InviteType } from '@prisma/client';

export class ModuleInvite {
  id: number;
  moduleId: number;
  createdByUserId: number;
  type: InviteType;
  tokenHash: string;
  emailLock: string | null;
  maxUses: number | null;
  uses: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}
