// Encapsulates SingleModulePage orchestration so the route component can stay mostly presentational.
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser, ModuleUnitStatus } from '@scholarxp/api-contracts';
import type { ModuleSummary } from '../../types/module';
import { MODULE_EXP_MAX } from '@scholarxp/constants';
import { features } from '@scholarxp/permissions';
import type { ModuleUnit } from '../../components/ModuleUnitCard';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import { logError } from '../../utils/logger';
import { canUserAccess } from '../../permissions/permission';
import {
  useCreateModuleUnitMutation,
  useModuleDetailQuery,
  useModuleUnitsQuery,
  useUpdateModuleUnitStatusMutation,
} from '../queries/useModulesQueries';
import { queryKeys } from '../query-keys';

type UseSingleModulePageStateParams = {
  moduleIdParam: string | undefined;
  user: AuthUser | null;
};

type UseSingleModulePageStateResult = {
  parsedId: number | null;
  module: ModuleSummary | null;
  moduleUnits: ModuleUnit[];
  isLoading: boolean;
  pageError: string | null;
  canEditSettings: boolean;
  canToggleStudentView: boolean;
  canManageModuleContent: boolean;
  canManageInvites: boolean;
  isStudentViewEnabled: boolean;
  setIsStudentViewEnabled: Dispatch<SetStateAction<boolean>>;
  showCreateUnit: boolean;
  setShowCreateUnit: Dispatch<SetStateAction<boolean>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: Dispatch<SetStateAction<boolean>>;
  expPercent: number;
  expMax: number;
  isCreatingUnit: boolean;
  handleCreateUnit: (title: string) => Promise<void>;
  handleChangeUnitStatus: (unitId: string, status: ModuleUnitStatus) => Promise<void>;
  handleModuleSaved: (updated: ModuleSummary) => void;
};

