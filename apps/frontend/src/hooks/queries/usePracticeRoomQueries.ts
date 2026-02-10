// Query hook for loading practice-room data while keeping route components free of fetch orchestration.
import { useQuery } from '@tanstack/react-query';
import { getPracticeRoom } from '../../api/modules';
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
