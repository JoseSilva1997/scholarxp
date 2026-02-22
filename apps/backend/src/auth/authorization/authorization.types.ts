// Shared authorization metadata types keep decorator intent explicit and reusable across guard/service layers.
import type { FeatureKey } from '@scholarxp/permissions';
import type { AuthUser } from '../../types/auth-user.type';

// Scope indicates whether the policy needs only user attributes or also resource-level checks.
export type AuthorizationScope = 'global' | 'module';

// Rule shape is intentionally minimal for v1 to avoid encoding policy implementation details in controllers.
export type AuthorizationRule = {
  capability: FeatureKey;
  scope?: AuthorizationScope;
};

// Module authorization context carries only the attributes needed by policy evaluation.
export type ModuleAuthorizationContext = {
  moduleId: number;
  moduleInstitutionId: number | null;
  moduleCreatedByUserId: number | null;
  roleInModule: 'student' | 'teacher' | null;
  hasInstitutionMatch: boolean;
};

// Evaluation input keeps guard orchestration separate from policy logic.
export type AuthorizationEvaluation = {
  user: AuthUser;
  rule: AuthorizationRule;
  moduleContext?: ModuleAuthorizationContext;
};