export function useSingleModulePageState({
  moduleIdParam,
  user,
}: UseSingleModulePageStateParams): UseSingleModulePageStateResult {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStudentViewEnabled, setIsStudentViewEnabled] = useState(false);
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const parsedId = useMemo(() => {
    if (!moduleIdParam) return null;
    const value = Number(moduleIdParam);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [moduleIdParam]);

  const moduleQuery = useModuleDetailQuery(parsedId);
  const moduleUnitsQuery = useModuleUnitsQuery(parsedId);
  const createModuleUnitMutation = useCreateModuleUnitMutation(parsedId);
  const updateModuleUnitStatusMutation = useUpdateModuleUnitStatusMutation(parsedId);

  const canEditSettings = useMemo(() => canUserAccess(features.modules.settings, user), [user]);
  const canToggleStudentView = useMemo(
    () => canUserAccess(features.modules.toggleStudentView, user),
    [user],
  );
  const canManageModuleContent = useMemo(
    () => canUserAccess(features.modules.manageContent, user),
    [user],
  );
  const canManageInvites = useMemo(() => canUserAccess(features.modules.invitations, user), [user]);

  useEffect(() => {
    if (!moduleQuery.error) return;
    if (shouldLogApiError(moduleQuery.error)) {
      logError(moduleQuery.error, { feature: 'modules', action: 'detail', moduleId: parsedId });
    }
  }, [moduleQuery.error, parsedId]);

  useEffect(() => {
    if (!moduleUnitsQuery.error) return;
    if (shouldLogApiError(moduleUnitsQuery.error)) {
      logError(moduleUnitsQuery.error, { feature: 'module-unit', action: 'list', moduleId: parsedId });
    }
  }, [moduleUnitsQuery.error, parsedId]);

  const module = moduleQuery.data ?? null;
  const moduleUnits = useMemo<ModuleUnit[]>(
    () =>
      (moduleUnitsQuery.data ?? []).map((unit) => ({
        id: String(unit.id),
        title: unit.title,
        status: unit.status,
        // Backend completion flag is the source of truth for awarding the module-unit medal.
        isCompleted: unit.isCompleted,
        // Persist API count so cards show an accurate question total even when group previews are collapsed.
        questionCount: unit.questionCount ?? 0,
        questionGroups: (unit.questionGroups ?? []).map((group) => {
          return {
            id: String(group.id),
            title: group.name,
            // Question previews come from module-unit list data and include latest attempt status for student cards.
            questions: (group.questions ?? []).map((question) => ({
              id: String(question.id),
              title: question.title,
              lastAttemptResult: question.lastAttemptResult,
            })),
          };
        }),
      })),
    [moduleUnitsQuery.data],
  );

  const isLoading = parsedId !== null && (moduleQuery.isPending || moduleUnitsQuery.isPending);
  const pageError = useMemo(() => {
    if (!parsedId) {
      return 'Module not found. Please check the link and try again.';
    }
    if (actionError) return actionError;
    if (moduleQuery.error) {
      return getDisplayErrorMessage(moduleQuery.error, {
        fallbackMessage: 'We could not load this module right now. Please try again.',
      });
    }
    if (moduleUnitsQuery.error) {
      return getDisplayErrorMessage(moduleUnitsQuery.error, {
        fallbackMessage: 'We could not load this module right now. Please try again.',
      });
    }
    return null;
  }, [actionError, moduleQuery.error, moduleUnitsQuery.error, parsedId]);

  const expMax = useMemo(() => {
    if (!module) return MODULE_EXP_MAX;
    // Prefer module-specific cap when backend provides it so future tuning is seamless.
    return module.expMax && module.expMax > 0 ? module.expMax : MODULE_EXP_MAX;
  }, [module]);

  const expPercent = useMemo(() => {
    if (!module || module.currentExp === undefined || module.currentExp === null) return 0;
    if (expMax <= 0) return 0;
    return Math.min(100, Math.round((module.currentExp / expMax) * 100));
  }, [module, expMax]);

  const handleCreateUnit = async (title: string) => {
    if (!module) return;
    setActionError(null);
    try {
      await createModuleUnitMutation.mutateAsync({ title });
      // Close modal and navigate to the newly created unit's editor.
      setShowCreateUnit(false);
    } catch (error) {
      setActionError(
        getDisplayErrorMessage(error, {
          fallbackMessage: 'Could not create the module unit. Please try again.',
        }),
      );
      if (shouldLogApiError(error)) {
        logError(error, { feature: 'module-unit', action: 'create', moduleId: module.id });
      }
    }
  };

  const handleChangeUnitStatus = async (unitId: string, status: ModuleUnitStatus) => {
    if (!module) return;
    setActionError(null);
    try {
      const numericId = Number(unitId);
      await updateModuleUnitStatusMutation.mutateAsync({
        moduleUnitId: numericId,
        payload: { status },
      });
    } catch (error) {
      setActionError(
        getDisplayErrorMessage(error, {
          fallbackMessage: 'Could not update the lesson status. Please try again.',
        }),
      );
      if (shouldLogApiError(error)) {
        logError(error, {
          feature: 'module-unit',
          action: 'status-change',
          moduleUnitId: unitId,
          status,
        });
      }
    }
  };

  const handleModuleSaved = (updated: ModuleSummary) => {
    if (!parsedId) return;
    // Keep detail cache in sync so settings panel saves are immediately visible in the page header.
    queryClient.setQueryData(queryKeys.modules.detail(parsedId), updated);
  };

  return {
    parsedId,
    module,
    moduleUnits,
    isLoading,
    pageError,
    canEditSettings,
    canToggleStudentView,
    canManageModuleContent,
    canManageInvites,
    isStudentViewEnabled,
    setIsStudentViewEnabled,
    showCreateUnit,
    setShowCreateUnit,
    isSettingsOpen,
    setIsSettingsOpen,
    expPercent,
    expMax,
    isCreatingUnit: createModuleUnitMutation.isPending,
    handleCreateUnit,
    handleChangeUnitStatus,
    handleModuleSaved,
  };
}
