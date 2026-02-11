// Query hook for loading practice-room data while keeping route components free of fetch orchestration.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubmitAttemptPayload } from '@scholarxp/api-contracts';
import { getPracticeRoom, submitPracticeRoomAttempt } from '../../api/modules';
import { queryKeys } from '../query-keys';

export function usePracticeRoomQuery(
  moduleId: number | null,
  moduleUnitId: number | null,
) {
  return useQuery({
    queryKey:
      moduleId !== null && moduleUnitId !== null
        ? queryKeys.modules.practiceRoom(moduleId, moduleUnitId)
        : queryKeys.modules.practiceRoom(0, 0),
    queryFn: () => getPracticeRoom(moduleId!, moduleUnitId!),
    // Delay the fetch until route params are valid numeric ids.
    enabled: moduleId !== null && moduleUnitId !== null,
    staleTime: 30_000,
  });
}

export function useSubmitPracticeRoomAttemptMutation(
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
    onSuccess: async () => {
      if (moduleId === null || moduleUnitId === null) {
        return;
      }
      // Refetch room data so bars/variant unlocks reflect the newly stored attempt from server truth.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.modules.practiceRoom(moduleId, moduleUnitId),
      });
    },
  });
}
