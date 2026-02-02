// Shared permission definitions and evaluator used by both backend and frontend so feature gates stay consistent.
export type FeatureKey =
  | 'modules.create'
  | 'modules.setInstitution'
  | 'modules.toggleStudentView'
  | 'modules.settings'
  | 'modules.invitations'
  | 'modules.invitations.redemption'
  | 'modules.manageContent'
  | 'navigation.modules'
  | 'navigation.quests'
  | 'navigation.profile';

export type Role = 'pending' | 'admin' | 'institution_admin' | 'teacher' | 'student';

// A condition grants access when all provided checks pass; a feature is allowed if any condition matches.
export type PermissionCondition = {
  roles?: Role[];
  requiresInstitution?: boolean;
  forbidsInstitution?: boolean;
};

export type PermissionRule = PermissionCondition[];

export type PermissionMatrix = Record<FeatureKey, PermissionRule>;

// Single source of truth for feature permissions across the stack.
export const permissionMatrix: PermissionMatrix = {
  'modules.create': [
    { roles: ['admin', 'institution_admin'] },
    { roles: ['teacher'], forbidsInstitution: true },
  ],
  'modules.setInstitution': [{ roles: ['admin', 'institution_admin'], requiresInstitution: true }],
  'modules.toggleStudentView': [{ roles: ['admin', 'institution_admin', 'teacher'] }],
  'modules.settings': [{ roles: ['admin', 'institution_admin', 'teacher'] }],
  'modules.manageContent': [{ roles: ['admin', 'institution_admin', 'teacher'] }],
  'modules.invitations': [
    { roles: ['admin'] },
    { roles: ['teacher', 'institution_admin'], forbidsInstitution: true },
  ],
  'modules.invitations.redemption': [
    { roles: ['admin'] },
    { roles: ['student'], forbidsInstitution: true },
  ],
  'navigation.modules': [{ roles: ['admin', 'institution_admin', 'teacher', 'student'] }],
  'navigation.quests': [{ roles: ['admin', 'institution_admin', 'student'] }],
  'navigation.profile': [{ roles: ['admin', 'institution_admin', 'teacher', 'student'] }],
};

export type UserContext = {
  role: Role;
  hasInstitutionMembership?: boolean;
};

// Evaluates a feature against the provided user context; designed for both server and client use.
export function canAccess(feature: FeatureKey, user: UserContext | null | undefined): boolean {
  if (!user) return false;
  const rules = permissionMatrix[feature];
  if (!rules) return false;

  const hasInstitution = Boolean(user.hasInstitutionMembership);

  return rules.some((condition) => {
    if (condition.roles && !condition.roles.includes(user.role)) return false;
    if (condition.requiresInstitution && !hasInstitution) return false;
    if (condition.forbidsInstitution && hasInstitution) return false;
    return true;
  });
}

export function listCapabilities(user: UserContext | null | undefined): FeatureKey[] {
  if (!user) return [];
  return (Object.keys(permissionMatrix) as FeatureKey[]).filter((feature) =>
    canAccess(feature, user),
  );
}
