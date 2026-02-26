// Query hook for loading practice-room data while keeping route components free of fetch orchestration.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubmitAttemptPayload, SubmitAttemptResponse } from '@scholarxp/api-contracts';
import {
  closePracticeRoomSession,
  getPracticeRoom,
  submitPracticeRoomAttempt,
} from '../../api/modules';
import { queryKeys } from '../query-keys';

export function useModuleUnitPracticeRoomQuery(
  moduleId: number | null,
  moduleUnitId: number | null,
  sessionId: string | null,
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey:
      moduleId !== null && moduleUnitId !== null
        ? queryKeys.modules.moduleUnitPracticeRoom(
            moduleId,
            moduleUnitId,
            sessionId ?? undefined,
          )
        : queryKeys.modules.moduleUnitPracticeRoom(0, 0),
    queryFn: async () => {
      const response = await getPracticeRoom(moduleId!, moduleUnitId!, {
        sessionId: sessionId ?? undefined,
      });

      // Synchronize the module detail cache with the progress returned in the room response.
      // This reduces total network requests by avoiding a separate GET /module/:id call on initial page load.
      if (moduleId !== null && response.moduleProgress) {
        queryClient.setQueryData(
          queryKeys.modules.detail(moduleId),
          response.moduleProgress,
        );
      }

      return response;
    },
    // Delay the fetch until route params are valid numeric ids.
    enabled: moduleId !== null && moduleUnitId !== null,
    staleTime: 30_000,
  });
}

export function useSubmitModuleUnitPracticeAttemptMutation(
  moduleId: number | null,
  moduleUnitId: number | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SubmitAttemptPayload) => {
      if (moduleId === null || moduleUnitId === null) {
        throw new Error(
          'Cannot submit a practice-room attempt without valid module and unit ids.',
        );
      }
      return submitPracticeRoomAttempt(moduleId, moduleUnitId, payload);
    },
    onSuccess: async (data: SubmitAttemptResponse) => {
      if (moduleId === null || moduleUnitId === null || !data) {
        return;
      }

      // If the server returned updated progress, we update the cache directly to avoid a redundant GET.
      if (data.updatedModuleProgress) {
        queryClient.setQueryData(
          queryKeys.modules.detail(moduleId),
          data.updatedModuleProgress,
        );
      }

      // Refetch room data and quests so the UI reflects newly stored attempts and quest progress immediately.
      // We skip an immediate refetch of the module detail if we already updated it from the response.
      const invalidations: Promise<void>[] = [
        queryClient.invalidateQueries({
          queryKey: queryKeys.modules.moduleUnitPracticeRoomBase(moduleId, moduleUnitId),
        }),
        queryClient.invalidateQueries({
          queryKey: ['quests'],
        }),
      ];

      if (!data.updatedModuleProgress) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: queryKeys.modules.detail(moduleId),
          }),
        );
      }

      await Promise.all(invalidations);

      // Mark the list and other units as stale so they update if the user navigates back,
      // but do not trigger actual background requests while the user is still in the room.
      queryClient.invalidateQueries({
        queryKey: queryKeys.modules.units(moduleId),
        refetchType: 'none',
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.modules.all,
        refetchType: 'none',
      });
    },
  });
}

export function useCloseModuleUnitPracticeSessionMutation(
  moduleId: number | null,
  moduleUnitId: number | null,
) {
  return useMutation({
    mutationFn: (sessionId: string) => {
      if (moduleId === null || moduleUnitId === null) {
        throw new Error(
          'Cannot close a practice-room session without valid module and unit ids.',
        );
      }
      return closePracticeRoomSession(moduleId, moduleUnitId, sessionId);
    },
  });
}
