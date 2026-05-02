// Screen that shows details and content entry points for a single module using query-backed server state.
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { IconContext } from 'react-icons';
import { IoSettingsSharp } from 'react-icons/io5';
import { BsInfoCircle, BsLightningChargeFill } from 'react-icons/bs';
import toggleStudentViewIcon from '@/assets/toggle-student-view.svg';
import toggleStudentViewDarkIcon from '@/assets/toggle-student-view-dark.svg';
import untoggleStudentViewIcon from '@/assets/untoggle-student-view.svg';
import untoggleStudentViewDarkIcon from '@/assets/untoggle-student-view-dark.svg';
import expIcon from '@/assets/exp_icon.svg';
import MainSection from '@/MainApp/MainSection/MainSection';
import ModuleSettingsPanel from '@/Authoring/SingleModule/components/ModuleSettingsPanel';
import CreateModuleUnitCard from '@/Authoring/SingleModule/components/CreateModuleUnitCard';
import CreateModuleUnitModal from '@/Authoring/SingleModule/components/CreateModuleUnitModal';
import ModuleUnitCard from '@/Authoring/SingleModule/components/ModuleUnitCard';
import StudentModuleUnitCard from '@/Authoring/SingleModule/components/StudentModuleUnitCard';
import { useSingleModulePageState } from '@/Authoring/SingleModule/page-state/useSingleModulePageState';
import { useTheme } from '@/context/useTheme';
import { useMemo } from 'react';
import { features } from '@scholarxp/permissions';
import { canUserAccess } from '@/shared/permissions/permission';
import styles from '@/Authoring/SingleModule/SingleModulePage.module.css';
import { ProficiencyBadge } from '@/Rewards/components/ProficiencyBadge';
import DebugMeta from '@/MainApp/DebugMeta';

