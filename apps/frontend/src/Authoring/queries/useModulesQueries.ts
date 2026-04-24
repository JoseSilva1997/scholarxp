// Shared modules query/mutation hooks so list and creation flows use one cache contract.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateModulePayload,
  CreateModuleUnitMinimalPayload,
  ModuleSummaryResponse,
  ModuleUnitResponse,
  UpdateModulePayload,
  UpdateModuleUnitPayload,
  UpdateModuleUnitStatusPayload,
} from '@scholarxp/api-contracts';
import {
  createModule,
  createModuleUnit,
  getModuleById,
  getModuleUnits,
  listModules,
  updateModule,
  updateModuleUnit,
  updateModuleUnitStatus,
} from '@/Authoring/api/modules';
import { queryKeys } from '@/shared/hooks/query-keys';

export function useModulesListQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.modules.all,
    queryFn: listModules,
    // Gate by auth readiness to avoid unnecessary unauthorized requests during initial bootstrap.
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateModuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateModulePayload) => createModule(payload),
    onSuccess: (createdModule) => {
      queryClient.setQueryData<ModuleSummaryResponse[]>(
        queryKeys.modules.all,
        (previousModules) => {
          const previous = previousModules ?? [];
          // Keep the cache immediately in sync so the list reflects create success before navigation.
          const deduped = previous.filter((module) => module.id !== createdModule.id);
          return [createdModule, ...deduped];
        },
      );
    },
    onSettled: async () => {
      // Explicit invalidation ensures background truth-sync if other attributes changed server-side.
      await queryClient.invalidateQueries({ queryKey: queryKeys.modules.all });
    },
  });
}

export function useUpdateModuleMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateModulePayload) => {
      if (moduleId === null) {
        throw new Error('Missing module id for module update.');
      }
      return updateModule(moduleId, payload);
    },
    onSuccess: (updatedModule) => {
      if (moduleId === null) return;
      queryClient.setQueryData(queryKeys.modules.detail(moduleId), updatedModule);
      queryClient.setQueryData<ModuleSummaryResponse[]>(
        queryKeys.modules.all,
        (previousModules) => {
          if (!previousModules) return previousModules;
          // Keep modules list cards in sync when title/description changes from detail settings panel.
          return previousModules.map((module) =>
            module.id === updatedModule.id ? updatedModule : module,
          );
        },
      );
    },
    onSettled: async () => {
      if (moduleId === null) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.modules.detail(moduleId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.modules.all }),
      ]);
    },
  });
}

export function useModuleDetailQuery(moduleId: number | null) {
  return useQuery({
    queryKey: moduleId ? queryKeys.modules.detail(moduleId) : queryKeys.modules.detail(0),
    queryFn: () => getModuleById(moduleId!),
    // Avoid module fetches until routing params are validated.
    enabled: moduleId !== null,
    staleTime: 30_000,
  });
}

export function useModuleUnitsQuery(moduleId: number | null) {
  return useQuery({
    queryKey: moduleId ? queryKeys.modules.units(moduleId) : queryKeys.modules.units(0),
    queryFn: () => getModuleUnits(moduleId!),
    // Avoid module-unit fetches until routing params are validated.
    enabled: moduleId !== null,
    staleTime: 30_000,
  });
}

export function useCreateModuleUnitMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateModuleUnitMinimalPayload) => {
      if (moduleId === null) {
        throw new Error('Missing module id for unit creation.');
      }
      return createModuleUnit(moduleId, payload);
    },
    onSuccess: (createdUnit) => {
      if (moduleId === null) return;
      queryClient.setQueryData<ModuleUnitResponse[]>(
        queryKeys.modules.units(moduleId),
        (previousUnits) => {
          const previous = previousUnits ?? [];
          // Insert newly created unit immediately so cache reflects the mutation result without a refetch gap.
          const deduped = previous.filter((unit) => unit.id !== createdUnit.id);
          return [createdUnit, ...deduped];
        },
      );
    },
    onSettled: async () => {
      if (moduleId === null) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.modules.units(moduleId) });
    },
  });
}

export function useUpdateModuleUnitMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      moduleUnitId,
      payload,
    }: {
      moduleUnitId: number;
      payload: UpdateModuleUnitPayload;
    }) => updateModuleUnit(moduleUnitId, payload),
    onSuccess: (updatedUnit) => {
      if (moduleId === null) return;
      queryClient.setQueryData<ModuleUnitResponse[]>(
        queryKeys.modules.units(moduleId),
        (previousUnits) => {
          if (!previousUnits) return previousUnits;
          // Optimistically update unit details in cache to keep list interactions responsive.
          return previousUnits.map((unit) =>
            unit.id === updatedUnit.id ? { ...unit, ...updatedUnit } : unit,
          );
        },
      );
    },
    onSettled: async () => {
      if (moduleId === null) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.modules.units(moduleId) });
    },
  });
}

export function useUpdateModuleUnitStatusMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      moduleUnitId,
      payload,
    }: {
      moduleUnitId: number;
      payload: UpdateModuleUnitStatusPayload;
    }) => updateModuleUnitStatus(moduleUnitId, payload),
    onSuccess: (updatedUnit) => {
      if (moduleId === null) return;
      queryClient.setQueryData<ModuleUnitResponse[]>(
        queryKeys.modules.units(moduleId),
        (previousUnits) => {
          if (!previousUnits) return previousUnits;
          // Keep unit cards responsive by patching status in cache before broader synchronization.
          return previousUnits.map((unit) =>
            unit.id === updatedUnit.id ? { ...unit, status: updatedUnit.status } : unit,
          );
        },
      );
    },
    onSettled: async () => {
      if (moduleId === null) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.modules.units(moduleId) });
    },
  });
}
