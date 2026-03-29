// Provides user-specific API helpers such as updating global role and timezone.
import { apiFetch } from './client';
import type {
  AuthUser,
  GlobalRole,
  UpdateTimezonePayload,
  UpdateUserRolePayload,
} from '@scholarxp/api-contracts';

export async function updateUserRole(userId: number, globalRole: Exclude<GlobalRole, 'pending'>) {
  const payload: UpdateUserRolePayload = { globalRole };
  return apiFetch<AuthUser>(`/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updateTimezone(userId: number, timezone: string) {
  const payload: UpdateTimezonePayload = { timezone };
  return apiFetch<AuthUser>(`/users/${userId}/timezone`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
