// Provides user-specific API helpers such as updating global role.
import { apiFetch } from './client';
import type { AuthUser, GlobalRole } from '../types/auth';

export async function updateUserRole(userId: number, globalRole: Exclude<GlobalRole, 'pending'>) {
  return apiFetch<AuthUser>(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ globalRole }),
  });
}
