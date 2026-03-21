// Encapsulates SingleModulePage orchestration so the route component can stay mostly presentational.
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  PracticeSessionTypeValues,
  type AuthUser,
  type ModuleUnitStatus,
  type PracticeSessionType,
} from '@scholarxp/api-contracts';
import type { ModuleSummary } from '../../types/module';
import { MODULE_UNIT_BASELINE_EXP } from '@scholarxp/constants';
import { features } from '@scholarxp/permissions';
import type { ModuleUnit } from '../../components/ModuleUnitCard';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import { ApiError } from '../../api/client';
import { logError } from '../../utils/logger';
import { canUserAccess } from '../../permissions/permission';
import {
  useCreateModuleUnitMutation,
  useModuleDetailQuery,
  useModuleUnitsQuery,
  useUpdateModuleUnitMutation,
  useUpdateModuleUnitStatusMutation,
} from '../queries/useModulesQueries';
import { useTodayDailyPracticeQuery } from '../queries/useDailyPracticeQueries';
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
  dailyPracticeButtonLabel: string;
  dailyPracticeStatusText: string | null;
  isDailyPracticeButtonDisabled: boolean;
  handleDailyPracticeClick: () => Promise<void>;
  handleOpenStudentPracticeRoom: (unitId: string, questionId?: string) => Promise<void>;
  handleRetryStudentPracticeRoom: (unitId: string) => Promise<void>;
  handleCreateUnit: (title: string) => Promise<void>;
  handleChangeUnitStatus: (unitId: string, status: ModuleUnitStatus) => Promise<void>;
  handleUpdateUnitTitle: (unitId: string, title: string) => Promise<void>;
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

  // normalize the route parameter into a valid numeric id or null.
  // we memoize to avoid recalculating on every render and ensure
  // dependency arrays downstream stay stable.
  const parsedId = useMemo(() => {
    if (!moduleIdParam) return null;
    const value = Number(moduleIdParam);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [moduleIdParam]);

  const moduleQuery = useModuleDetailQuery(parsedId);
  const moduleUnitsQuery = useModuleUnitsQuery(parsedId);
  const createModuleUnitMutation = useCreateModuleUnitMutation(parsedId);
  const updateModuleUnitMutation = useUpdateModuleUnitMutation(parsedId);
  const updateModuleUnitStatusMutation = useUpdateModuleUnitStatusMutation(parsedId);
  const todayDailyPracticeQuery = useTodayDailyPracticeQuery(
    parsedId,
    null,
  );

  // permission checks are memoized to avoid re-evaluating the
  // shared matrix on every render. user object is primary dependency.
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

  // log any unexpected errors from the detail query for monitoring.
  useEffect(() => {
    if (!moduleQuery.error) return;
    if (shouldLogApiError(moduleQuery.error)) {
      logError(moduleQuery.error, { feature: 'modules', action: 'detail', moduleId: parsedId });
    }
  }, [moduleQuery.error, parsedId]);

  // likewise track errors when loading the list of units.
  useEffect(() => {
    if (!moduleUnitsQuery.error) return;
    if (shouldLogApiError(moduleUnitsQuery.error)) {
      logError(moduleUnitsQuery.error, { feature: 'module-unit', action: 'list', moduleId: parsedId });
    }
  }, [moduleUnitsQuery.error, parsedId]);

  // Daily-practice summary errors should not block the page; they only affect CTA copy and are logged for monitoring.
  useEffect(() => {
    if (!todayDailyPracticeQuery.error) return;
    if (shouldLogApiError(todayDailyPracticeQuery.error)) {
      logError(todayDailyPracticeQuery.error, {
        feature: 'daily-practice',
        action: 'module-summary',
        moduleId: parsedId,
      });
    }
  }, [parsedId, todayDailyPracticeQuery.error]);

  const module = moduleQuery.data ?? null;

  // convert raw API units into the shape expected by the UI component.
  // comments inside the mapper explain why particular fields are preserved.
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

  // derived UI state summarizing whether we're still fetching data.
  const isLoading = parsedId !== null && (moduleQuery.isPending || moduleUnitsQuery.isPending);

  // compute a user-visible error message; prioritizes action errors over
  // fetch errors, and gives a helpful default when the id is invalid.
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

  // experience bar calculations. We keep these separate so the UI
  // layer can render a percentage and cap even if backend data is
  // temporarily unavailable.
  const expMax = useMemo(() => {
    if (!module) return MODULE_UNIT_BASELINE_EXP;
    // Prefer module-specific cap when backend provides it so future tuning is seamless.
    return module.expMax && module.expMax > 0 ? module.expMax : MODULE_UNIT_BASELINE_EXP;
  }, [module]);

  const expPercent = useMemo(() => {
    if (!module || module.currentExp === undefined || module.currentExp === null) return 0;
    if (expMax <= 0) return 0;
    return Math.min(100, Math.round((module.currentExp / expMax) * 100));
  }, [module, expMax]);

  // create unit handler used by the UI when teacher hits "add unit".
  // we clear previous action errors to avoid stale messages lingering.
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

  const dailyPracticeEntry = useMemo(() => {
    const progress = todayDailyPracticeQuery.data?.progress ?? null;
    const isLockedDailyPractice =
      todayDailyPracticeQuery.error instanceof ApiError &&
      todayDailyPracticeQuery.error.status === 403;
    const hasNoDailyPracticeSet =
      todayDailyPracticeQuery.error instanceof ApiError &&
      todayDailyPracticeQuery.error.status === 404;

    if (todayDailyPracticeQuery.isPending) {
      return {
        buttonLabel: 'Daily Practice',
        statusText: 'Preparing today’s set…',
        isDisabled: true,
      };
    }

    if (isLockedDailyPractice) {
      return {
        buttonLabel: 'Daily Practice Locked',
        statusText: todayDailyPracticeQuery.error.message,
        isDisabled: true,
      };
    }

    if (hasNoDailyPracticeSet) {
      return {
        // Backend-owned 404 copy signals a valid caught-up state, so keep the CTA non-actionable instead of linking into a known empty route.
        buttonLabel: 'No Daily Practice Today',
        statusText: todayDailyPracticeQuery.error.message,
        isDisabled: true,
      };
    }

    if (!progress) {
      return {
        buttonLabel: 'Daily Practice',
        statusText: 'Open today’s adaptive set',
        isDisabled: false,
      };
    }

    if (progress.completedAt) {
      return {
        buttonLabel: 'Review Daily Practice',
        statusText: 'Completed today',
        isDisabled: false,
      };
    }

    if (progress.answeredQuestions > 0) {
      return {
        buttonLabel: 'Resume Daily Practice',
        statusText: `${progress.answeredQuestions}/${progress.totalQuestions} answered`,
        isDisabled: false,
      };
    }

    return {
      buttonLabel: 'Start Daily Practice',
      statusText: `${progress.totalQuestions} questions ready`,
      isDisabled: false,
    };
  }, [
    todayDailyPracticeQuery.data?.progress,
    todayDailyPracticeQuery.error,
    todayDailyPracticeQuery.isPending,
  ]);

  const handleDailyPracticeClick = async () => {
    if (parsedId === null) {
      return;
    }
    if (dailyPracticeEntry.isDisabled) {
      return;
    }

    const searchParams = new URLSearchParams();
    const sessionId = todayDailyPracticeQuery.data?.sessionId;
    if (sessionId) {
      // Reusing the session id keeps refresh and explicit resume aligned with the backend-owned session lifecycle.
      searchParams.set('sessionId', sessionId);
    }
    const dailyPracticePath = `/main/modules/${parsedId}/daily-practice${
      searchParams.size > 0 ? `?${searchParams.toString()}` : ''
    }`;

    window.location.assign(dailyPracticePath);
  };

  const openStudentPracticeRoom = async (input: {
    unitId: string,
    questionId?: string,
    sessionType?: PracticeSessionType,
  }) => {
    if (parsedId === null) {
      return;
    }

    const searchParams = new URLSearchParams();
    if (input.questionId) {
      searchParams.set('questionId', input.questionId);
    }
    if (input.sessionType) {
      // Entry-mode query is only needed when opening a fresh session; once the room loads,
      // the server-issued sessionId becomes the canonical resume handle.
      searchParams.set('sessionType', input.sessionType);
    }
    const practiceRoomPath = `/main/modules/${parsedId}/${input.unitId}/practice-room${
      searchParams.size > 0 ? `?${searchParams.toString()}` : ''
    }`;

    window.location.assign(practiceRoomPath);
  };

  const handleOpenStudentPracticeRoom = async (
    unitId: string,
    questionId?: string,
  ) => {
    await openStudentPracticeRoom({ unitId, questionId });
  };

  const handleRetryStudentPracticeRoom = async (unitId: string) => {
    await openStudentPracticeRoom({
      unitId,
      sessionType: PracticeSessionTypeValues.retry,
    });
  };

  // toggling a unit's status is a common teacher interaction, so we
  // give it a dedicated handler that logs failures for monitoring.
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

  /**
   * Updates a module unit's title via mutation and handles error logging.
   */
  const handleUpdateUnitTitle = async (unitId: string, title: string) => {
    try {
      await updateModuleUnitMutation.mutateAsync({
        moduleUnitId: Number(unitId),
        payload: { title },
      });
    } catch (err) {
      if (shouldLogApiError(err)) {
        logError(err, { feature: 'module-unit', action: 'update-title', unitId });
      }
      throw err;
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
    dailyPracticeButtonLabel: dailyPracticeEntry.buttonLabel,
    dailyPracticeStatusText: dailyPracticeEntry.statusText,
    isDailyPracticeButtonDisabled: dailyPracticeEntry.isDisabled,
    handleDailyPracticeClick,
    handleOpenStudentPracticeRoom,
    handleRetryStudentPracticeRoom,
    handleCreateUnit,
    handleChangeUnitStatus,
    handleUpdateUnitTitle,
    handleModuleSaved,
  };
}
