import type { AuthUser as BaseAuthUser, AuthResponse as BaseAuthResponse, GlobalRole } from '@scholarxp/api-contracts';

export type { GlobalRole };

/**
 * Frontend-specific version of AuthUser if needed, 
 * but for now we can just use the shared one or extend it.
 */
export type AuthUser = BaseAuthUser;

export type AuthResponse = BaseAuthResponse;
