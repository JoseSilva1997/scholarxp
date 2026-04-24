// Shared module-invite query and mutation hooks to keep settings-panel invite state cache-driven.
import { useEffect } from 'react';
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
} from '@/Authoring/api/moduleInvites';
import { queryKeys } from '@/shared/hooks/query-keys';

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
    onSuccess: (result: RedeemInviteResponse) => {
      // Fire cache refreshes in the background so the accept-invite screen can leave its pending
      // state immediately even if one of the invalidated queries is slow to settle.
      void queryClient.invalidateQueries({ queryKey: queryKeys.modules.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.modules.detail(result.moduleId),
      });
    },
  });
}

export function useRedeemInviteQuery(token: string, enabled: boolean) {
  const queryClient = useQueryClient();

  const redeemInviteQuery = useQuery({
    queryKey: queryKeys.invites.redeem(token),
    // The accept-invite route is a one-shot flow, so the redeem request is keyed by token and shared
    // across remounts to avoid duplicate POSTs during StrictMode development renders.
    queryFn: () => redeemInvite(token),
    enabled: enabled && token.trim().length > 0,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!redeemInviteQuery.data) {
      return;
    }

    // React Query v5 no longer accepts lifecycle callbacks on this useQuery path,
    // so cache refreshes are coordinated from the settled query result instead.
    const result: RedeemInviteResponse = redeemInviteQuery.data;
    void queryClient.invalidateQueries({ queryKey: queryKeys.modules.all });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.modules.detail(result.moduleId),
    });
  }, [queryClient, redeemInviteQuery.data]);

  return redeemInviteQuery;
}
