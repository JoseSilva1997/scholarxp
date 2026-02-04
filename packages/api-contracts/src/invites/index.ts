/**
 * Invite domain contracts for ScholarXP
 */

export interface CreateInvitePayload {
  expiresInHours?: number;
  maxUses?: number;
}

export interface UpdateInvitePayload {
  maxUses?: number;
  expiresAt?: string;
  revoke?: boolean;
}

export interface RedeemInviteResponse {
  moduleId: number;
  inviteId: number;
  enrollmentId: number;
}

export interface ModuleInviteResponse {
  id: number;
  moduleId: number;
  code: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  createdByUserId: number;
}

export interface CreateModuleInviteResponse {
  invite: ModuleInviteResponse;
  token: string;
  url: string;
}
