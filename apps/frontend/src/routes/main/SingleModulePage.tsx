// Screen that shows details and content entry points for a single module; reached from the modules grid.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getModuleById } from '../../api/modules';
import type { ModuleSummary } from '../../types/module';
import { ApiError } from '../../api/client';
import { logError } from '../../utils/logger';
import { useAuth } from '../../context/AuthContext';
import { canUserAccess } from '../../permissions/permission';
import settingsIcon from '../../assets/settings-icon.svg';
import toggleStudentViewIcon from '../../assets/toggle-student-view.svg';
import untoggleStudentViewIcon from '../../assets/untoggle-student-view.svg';
import expIcon from '../../assets/exp_icon.svg';
import MainSection from '../../components/MainSection';
import ModuleSettingsPanel from '../../components/ModuleSettingsPanel';
import CreateModuleUnitCard from '../../components/CreateModuleUnitCard';
import CreateModuleUnitModal from '../../components/Modals/CreateModuleUnitModal';
import ModuleUnitCard, { type ModuleUnit } from '../../components/ModuleUnitCard';
import { MODULE_EXP_MAX } from '../../constants/progression';
import styles from './SingleModulePage.module.css';

export default function SingleModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { user } = useAuth();
  const [module, setModule] = useState<ModuleSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStudentViewEnabled, setIsStudentViewEnabled] = useState(false);
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [moduleUnits, setModuleUnits] = useState<ModuleUnit[]>([]);
  // Local slide-over flag keeps the settings UI contained on this screen without routing away.
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const parsedId = useMemo(() => {
    if (!moduleId) return null;
    const value = Number(moduleId);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [moduleId]);

  const canEditSettings = useMemo(() => canUserAccess('modules.settings', user), [user]);
  const canToggleStudentView = useMemo(
    () => canUserAccess('modules.toggleStudentView', user),
    [user],
  );
  const canCreateModuleContent = useMemo(
    () => canUserAccess('modules.createContent', user),
    [user],
  );

  // Load the module once the id is known; guards against invalid ids to avoid noisy network calls.
  useEffect(() => {
    if (!parsedId) {
      setError('Module not found. Please check the link and try again.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getModuleById(parsedId);
        if (!cancelled) {
          setModule(result);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setError('This module was not found or is no longer available.');
          } else if (err.status === 403) {
            setError("You don't have permission to view this module.");
          } else if (err.status === 401) {
            setError('Your session expired. Please sign in again.');
          } else {
            setError('We could not load this module right now. Please try again.');
          }
        } else {
          setError('We could not load this module right now. Please try again.');
        }
        logError(err, { feature: 'modules', action: 'detail', moduleId: parsedId });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [parsedId]);

  const expMax = useMemo(() => {
    if (!module) return MODULE_EXP_MAX;
    // Prefer module-specific cap when backend provides it so future tuning is seamless.
    return module.expMax && module.expMax > 0 ? module.expMax : MODULE_EXP_MAX;
  }, [module]);

  const expPercent = useMemo(() => {
    if (!module || module.currentExp === undefined || module.currentExp === null) return 0;
    if (expMax <= 0) return 0;
    return Math.min(100, Math.round((module.currentExp / expMax) * 100));
  }, [module, expMax]);

  const handleCreateUnit = (title: string) => {
    // Local-only creation for now; default to draft with a starter question group placeholder.
    setModuleUnits((prev) => [
      {
        id: crypto.randomUUID(),
        title,
        status: 'draft',
        questionGroups: [
          {
            id: crypto.randomUUID(),
            title: 'Default question group',
            questions: [],
          },
        ],
      },
      ...prev,
    ]);
  };

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
        ) : error ? (
          <div className={styles.panel} role="alert">
            {error}
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
                          <img src={settingsIcon} alt="" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.metaRow}>
              </div>
            </header>
            {moduleUnits.map((unit) => (
              <ModuleUnitCard key={unit.id} unit={unit} />
            ))}
            {canCreateModuleContent ? (
              // Only show the creation entry point to roles granted modules.createContent so students stay read-only here.
              <div className={styles.createUnitCardRow}>
                <CreateModuleUnitCard onClick={() => setShowCreateUnit(true)} />
              </div>
            ) : null}
            {user?.globalRole === 'student' && module.userModuleLevel !== undefined ? (
              <>
                <div className={styles.progressRow} aria-label="Module progress">
                  {/* Mirrors the badge progress but scoped to this module so students see their progress contextually. */}
                  <span className={styles.level}>
                    <img src={expIcon} alt="" aria-hidden="true" className={styles.levelIcon} />
                    Level {module.userModuleLevel}
                  </span>
                  <div className={styles.barTrack} role="progressbar" aria-valuenow={expPercent} aria-valuemin={0} aria-valuemax={100}>
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
          onSaved={(updated) => setModule(updated)}
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
