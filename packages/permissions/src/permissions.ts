// Shared permission evaluator keeps backend and frontend feature checks aligned.
import { features, type FeatureKey } from './features';
export { features, type FeatureKey } from './features';

export type Role = 'pending' | 'admin' | 'teacher' | 'student';

export type RoleKey = Role;

export type UserContext = {
  role: Role;
};

export function toRoleKey(user: UserContext): RoleKey {
  return user.role;
}

export type PermissionMatrix = Record<FeatureKey, RoleKey[]>;

// Single source of truth for feature permissions across the application.
export const permissionMatrix: PermissionMatrix = {
  // ====USERS====
  [features.users.selectOwnRole]: ['pending'],
  [features.users.updateOwnTimezone]: [
    'pending',
    'admin',
    'teacher',
    'student',
  ],
  [features.users.updateOwnProfilePicture]: [
    'admin',
    'teacher',
    'student',
  ],
  [features.users.updateOwnName]: [
    'admin',
    'teacher',
    'student',
  ],

  // ====MODULES====
  [features.modules.create]: ['admin', 'teacher'],
  [features.modules.toggleStudentView]: [
    'admin',
    'teacher',
  ],
  [features.modules.settings]: ['admin', 'teacher'],
  [features.modules.delete]: ['admin', 'teacher'],
  [features.modules.manageContent]: [
    'admin',
    'teacher',
  ],
  [features.modules.invitations]: ['admin', 'teacher'],
  [features.modules.invitationsRedemption]: ['admin', 'student'],
  [features.modules.roster]: ['admin', 'teacher'],
  [features.modules.removeStudent]: ['admin', 'teacher'],

  // ====NAVIGATION====
  [features.navigation.modules]: [
    'admin',
    'teacher',
    'student',
  ],
  [features.navigation.quests]: ['admin', 'student'],
  [features.navigation.profile]: [
    'admin',
    'teacher',
    'student',
  ],
  // Rewards are avatar-driven cosmetics, and only students have avatars, so the feature is student-only
  // on both the sidebar entry and the equip mutation.
  [features.navigation.rewards]: ['student'],
  [features.rewards.equip]: ['student'],
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

export function listCapabilities(
  user: UserContext | null | undefined,
): FeatureKey[] {
  if (!user) return [];

  const roleKey = toRoleKey(user);

  return (Object.entries(permissionMatrix) as [FeatureKey, RoleKey[]][])
    .filter(([, allowed]) => allowed.includes(roleKey))
    .map(([feature]) => feature);
}
