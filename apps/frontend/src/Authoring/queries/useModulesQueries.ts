// Shared modules query/mutation hooks so list and creation flows use one cache contract.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateModulePayload,
  CreateModuleUnitMinimalPayload,
  ModuleDeletionImpactResponse,
  ModuleSummaryResponse,
  ModuleUnitResponse,
  UpdateModulePayload,
  UpdateModuleUnitPayload,
  UpdateModuleUnitStatusPayload,
} from '@scholarxp/api-contracts';
import {
  archiveModule,
  createModule,
  createModuleUnit,
  getModuleById,
  getModuleDeletionImpact,
  getModuleUnits,
  listModules,
  updateModule,
  updateModuleUnit,
  updateModuleUnitStatus,
} from '@/Authoring/api/modules';
import { queryKeys } from '@/shared/hooks/query-keys';

// Provides the module list query, gated by authentication readiness.
export function useModulesListQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.modules.all,
    queryFn: listModules,
    // Gate by auth readiness to avoid unnecessary unauthorized requests during initial bootstrap.
    enabled,
    staleTime: 30_000,
  });
}

// Creates a module and updates list cache immediately before background invalidation.
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

// Updates module metadata and synchronizes both detail and list caches.
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

// Loads one module summary for the module detail route once the route id is valid.
export function useModuleDetailQuery(moduleId: number | null) {
  return useQuery({
    queryKey: moduleId ? queryKeys.modules.detail(moduleId) : queryKeys.modules.detail(0),
    queryFn: () => getModuleById(moduleId!),
    // Avoid module fetches until routing params are validated.
    enabled: moduleId !== null,
    staleTime: 30_000,
  });
}

// Lazily fetches archive impact so confirmation UI can show real consequences.
export function useModuleDeletionImpactQuery(moduleId: number | null, enabled: boolean) {
  return useQuery<ModuleDeletionImpactResponse>({
    queryKey: moduleId
      ? queryKeys.modules.deletionImpact(moduleId)
      : queryKeys.modules.deletionImpact(0),
    queryFn: () => getModuleDeletionImpact(moduleId!),
    // Impact is only needed once the tutor is considering the destructive action.
    enabled: moduleId !== null && enabled,
    staleTime: 10_000,
  });
}

// Archives a module and clears module-scoped caches that should no longer be reachable.
export function useArchiveModuleMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (moduleId === null) {
        throw new Error('Missing module id for module archive.');
      }
      return archiveModule(moduleId);
    },
    onSuccess: (archivedModule) => {
      if (moduleId === null) return;
      queryClient.setQueryData<ModuleSummaryResponse[]>(
        queryKeys.modules.all,
        (previousModules) => {
          if (!previousModules) return previousModules;
          return previousModules.filter((module) => module.id !== archivedModule.id);
        },
      );
      queryClient.removeQueries({ queryKey: queryKeys.modules.detail(moduleId) });
      queryClient.removeQueries({ queryKey: queryKeys.modules.units(moduleId) });
      queryClient.removeQueries({ queryKey: queryKeys.modules.invites(moduleId) });
      queryClient.removeQueries({ queryKey: queryKeys.modules.deletionImpact(moduleId) });
    },
    onSettled: async () => {
      if (moduleId === null) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.modules.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.tutorAll }),
      ]);
    },
  });
}

// Loads all unit cards for a module detail page after route validation.
export function useModuleUnitsQuery(moduleId: number | null) {
  return useQuery({
    queryKey: moduleId ? queryKeys.modules.units(moduleId) : queryKeys.modules.units(0),
    queryFn: () => getModuleUnits(moduleId!),
    // Avoid module-unit fetches until routing params are validated.
    enabled: moduleId !== null,
    staleTime: 30_000,
  });
}

// Creates a unit and patches the unit-list cache to keep tutor flow responsive.
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

// Updates module-unit metadata and keeps the unit list in sync with the returned server state.
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

// Changes a unit's publication status and updates cached cards before refetching.
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
