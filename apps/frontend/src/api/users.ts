// Provides user-specific API helpers such as updating global role.
import { apiFetch } from './client';
import type {
  AuthUser,
  GlobalRole,
  UpdateUserRolePayload,
} from '@scholarxp/api-contracts';

export async function updateUserRole(userId: number, globalRole: Exclude<GlobalRole, 'pending'>) {
  const payload: UpdateUserRolePayload = { globalRole };
  return apiFetch<AuthUser>(`/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
