// User-domain mutation hooks keep user profile/role write flows reusable across components.
import { useMutation } from '@tanstack/react-query';
import { updateUserRole } from '../../api/users';
import type { GlobalRole } from '@scholarxp/api-contracts';

export function useUpdateUserRoleMutation() {
  return useMutation({
    mutationFn: ({
      userId,
      globalRole,
    }: {
      userId: number;
      globalRole: Exclude<GlobalRole, 'pending'>;
    }) => updateUserRole(userId, globalRole),
  });
}
