// Screen that shows details and content entry points for a single module using query-backed server state.
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { IconContext } from 'react-icons';
import { IoSettingsSharp } from 'react-icons/io5';
import toggleStudentViewIcon from '../../assets/toggle-student-view.svg';
import untoggleStudentViewIcon from '../../assets/untoggle-student-view.svg';
import expIcon from '../../assets/exp_icon.svg';
import MainSection from '../../components/MainSection';
import ModuleSettingsPanel from '../../components/ModuleSettingsPanel';
import CreateModuleUnitCard from '../../components/CreateModuleUnitCard';
import CreateModuleUnitModal from '../../components/Modals/CreateModuleUnitModal';
import ModuleUnitCard from '../../components/ModuleUnitCard';
import StudentModuleUnitCard from '../../components/StudentModuleUnitCard';
import { useSingleModulePageState } from '../../hooks/useSingleModulePageState';
import styles from './SingleModulePage.module.css';

export default function SingleModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { user } = useAuth();
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
    isCreatingUnit,
    handleCreateUnit,
    handleChangeUnitStatus,
    handleModuleSaved,
  } = useSingleModulePageState({ moduleIdParam: moduleId, user });

  return (
    <>
      <MainSection className={styles.container}>
        <div className={styles.topBar}>
          <Link className={styles.backLink} to="/main/modules">
            ← Back to modules
          </Link>
        </div>

        {isLoading ? (
          <div className={styles.panel}>Loading module…</div>
        ) : pageError ? (
          <div className={styles.panel} role="alert">
            {pageError}
          </div>
        ) : module ? (
          <>
            <header className={styles.header}>
              <div className={styles.titleGroup}>
                <div className={styles.titleRow}>
                  <h1 className={styles.title}>{module.title}</h1>
                  {user && (canToggleStudentView || canEditSettings) && (
                    <div className={styles.actions}>
                      {canToggleStudentView ? (
                        <button
                          className={styles.toggleButton}
                          type="button"
                          aria-label={isStudentViewEnabled ? 'Disable student view' : 'Enable student view'}
                          title={isStudentViewEnabled ? 'Disable student view' : 'Enable student view'}
                          onClick={() => setIsStudentViewEnabled(!isStudentViewEnabled)}
                        >
                          <img
                            src={isStudentViewEnabled ? untoggleStudentViewIcon : toggleStudentViewIcon}
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
              </div>
              <div className={styles.metaRow}></div>
            </header>
            {canManageModuleContent &&
              moduleUnits.map((unit) => (
                <ModuleUnitCard key={unit.id} unit={unit} onChangeStatus={handleChangeUnitStatus} />
              ))}
            {canManageModuleContent ? (
              // Only show the creation entry point to roles granted modules.createContent so students stay read-only here.
              <div className={styles.createUnitCardRow}>
                <CreateModuleUnitCard
                  onClick={() => setShowCreateUnit(true)}
                  isSaving={isCreatingUnit}
                />
              </div>
            ) : null}
            {user?.globalRole === 'student' && module.userModuleLevel !== undefined ? (
              <>
                <div className={styles.progressContainer}>
                  <div className={styles.progressRow} aria-label="Module progress">
                    {/* Mirrors the badge progress but scoped to this module so students see their progress contextually. */}
                    <span className={styles.level}>
                      <img src={expIcon} alt="" aria-hidden="true" className={styles.levelIcon} />
                      Level {module.userModuleLevel}
                    </span>
                    <div
                      className={styles.barTrack}
                      role="progressbar"
                      aria-valuenow={expPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className={styles.barFill} style={{ width: `${expPercent}%` }} />
                    </div>
                    <span className={styles.expLabel}>{module.currentExp ?? 0} xp</span>
                  </div>
                  <button
                    type="button"
                    className={styles.dailyRevisionButton}
                    onClick={() => alert('Daily revision coming soon! 🎯')}
                  >
                    <span className={styles.dailyRevisionIcon}>⚡</span>
                    <span className={styles.dailyRevisionText}>
                      <span className={styles.dailyRevisionLabel}>Daily Revision</span>
                    </span>
                  </button>
                </div>
                {moduleUnits.map((unit) => {
                  const canStudentSee = unit.status === 'live' || unit.status === 'locked';
                  return canStudentSee ? <StudentModuleUnitCard key={unit.id} unit={unit} /> : null;
                })}
              </>
            ) : null}
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