// Renders the single-module workspace for tutors and students based on permission-derived state.
export default function SingleModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { user } = useAuth();
  // Icon assets only care about the explicit light/dark variant, not which color family the user picked.
  const { resolvedTheme } = useTheme();
  const {
    module,
    moduleUnits,
    isLoading,
    pageError,
    canEditSettings,
    canToggleStudentView,
    canManageModuleContent,
    canManageInvites,
    canDeleteModule,
    isArchiveConfirmOpen,
    archiveImpact,
    archiveImpactError,
    isArchiveImpactLoading,
    isArchivingModule,
    archiveModuleError,
    isStudentViewEnabled,
    setIsStudentViewEnabled,
    showCreateUnit,
    setShowCreateUnit,
    isSettingsOpen,
    setIsSettingsOpen,
    expPercent,
    expMax,
    isCreatingUnit,
    dailyPracticeButtonLabel,
    dailyPracticeStatusText,
    dailyPracticeTooltip,
    isDailyPracticeButtonDisabled,
    handleDailyPracticeClick,
    handleOpenStudentPracticeRoom,
    handleRetryStudentPracticeRoom,
    handleCreateUnit,
    handleChangeUnitStatus,
    handleUpdateUnitTitle,
    handleModuleSaved,
    handleRequestArchiveModule,
    handleCancelArchiveModule,
    handleConfirmArchiveModule,
  } = useSingleModulePageState({ moduleIdParam: moduleId, user });

  const canViewRoster = useMemo(() => canUserAccess(features.modules.roster, user), [user]);
  // Toggles the settings drawer and clears pending archive confirmation when closing it.
  const handleToggleSettings = () => {
    if (isSettingsOpen) {
      handleCancelArchiveModule();
    }
    setIsSettingsOpen((open) => !open);
  };

  return (
    <>
      {/* Keep underlying action controls visually subdued whenever a foreground overlay is active. */}
      <MainSection
        className={`${styles.container} ${showCreateUnit || isSettingsOpen ? styles.modalOpen : ''}`}
      >
        <div className={styles.topBar}>
          <Link className={styles.backLink} to="/main/modules">
            ← Back to modules
          </Link>
        </div>

        {isLoading ? (
          <div className={styles.contentWrapper}>
            <div className={styles.panel}>Gathering module details…</div>
          </div>
        ) : pageError ? (
          <div className={styles.contentWrapper}>
            <div className={styles.panel} role="alert">
              {pageError}
            </div>
          </div>
        ) : module ? (
          <>
            <header className={styles.header}>
              <div className={styles.headerContent}>
                <div className={styles.titleRow}>
                  <h1 className={styles.title}>{module.title}</h1>

                  {user && (canToggleStudentView || canEditSettings || canViewRoster) && (
                    <div className={styles.actions}>
                      {canViewRoster && moduleId && (
                        <Link
                          to={`/main/modules/${moduleId}/roster`}
                          className={styles.rosterLink}
                        >
                          Manage Roster
                        </Link>
                      )}
                      {canToggleStudentView ? (
                        <button
                          className={styles.toggleButton}
                          type="button"
                          aria-label={
                            isStudentViewEnabled ? 'Disable student view' : 'Enable student view'
                          }
                          title={
                            isStudentViewEnabled ? 'Disable student view' : 'Enable student view'
                          }
                          onClick={() => setIsStudentViewEnabled(!isStudentViewEnabled)}
                        >
                          <img
                            src={
                              isStudentViewEnabled
                                ? resolvedTheme === 'dark'
                                  ? untoggleStudentViewDarkIcon
                                  : untoggleStudentViewIcon
                                : resolvedTheme === 'dark'
                                  ? toggleStudentViewDarkIcon
                                  : toggleStudentViewIcon
                            }
                            alt=""
                            aria-hidden="true"
                          />
                        </button>
                      ) : null}
                      {canEditSettings ? (
                        <button
                          className={styles.settingsButton}
                          type="button"
                          aria-label="Module settings"
                          title="Module settings"
                          aria-expanded={isSettingsOpen}
                          onClick={handleToggleSettings}
                        >
                          <IconContext.Provider value={{ className: styles.settingsIcon }}>
                            <IoSettingsSharp aria-hidden="true" />
                          </IconContext.Provider>
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>

                <p className={styles.subtitle}>
                  {module.description}
                </p>
                {canManageModuleContent && moduleUnits.length > 0 && (
                  <p className={styles.moduleSummary}>
                    {moduleUnits.length} {moduleUnits.length === 1 ? 'lesson' : 'lessons'}
                    {' · '}
                    {moduleUnits.reduce((sum, u) => sum + u.questionCount, 0)} questions
                    {' · '}
                    {moduleUnits.filter((u) => u.status === 'live').length} live
                  </p>
                )}
              </div>
              <DebugMeta
                entries={[
                    { label: 'moduleId', value: moduleId },
                    { label: 'userId', value: user?.id ?? 'null' },
                ]}
            />
            </header>

            <div className={styles.contentWrapper}>
              {user?.globalRole === 'student' && module.userModuleLevel !== undefined ? (
                <div className={styles.progressContainer}>
                  <div className={styles.badgeSection}>
                    <ProficiencyBadge level={module.userModuleLevel} />
                  </div>

                  <div className={styles.progressData}>
                    <div className={styles.progressHeader}>
                      <span className={styles.progressTitle}>Proficiency Level</span>
                      <div className={styles.expGroup}>
                        <img src={expIcon} alt="" aria-hidden="true" className={styles.expIconSmall} />
                        <span className={styles.expLabel}>{module.currentExp ?? 0}</span>
                        <span className={styles.expTotal}>/ {expMax} XP</span>
                      </div>
                    </div>
                    
                    <div
                      className={styles.barTrack}
                      role="progressbar"
                      aria-valuenow={expPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className={styles.barFill} style={{ width: `${expPercent}%` }} />
                    </div>
                  </div>

                  <div className={styles.progressActions}>
                    <div className={styles.dailyPracticeButtonWrapper}>
                      <button
                        type="button"
                        className={styles.dailyRevisionButton}
                        disabled={isDailyPracticeButtonDisabled}
                        onClick={() => {
                          void handleDailyPracticeClick();
                        }}
                      >
                        <BsLightningChargeFill className={styles.dailyRevisionIcon} aria-hidden="true" />
                        <span>{dailyPracticeButtonLabel}</span>
                      </button>
                      {dailyPracticeTooltip ? (
                        <div className={styles.dailyPracticeInfoWrapper}>
                          <button
                            type="button"
                            className={styles.dailyPracticeInfoButton}
                            aria-label={dailyPracticeTooltip}
                          >
                            <BsInfoCircle aria-hidden="true" />
                          </button>
                          <div className={styles.dailyPracticeInfoTooltip} role="tooltip">
                            {dailyPracticeTooltip}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {dailyPracticeStatusText ? (
                      <p className={styles.dailyPracticeStatus}>{dailyPracticeStatusText}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {canManageModuleContent && !isStudentViewEnabled &&
                moduleUnits.map((unit) => (
                  <ModuleUnitCard
                    key={unit.id}
                    unit={unit}
                    onChangeStatus={handleChangeUnitStatus}
                    onUpdateTitle={handleUpdateUnitTitle}
                  />
                ))}

              {canManageModuleContent && !isStudentViewEnabled ? (
                <div className={styles.createUnitCardRow}>
                  <CreateModuleUnitCard
                    onClick={() => setShowCreateUnit(true)}
                    isSaving={isCreatingUnit}
                  />
                </div>
              ) : null}

              {(user?.globalRole === 'student' || isStudentViewEnabled) &&
                moduleUnits.map((unit) => {
                  const canStudentSee = unit.status === 'live' || unit.status === 'locked';
                  return canStudentSee ? (
                    <StudentModuleUnitCard
                      key={unit.id}
                      unit={unit}
                      // Tutors previewing student view must not be able to enter a real practice room.
                      onOpenPracticeRoom={isStudentViewEnabled ? undefined : handleOpenStudentPracticeRoom}
                      onRetryPracticeRoom={isStudentViewEnabled ? undefined : handleRetryStudentPracticeRoom}
                    />
                  ) : null;
                })}
            </div>
          </>
        ) : null}
      </MainSection>

      {canEditSettings ? (
        <ModuleSettingsPanel
          module={module}
          isOpen={isSettingsOpen}
          onToggle={handleToggleSettings}
          onSaved={handleModuleSaved}
          canManageInvites={canManageInvites}
          canDeleteModule={canDeleteModule}
          isArchiveConfirmOpen={isArchiveConfirmOpen}
          archiveImpact={archiveImpact}
          archiveImpactError={archiveImpactError}
          isArchiveImpactLoading={isArchiveImpactLoading}
          isArchivingModule={isArchivingModule}
          archiveModuleError={archiveModuleError}
          onRequestArchiveModule={handleRequestArchiveModule}
          onCancelArchiveModule={handleCancelArchiveModule}
          onConfirmArchiveModule={() => {
            void handleConfirmArchiveModule();
          }}
        />
      ) : null}
      <CreateModuleUnitModal
        isOpen={showCreateUnit}
        onClose={() => setShowCreateUnit(false)}
        onCreate={handleCreateUnit}
      />
    </>
  );
}
