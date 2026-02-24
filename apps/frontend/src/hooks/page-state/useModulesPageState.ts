// Encapsulates ModulesPage orchestration so the route stays focused on rendering and layout.
import { useEffect, useMemo, useState } from 'react';
import type { CreateModulePayload } from '@scholarxp/api-contracts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import { logError } from '../../utils/logger';
import { canUserAccess } from '../../permissions/permission';
import { useCreateModuleMutation, useModulesListQuery } from '../queries/useModulesQueries';
import { features } from '@scholarxp/permissions';

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

export function useModulesPageState(): UseModulesPageStateResult {
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const isModulesQueryEnabled = !isAuthLoading && Boolean(user);
  const modulesQuery = useModulesListQuery(isModulesQueryEnabled);
  const createModuleMutation = useCreateModuleMutation();
  const canCreateModules = useMemo(() => canUserAccess(features.modules.create, user), [user]);

  useEffect(() => {
    if (!modulesQuery.error) return;
    if (shouldLogApiError(modulesQuery.error)) {
      logError(modulesQuery.error, { feature: 'modules', action: 'list' });
    }
  }, [modulesQuery.error]);

  const modules = modulesQuery.data ?? [];
  const isLoading = isModulesQueryEnabled && modulesQuery.isPending;
  const listErrorMessage = modulesQuery.error
    ? getDisplayErrorMessage(modulesQuery.error, {
        fallbackMessage:
          'We could not load your modules right now. Please try again.',
      })
    : null;

  const openCreateModal = () => {
    setCreateError(null);
    setShowCreate(true);
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    setCreateError(null);
  };

  const openModule = (moduleId: number) => {
    // Route to module detail page so users can drill into content quickly.
    navigate(`/main/modules/${moduleId}`);
  };

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

