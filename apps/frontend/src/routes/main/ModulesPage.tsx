// Screen that lists modules for the logged-in user and manages module creation from one query-backed flow.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { CreateModulePayload } from '@scholarxp/api-contracts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import { logError } from '../../utils/logger';
import ModuleCreateModal from '../../components/Modals/ModuleCreateModal';
import MainSection from '../../components/MainSection';
import { canUserAccess } from '../../permissions/permission';
import { useCreateModuleMutation, useModulesListQuery } from '../../hooks/useModulesQueries';
import styles from './ModulesPage.module.css';

export default function ModulesPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const isModulesQueryEnabled = !isAuthLoading && Boolean(user);
  const modulesQuery = useModulesListQuery(isModulesQueryEnabled);
  const createModuleMutation = useCreateModuleMutation();
  const canCreateModules = useMemo(() => canUserAccess('modules.create', user), [user]);

  // Keep telemetry for module-list failures centralized without cluttering render branches.
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

  const handleCreateModule = async (payload: CreateModulePayload) => {
    setCreateError(null);
    try {
      const created = await createModuleMutation.mutateAsync(payload);
      setShowCreate(false);
      navigate(`/main/modules/${created.id}`);
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

  return (
    <MainSection>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.title}>Your modules</h1>
          <p className={styles.subtitle}>
            {user?.globalRole === 'student'
              ? 'View the modules you are enrolled in.'
              : 'Create, manage, and track the modules you teach.'}
          </p>
        </div>
        {canCreateModules ? (
          <div className={styles.createAction}>
            <span className={styles.createLabel}>Create module</span>
            <button
              className={styles.createButton}
              type="button"
              onClick={() => {
                setCreateError(null);
                setShowCreate(true);
              }}
              aria-label="Open create module form"
            >
              +
            </button>
          </div>
        ) : null}
      </header>

      {isLoading ? (
        <div className={styles.panel}>Loading your modules…</div>
      ) : listErrorMessage ? (
        <div className={styles.panel} role="alert">
          {listErrorMessage}
        </div>
      ) : modules.length === 0 ? (
        <div className={styles.panel}>
          {canCreateModules
            ? "You don't have any modules yet. Create one to get started."
            : 'No modules found for your account.'}
        </div>
      ) : (
        <div className={styles.grid}>
          {modules.map((moduleSummary) => {
            // Expanded array of module card colors from theme for more visual variety.
            const moduleCardColors = [
              'var(--module-card-green-dark)',
              'var(--module-card-green-medium)',
              'var(--module-card-green-light)',
              'var(--module-card-yellow-dark)',
              'var(--module-card-yellow-medium)',
              'var(--module-card-yellow-light)',
              'var(--module-card-blue-dark)',
              'var(--module-card-blue-medium)',
              'var(--module-card-blue-light)',
              'var(--module-card-purple-dark)',
              'var(--module-card-purple-medium)',
              'var(--module-card-purple-light)',
              'var(--module-card-orange-dark)',
              'var(--module-card-orange-medium)',
              'var(--module-card-orange-light)',
              'var(--module-card-teal-dark)',
              'var(--module-card-teal-medium)',
              'var(--module-card-teal-light)',
              'var(--module-card-red-dark)',
              'var(--module-card-red-medium)',
              'var(--module-card-red-light)',
              'var(--module-card-pink-dark)',
              'var(--module-card-pink-medium)',
              'var(--module-card-pink-light)',
              'var(--module-card-dark-dark)',
              'var(--module-card-dark-medium)',
              'var(--module-card-dark-light)',
            ];
            const cardColor = moduleCardColors[moduleSummary.id % moduleCardColors.length];
            const handleOpen = () => {
              // Route to module detail page so users can drill into content quickly.
              navigate(`/main/modules/${moduleSummary.id}`);
            };

            return (
              <article
                key={moduleSummary.id}
                className={styles.card}
                style={{ '--card-color': cardColor } as CSSProperties}
                role="button"
                tabIndex={0}
                onClick={handleOpen}
                onKeyDown={(evt) => {
                  if (evt.key === 'Enter' || evt.key === ' ') {
                    evt.preventDefault();
                    handleOpen();
                  }
                }}
              >
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{moduleSummary.title}</h3>
                </div>
                <p className={styles.cardDescription}>
                  {moduleSummary.description ?? 'No description provided.'}
                </p>
                <div className={styles.meta}>
                  {moduleSummary.institutionId ? (
                    <span className={styles.metaItem}>
                      Institution #{moduleSummary.institutionId}
                    </span>
                  ) : (
                    <span className={styles.metaItem}>No institution</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showCreate ? (
        <ModuleCreateModal
          onClose={() => {
            setShowCreate(false);
            setCreateError(null);
          }}
          onCreate={handleCreateModule}
          isSaving={createModuleMutation.isPending}
          error={createError}
        />
      ) : null}
    </MainSection>
  );
}

