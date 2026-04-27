// Screen that lists modules for the logged-in user and manages module creation from one query-backed flow.
import { type CSSProperties } from 'react';
import { FaCirclePlus } from 'react-icons/fa6';
import ModuleCreateModal from '@/Authoring/Modules/components/ModuleCreateModal';
import MainSection from '@/MainApp/MainSection/MainSection';
import { useModulesPageState } from '@/Authoring/Modules/page-state/useModulesPageState';
import styles from '@/Authoring/Modules/ModulesPage.module.css';

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
              <FaCirclePlus className={styles.createIcon} />
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
              'var(--module-card-blue)',
              'var(--module-card-green)',
              'var(--module-card-purple)',
              'var(--module-card-orange)',
              'var(--module-card-pink)',
              'var(--module-card-indigo)',
              'var(--module-card-teal)',
              'var(--module-card-red)',
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
                  <span className={styles.metaItem}>
                    {moduleSummary.createdByName ?? 'Unknown author'}
                  </span>
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
