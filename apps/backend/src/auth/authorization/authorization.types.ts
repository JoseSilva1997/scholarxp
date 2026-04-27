// Types shared for authorization metadata used by decorators, guards, and services.
// They make the intent of an authorization decorator explicit and reusable.
import type { FeatureKey } from '@scholarxp/permissions';
import type { AuthUser } from '../../types/auth-user.type';

// Scope shows whether authorization applies globally, to a specific module, or only to the user's own resources.
export type AuthorizationScope = 'global' | 'module' | 'self';

// Keep the authorization rule small so controllers don't contain policy implementation details.
export type AuthorizationRule = {
  capability: FeatureKey;
  scope?: AuthorizationScope;
  // For module-scoped checks, this tells the guard where to find the related module context (which related entity to read).
  moduleContextSource?: 'module' | 'user_module' | 'module_unit';
  // Archive/delete routes opt in because archived modules are hidden from normal app flows.
  allowArchived?: boolean;
  // When using `self` scope, the target user id is read from the request (route/body/query). Default key is `id`.
  selfUserIdParam?: 'id' | 'userId';
};

// Data about a module that policies need to evaluate permissions. Only includes necessary fields.
export type ModuleAuthorizationContext = {
  moduleId: number;
  moduleCreatedByUserId: number | null;
  moduleArchivedAt: Date | null;
  roleInModule: 'student' | 'teacher' | null;
};

// The shape of data passed into authorization evaluators so guards orchestrate data gathering,
// and policy logic receives a consistent input object.
export type AuthorizationEvaluation = {
  user: AuthUser;
  rule: AuthorizationRule;
  moduleContext?: ModuleAuthorizationContext;
  selfTargetUserId?: number;
};
