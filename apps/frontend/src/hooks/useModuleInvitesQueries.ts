// Shared module-invite query and mutation hooks to keep settings-panel invite state cache-driven.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateInvitePayload,
  ModuleInviteResponse,
  RedeemInviteResponse,
  UpdateInvitePayload,
} from '@scholarxp/api-contracts';
import {
  createModuleInvite,
  deleteModuleInvite,
  listModuleInvites,
  redeemInvite,
  updateModuleInvite,
} from '../api/moduleInvites';
import { queryKeys } from './query-keys';

export function useModuleInvitesQuery(moduleId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: moduleId ? queryKeys.modules.invites(moduleId) : queryKeys.modules.invites(0),
    queryFn: () => listModuleInvites(moduleId!),
    // Fetch invites only when the panel is open and the user is eligible to manage invites.
    enabled: moduleId !== null && enabled,
    staleTime: 30_000,
  });
}

export function useCreateModuleInviteMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateInvitePayload) => {
      if (moduleId === null) {
        throw new Error('Missing module id for invite creation.');
      }
      return createModuleInvite(moduleId, payload);
    },
    onSuccess: (result) => {
      if (moduleId === null) return;
      queryClient.setQueryData<ModuleInviteResponse[]>(
        queryKeys.modules.invites(moduleId),
        (previousInvites) => {
          const previous = previousInvites ?? [];
          const deduped = previous.filter((invite) => invite.id !== result.invite.id);
          // Place newly issued invite first so instructors can copy/use it immediately.
          return [result.invite, ...deduped];
        },
      );
    },
    onSettled: async () => {
      if (moduleId === null) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.modules.invites(moduleId) });
    },
  });
}

export function useUpdateModuleInviteMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      inviteId,
      payload,
    }: {
      inviteId: number;
      payload: UpdateInvitePayload;
    }) => {
      if (moduleId === null) {
        throw new Error('Missing module id for invite update.');
      }
      return updateModuleInvite(moduleId, inviteId, payload);
    },
    onSuccess: (updatedInvite) => {
      if (moduleId === null) return;
      queryClient.setQueryData<ModuleInviteResponse[]>(
        queryKeys.modules.invites(moduleId),
        (previousInvites) => {
          if (!previousInvites) return previousInvites;
          return previousInvites.map((invite) =>
            invite.id === updatedInvite.id ? updatedInvite : invite,
          );
        },
      );
    },
    onSettled: async () => {
      if (moduleId === null) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.modules.invites(moduleId) });
    },
  });
}

export function useDeleteModuleInviteMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: number) => {
      if (moduleId === null) {
        throw new Error('Missing module id for invite deletion.');
      }
      return deleteModuleInvite(moduleId, inviteId);
    },
    onSuccess: (_, inviteId) => {
      if (moduleId === null) return;
      queryClient.setQueryData<ModuleInviteResponse[]>(
        queryKeys.modules.invites(moduleId),
        (previousInvites) => {
          if (!previousInvites) return previousInvites;
          return previousInvites.filter((invite) => invite.id !== inviteId);
        },
      );
    },
    onSettled: async () => {
      if (moduleId === null) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.modules.invites(moduleId) });
    },
  });
}

export function useRedeemInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => redeemInvite(token),
    onSuccess: async (result: RedeemInviteResponse) => {
      // Joining a module can change the "my modules" list, so refresh that cache after redemption.
      await queryClient.invalidateQueries({ queryKey: queryKeys.modules.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.modules.detail(result.moduleId) });
    },
  });
}
