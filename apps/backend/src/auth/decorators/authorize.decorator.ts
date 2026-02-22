// Authorize decorator captures route-level authorization intent so guards can evaluate shared policies consistently.
import { SetMetadata } from '@nestjs/common';
import type { AuthorizationRule } from '../authorization/authorization.types';

export const AUTHORIZATION_KEY = 'authorization';

// Decorator intentionally accepts a single rule object to keep call sites explicit and migration-friendly.
export const Authorize = (rule: AuthorizationRule) =>
  SetMetadata(AUTHORIZATION_KEY, rule);
