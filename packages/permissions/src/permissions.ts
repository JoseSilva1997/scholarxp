// Shared permission evaluator keeps backend and frontend feature checks aligned.
import { features, type FeatureKey } from './features';
export { features, type FeatureKey } from './features';

export type Role = 'pending' | 'admin' | 'institution_admin' | 'teacher' | 'student';

export type RoleKey =
  | 'pending'
  | 'admin'
  | 'institution_admin'
  | 'teacher.independent'
  | 'teacher.institutional'
  | 'student.independent'
  | 'student.institutional';

export type UserContext = {
  role: Role;
  hasInstitutionMembership?: boolean;
};

export function toRoleKey(user: UserContext): RoleKey {
  const hasInstitution = Boolean(user.hasInstitutionMembership);
  if (user.role === 'teacher') {
    return hasInstitution ? 'teacher.institutional' : 'teacher.independent';
  }
  if (user.role === 'student') {
    return hasInstitution ? 'student.institutional' : 'student.independent';
  }
  return user.role as RoleKey;
}

export type PermissionMatrix = Record<FeatureKey, RoleKey[]>;

// Single source of truth for feature permissions across the application.
export const permissionMatrix: PermissionMatrix = {

  // ====MODULES====
  [features.modules.create]: [
    'admin', 
    'institution_admin', 
    'teacher.independent'
  ],
  [features.modules.setInstitution]: [
    'admin', 
    'institution_admin'
  ],
  [features.modules.toggleStudentView]: [
    'admin',
    'institution_admin',
    'teacher.independent',
    'teacher.institutional',
  ],
  [features.modules.settings]: [
    'admin',
    'institution_admin',
    'teacher.independent',
    'teacher.institutional',
  ],
  [features.modules.manageContent]: [
    'admin',
    'institution_admin',
    'teacher.independent',
    'teacher.institutional',
  ],
  [features.modules.invitations]: [
    'admin', 
    'teacher.independent'
  ],
  [features.modules.invitationsRedemption]: [
    'admin', 
    'student.independent'
  ],

  // ====NAVIGATION====
  [features.navigation.modules]: [
    'admin',
    'institution_admin',
    'teacher.independent',
    'teacher.institutional',
    'student.independent',
    'student.institutional',
  ],
  [features.navigation.quests]: [
    'admin',
    'student.independent',
    'student.institutional',
  ],
  [features.navigation.profile]: [
    'admin',
    'institution_admin',
    'teacher.independent',
    'teacher.institutional',
    'student.independent',
    'student.institutional',
  ],
};

// Evaluates a feature against the provided user context; designed for both server and client use.
export function canAccess(
  feature: FeatureKey,
  user: UserContext | null | undefined,
): boolean {
  if (!user) return false;
  const rules = permissionMatrix[feature];
  if (!rules) return false;
  return rules.includes(toRoleKey(user));
}

export function listCapabilities(user: UserContext | null | undefined): FeatureKey[] {
  if (!user) return [];

  const roleKey = toRoleKey(user);

  return (Object.entries(permissionMatrix) as [FeatureKey, RoleKey[]][])
    .filter(([, allowed]) => allowed.includes(roleKey))
    .map(([feature]) => feature);
}
