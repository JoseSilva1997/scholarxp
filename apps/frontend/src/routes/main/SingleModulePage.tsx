// Screen that shows details and content entry points for a single module using query-backed server state.
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { IconContext } from 'react-icons';
import { IoSettingsSharp } from 'react-icons/io5';
import toggleStudentViewIcon from '../../assets/toggle-student-view.svg';
import toggleStudentViewDarkIcon from '../../assets/toggle-student-view-dark.svg';
import untoggleStudentViewIcon from '../../assets/untoggle-student-view.svg';
import untoggleStudentViewDarkIcon from '../../assets/untoggle-student-view-dark.svg';
import expIcon from '../../assets/exp_icon.svg';
import MainSection from '../../components/MainSection';
import ModuleSettingsPanel from '../../components/ModuleSettingsPanel';
import CreateModuleUnitCard from '../../components/CreateModuleUnitCard';
import CreateModuleUnitModal from '../../components/Modals/CreateModuleUnitModal';
import ModuleUnitCard from '../../components/ModuleUnitCard';
import StudentModuleUnitCard from '../../components/StudentModuleUnitCard';
import { useSingleModulePageState } from '../../hooks/page-state/useSingleModulePageState';
import { useTheme } from '../../context/ThemeContext';
import styles from './SingleModulePage.module.css';

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
    handleCreateUnit,
    handleChangeUnitStatus,
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
                    {module.description ||
                      'Master your knowledge through consistent practice and revision.'}
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
            </header>

            <div className={styles.contentWrapper}>
              {user?.globalRole === 'student' && module.userModuleLevel !== undefined ? (
                <div className={styles.progressContainer}>
                  <div className={styles.progressRow} aria-label="Module progress">
                    <div className={styles.levelBadge}>
                      <img src={expIcon} alt="" aria-hidden="true" className={styles.levelIcon} />
                      <span>Level {module.userModuleLevel}</span>
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
                    <div className={styles.expGroup}>
                      <span className={styles.expLabel}>{module.currentExp ?? 0}</span>
                      <span className={styles.expTotal}>/ {expMax} XP</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.dailyRevisionButton}
                    onClick={() => alert('Daily revision coming soon! 🎯')}
                  >
                    <span className={styles.dailyRevisionIcon}>⚡</span>
                    <span>Daily Revision</span>
                  </button>
                </div>
              ) : null}

              {canManageModuleContent &&
                moduleUnits.map((unit) => (
                  <ModuleUnitCard key={unit.id} unit={unit} onChangeStatus={handleChangeUnitStatus} />
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
                  return canStudentSee ? <StudentModuleUnitCard key={unit.id} unit={unit} /> : null;
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
