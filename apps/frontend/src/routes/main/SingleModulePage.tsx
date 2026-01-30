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
import MainSection from '../../components/MainSection';
import ModuleSettingsPanel from '../../components/ModuleSettingsPanel';
import styles from './SingleModulePage.module.css';

export default function SingleModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { user } = useAuth();
  const [module, setModule] = useState<ModuleSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStudentViewEnabled, setIsStudentViewEnabled] = useState(false);
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
              <div className={styles.titleRow}>
                <h1 className={styles.title}>{module.title}</h1>
              </div>
              {user && (canToggleStudentView || canEditSettings) && (
                <>
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
                </>
              )}
              <div className={styles.metaRow}>
              </div>
            </header>

            <div className={styles.grid}>
              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Contents</h2>
                  <span className={styles.badgeMuted}>Module library</span>
                </div>
                <p className={styles.cardBody}>
                  Lessons, practice sets, and upcoming quests for this module will appear here. Select
                  an activity to continue where you left off.
                </p>
                <div className={styles.contentPlaceholders}>
                  <div className={styles.placeholderRow}>
                    <div className={styles.placeholderTitle} />
                    <div className={styles.placeholderMeta} />
                  </div>
                  <div className={styles.placeholderRow}>
                    <div className={styles.placeholderTitle} />
                    <div className={styles.placeholderMeta} />
                  </div>
                  <div className={styles.placeholderRow}>
                    <div className={styles.placeholderTitle} />
                    <div className={styles.placeholderMeta} />
                  </div>
                </div>
              </section>
            </div>
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
    </>
  );
}
