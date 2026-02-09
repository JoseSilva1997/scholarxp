// Screen that lists modules for the logged-in user and manages module creation from one query-backed flow.
import { type CSSProperties } from 'react';
import ModuleCreateModal from '../../components/Modals/ModuleCreateModal';
import MainSection from '../../components/MainSection';
import { useModulesPageState } from '../../hooks/page-state/useModulesPageState';
import styles from './ModulesPage.module.css';

export default function ModulesPage() {
  const {
    user,
    modules,
    isLoading,
    listErrorMessage,
    canCreateModules,
    showCreate,
    createError,
    isCreating,
    openCreateModal,
    closeCreateModal,
    openModule,
    handleCreateModule,
  } = useModulesPageState();

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
              onClick={openCreateModal}
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
            const handleOpen = () => openModule(moduleSummary.id);

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
          onClose={closeCreateModal}
          onCreate={handleCreateModule}
          isSaving={isCreating}
          error={createError}
        />
      ) : null}
    </MainSection>
  );
}
