// Shared type for modules as returned by backend module endpoints.
export type ModuleSummary = {
  id: number;
  institutionId?: number | null;
  ltiContextId?: string | null;
  resourceLinkId?: string | null;
  variantContext?: string | null;
  title: string;
  description?: string | null;
  createdByUserId?: number | null;
};

export type ModuleInvite = {
  id: number;
  moduleId: number;
  createdByUserId: number;
  type: 'link';
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  emailLock: string | null;
};

export type CreateModuleInviteResponse = {
  invite: ModuleInvite;
  token: string;
  url: string;
};
