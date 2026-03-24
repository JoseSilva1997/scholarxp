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
import MainSection from '@/components/MainSection';
import ModuleSettingsPanel from '@/components/Modules/ModuleSettingsPanel';
import CreateModuleUnitCard from '@/components/CreateModuleUnitCard';
import CreateModuleUnitModal from '@/components/Modals/CreateModuleUnitModal';
import ModuleUnitCard from '@/components/Modules/ModuleUnitCard';
import StudentModuleUnitCard from '@/components/Modules/StudentModuleUnitCard';
import { useSingleModulePageState } from '@/hooks/page-state/useSingleModulePageState';
import { useTheme } from '@/context/useTheme';
import styles from './SingleModulePage.module.css';
import { ProficiencyLevelBadge } from '@/components/SingleModulePage/ProficiencyLevelBadge';
import DebugMeta from '@/components/DebugMeta';

export default function SingleModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const {
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
  } = useSingleModulePageState({ moduleIdParam: moduleId, user });

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
                <div className={styles.titleGroup}>
                  <h1 className={styles.title}>{module.title}</h1>
                  <p className={styles.subtitle}>
                    {module.description}
                  </p>
                </div>

                {user && (canToggleStudentView || canEditSettings) && (
                  <div className={styles.actions}>
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
                              ? theme === 'dark'
                                ? untoggleStudentViewDarkIcon
                                : untoggleStudentViewIcon
                              : theme === 'dark'
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
                        onClick={() => setIsSettingsOpen((open) => !open)}
                      >
                        <IconContext.Provider value={{ className: styles.settingsIcon }}>
                          <IoSettingsSharp aria-hidden="true" />
                        </IconContext.Provider>
                      </button>
                    ) : null}
                  </div>
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
                    <ProficiencyLevelBadge level={module.userModuleLevel} />
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

              {canManageModuleContent &&
                moduleUnits.map((unit) => (
                  <ModuleUnitCard
                    key={unit.id}
                    unit={unit}
                    onChangeStatus={handleChangeUnitStatus}
                    onUpdateTitle={handleUpdateUnitTitle}
                  />
                ))}

              {canManageModuleContent ? (
                <div className={styles.createUnitCardRow}>
                  <CreateModuleUnitCard
                    onClick={() => setShowCreateUnit(true)}
                    isSaving={isCreatingUnit}
                  />
                </div>
              ) : null}

              {user?.globalRole === 'student' &&
                moduleUnits.map((unit) => {
                  const canStudentSee = unit.status === 'live' || unit.status === 'locked';
                  return canStudentSee ? (
                    <StudentModuleUnitCard
                      key={unit.id}
                      unit={unit}
                      onOpenPracticeRoom={handleOpenStudentPracticeRoom}
                      onRetryPracticeRoom={handleRetryStudentPracticeRoom}
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
          onToggle={() => setIsSettingsOpen((open) => !open)}
          onSaved={handleModuleSaved}
          canManageInvites={canManageInvites}
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
