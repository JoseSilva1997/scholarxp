// User-domain mutation hooks keep user profile/role write flows reusable across components.
import { useMutation } from '@tanstack/react-query';
import { updateUserRole } from '@/Account/api/users';
import type { GlobalRole } from '@scholarxp/api-contracts';

// Creates a reusable mutation for role changes so account and admin-like UI can share write behavior.
export function useUpdateUserRoleMutation() {
  return useMutation({
    // Mutation function keeps the hook API aligned with the endpoint's required identifiers.
    mutationFn: ({
      userId,
      globalRole,
    }: {
      userId: number;
      globalRole: Exclude<GlobalRole, 'pending'>;
    }) => updateUserRole(userId, globalRole),
  });
}
