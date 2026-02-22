// Shared authorization metadata types keep decorator intent explicit and reusable across guard/service layers.
import type { FeatureKey } from '@scholarxp/permissions';

// Scope indicates whether the policy needs only user attributes or also resource-level checks.
export type AuthorizationScope = 'global' | 'module';

// Rule shape is intentionally minimal for v1 to avoid encoding policy implementation details in controllers.
export type AuthorizationRule = {
  capability: FeatureKey;
  scope?: AuthorizationScope;
};
