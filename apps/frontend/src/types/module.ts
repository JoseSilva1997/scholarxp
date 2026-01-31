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
  // Student-only progress fields; returned when the caller is enrolled as a student in the module.
  userModuleLevel?: number;
  currentExp?: number;
  expMax?: number;
};

export type ModuleUnitStatus = 'draft' | 'live' | 'locked';

export type ModuleUnitGroup = {
  id: number;
  moduleUnitId: number;
  name: string;
  sortOrder: number;
};

export type ModuleUnitResponse = {
  id: number;
  moduleId: number | null;
  variantContext: string;
  title: string;
  questionCount: number;
  status: ModuleUnitStatus;
  sortOrder: number;
  createdAt: string;
  questionGroups: ModuleUnitGroup[];
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
