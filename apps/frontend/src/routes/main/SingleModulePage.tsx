// Screen that shows details and content entry points for a single module; reached from the modules grid.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createModuleUnit,
  getModuleById,
  updateModuleUnitStatus,
  getModuleUnits,
} from '../../api/modules';
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
import StudentModuleUnitCard from '../../components/StudentModuleUnitCard';
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
  const [isSavingUnit, setIsSavingUnit] = useState(false);
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
  const canManageModuleContent = useMemo(
    () => canUserAccess('modules.manageContent', user),
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
        const [moduleResult, unitResults] = await Promise.all([
          getModuleById(parsedId),
          getModuleUnits(parsedId),
        ]);
        if (!cancelled) {
          setModule(moduleResult);
          setModuleUnits(
            unitResults.map((u) => ({
              id: String(u.id),
              title: u.title,
              status: u.status,
              questionGroups: (u.questionGroups ?? []).map((g) => ({
                id: String(g.id),
                title: g.name,
                questions: [],
              })),
            })),
          );
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
    if (!module) return;
    setIsSavingUnit(true);
    createModuleUnit(module.id, title)
      .then((created) => {
        setModuleUnits((prev) => [
          {
            id: String(created.id),
            title: created.title,
            status: created.status,
            questionGroups: created.questionGroups.map((g) => ({
              id: String(g.id),
              title: g.name,
              questions: [],
            })),
          },
          ...prev,
        ]);
      })
      .catch((err) => {
        // Keep user-facing message generic; log details for diagnostics.
        setError('Could not create the module unit. Please try again.');
        logError(err, { feature: 'module-unit', action: 'create', moduleId: module.id });
      })
      .finally(() => setIsSavingUnit(false));
  };

  const handlePublishUnit = async (unitId: string) => {
    if (!module) return;
    try {
      const numericId = Number(unitId);
      const updated = await updateModuleUnitStatus(numericId, 'locked');
      setModuleUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? {
                ...u,
                status: updated.status,
              }
            : u,
        ),
      );
    } catch (err) {
      setError('Could not publish the lesson. Please try again.');
      logError(err, { feature: 'module-unit', action: 'publish', moduleUnitId: unitId });
    }
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
            {canManageModuleContent && moduleUnits.map((unit) => {
              return <ModuleUnitCard key={unit.id} unit={unit} onPublish={handlePublishUnit} />;
            })}
            {canManageModuleContent ? (
              // Only show the creation entry point to roles granted modules.createContent so students stay read-only here.
              <div className={styles.createUnitCardRow}>
                <CreateModuleUnitCard onClick={() => setShowCreateUnit(true)} isSaving={isSavingUnit} />
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
