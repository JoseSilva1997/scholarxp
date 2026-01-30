// Central permission map for UI gating; keeps feature-level decisions in one place so components stay lean and consistent.
import type { AuthUser, GlobalRole } from '../types/auth';

// Enumerates frontend features we gate; extend as new features ship.
export type PermissionKey =
  | 'modules.create'
  | 'modules.setInstitution'
  | 'navigation.modules'
  | 'navigation.quests'
  | 'navigation.profile';

// A condition is satisfied when all provided checks pass; feature is allowed if any condition matches.
type PermissionCondition = {
  roles?: GlobalRole[];
  requiresInstitution?: boolean;
  forbidsInstitution?: boolean;
};

type PermissionRule = PermissionCondition[];

const permissionMatrix: Record<PermissionKey, PermissionRule> = {
  'modules.create': [
    { roles: ['admin', 'institution_admin'] },
    { roles: ['teacher'], forbidsInstitution: true },
  ],
  'modules.setInstitution': [
    { roles: ['admin', 'institution_admin'], requiresInstitution: true },
  ],
  'navigation.modules': [{ roles: ['admin', 'institution_admin', 'teacher', 'student'] }],
  'navigation.quests': [{ roles: ['admin', 'institution_admin', 'student'] }],
  'navigation.profile': [{ roles: ['admin', 'institution_admin', 'teacher', 'student'] }],
};

// Helper used by components; keeps fallbacks defensive so missing data never grants access.
export function canUserAccess(feature: PermissionKey, user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  const rule = permissionMatrix[feature];
  if (!rule) return false;

  const hasInstitution = user.hasInstitutionMembership ?? Boolean(user.institutionIds?.length);

  return rule.some((condition) => {
    if (condition.roles && !condition.roles.includes(user.globalRole)) return false;
    if (condition.requiresInstitution && !hasInstitution) return false;
    if (condition.forbidsInstitution && hasInstitution) return false;
    return true;
  });
}

// Convenience for debugging or analytics when we need to show a role's surface area.
export function listRolePermissions(role: GlobalRole, hasInstitution = false): PermissionKey[] {
  const mockUser: AuthUser = {
    id: -1,
    firstName: '',
    lastName: '',
    email: null,
    profilePictureUrl: '',
    globalRole: role,
    isVerified: true,
    institutionIds: hasInstitution ? [1] : [],
    hasInstitutionMembership: hasInstitution,
  };

  return (Object.keys(permissionMatrix) as PermissionKey[]).filter((feature) =>
    canUserAccess(feature, mockUser),
  );
}
