// Orchestrates data and actions for the Modules page route. This hook
// shields the component from complex logic like permission checks,
// navigation and API mutation handling; the component only cares about
// rendering the current state.
import { useEffect, useMemo, useState } from 'react';
import type { CreateModulePayload } from '@scholarxp/api-contracts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '@/shared/api/get-display-error';
import { logError } from '@/utils/logger';
import { canUserAccess } from '@/shared/permissions/permission';
import { useCreateModuleMutation, useModulesListQuery } from '@/Authoring/queries/useModulesQueries';
import { features } from '@scholarxp/permissions';

// return shape consumed by the page component. Keeping the return small
// allows future refactors without breaking callers.
type UseModulesPageStateResult = {
  user: ReturnType<typeof useAuth>['user'];
  modules: ReturnType<typeof useModulesListQuery>['data'] extends infer T
    ? T extends Array<infer Item>
      ? Item[]
      : []
    : [];
  isLoading: boolean;
  listErrorMessage: string | null;
  canCreateModules: boolean;
  showCreate: boolean;
  createError: string | null;
  isCreating: boolean;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openModule: (moduleId: number) => void;
  handleCreateModule: (payload: CreateModulePayload) => Promise<void>;
};

// Supplies ModulesPage with permission-aware list state, modal controls, and create-module side effects.
export function useModulesPageState(): UseModulesPageStateResult {
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const isModulesQueryEnabled = !isAuthLoading && Boolean(user);
  const modulesQuery = useModulesListQuery(isModulesQueryEnabled);
  const createModuleMutation = useCreateModuleMutation();
  const canCreateModules = useMemo(() => canUserAccess(features.modules.create, user), [user]);

  // log listing errors for diagnostics, but UI surfaces a friendlier
  // message via `listErrorMessage` below.
  useEffect(() => {
    if (!modulesQuery.error) return;
    if (shouldLogApiError(modulesQuery.error)) {
      logError(modulesQuery.error, { feature: 'modules', action: 'list' });
    }
  }, [modulesQuery.error]);


  // derive friendly values the page consumes; memoization isn't required here
  // since the parent component already handles re-renders sensibly.
  const modules = modulesQuery.data ?? [];
  const isLoading = isModulesQueryEnabled && modulesQuery.isPending;
  const listErrorMessage = modulesQuery.error
    ? getDisplayErrorMessage(modulesQuery.error, {
        fallbackMessage:
          'We could not load your modules right now. Please try again.',
      })
    : null;

  // user wants to add a new module; clear any old error and show the modal.
  const openCreateModal = () => {
    setCreateError(null);
    setShowCreate(true);
  };

  // hide the creation dialog and clear errors so it starts fresh next time.
  const closeCreateModal = () => {
    setShowCreate(false);
    setCreateError(null);
  };

  // navigate when the user clicks on a module row; keeps routing logic
  // out of the presentational component.
  const openModule = (moduleId: number) => {
    // Route to module detail page so users can drill into content quickly.
    navigate(`/main/modules/${moduleId}`);
  };

  // called by the create modal when user submits. handles API errors
  // gracefully and leaves the modal open so they can retry.
  const handleCreateModule = async (payload: CreateModulePayload) => {
    setCreateError(null);
    try {
      await createModuleMutation.mutateAsync(payload);
      setShowCreate(false);
    } catch (error) {
      setCreateError(
        getDisplayErrorMessage(error, {
          fallbackMessage: 'Could not create module. Please try again.',
        }),
      );
      if (shouldLogApiError(error)) {
        logError(error, { feature: 'modules', action: 'create' });
      }
    }
  };

  return {
    user,
    modules,
    isLoading,
    listErrorMessage,
    canCreateModules,
    showCreate,
    createError,
    isCreating: createModuleMutation.isPending,
    openCreateModal,
    closeCreateModal,
    openModule,
    handleCreateModule,
  };
}
