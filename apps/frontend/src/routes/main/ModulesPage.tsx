// Screen that lists modules for the logged-in user; split out so the app shell can host other sections.
import { useEffect, useMemo, useState } from 'react';
import { listModules } from '../../api/modules';
import type { ModuleSummary } from '../../types/module';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { logError } from '../../utils/logger';
import ModuleCreateModal from '../../components/ModuleCreateModal';
import MainSection from '../../components/MainSection';
import styles from './ModulesPage.module.css';

export default function ModulesPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Fetch modules once auth is ready; cancel flag avoids setting state after unmount.
  useEffect(() => {
    if (isAuthLoading || !user) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await listModules();
        if (!cancelled) {
          setModules(result);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 401) {
            setError('Your session expired. Please sign in again.');
          } else if (err.status === 403) {
            setError("You don't have permission to view modules yet.");
          } else {
            setError('We could not load your modules right now. Please try again.');
          }
        } else {
          setError('We could not load your modules right now. Please try again.');
        }
        logError(err, { feature: 'modules', action: 'list' });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, user]);

  const canCreate = useMemo(
    () =>
      user?.globalRole === 'admin' ||
      user?.globalRole === 'institution_admin' ||
      user?.globalRole === 'teacher',
    [user],
  );

  return (
    <MainSection>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Welcome back</p>
          <h1 className={styles.title}>Your modules</h1>
          <p className={styles.subtitle}>
            {user?.globalRole === 'student'
              ? 'View the modules you are enrolled in.'
              : 'Create, manage, and track the modules you teach.'}
          </p>
        </div>
        {canCreate ? (
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => setShowCreate(true)}
          >
            Create module
          </button>
        ) : null}
      </header>

      {isLoading ? (
        <div className={styles.panel}>Loading your modules…</div>
      ) : error ? (
        <div className={styles.panel} role="alert">
          {error}
        </div>
      ) : modules.length === 0 ? (
        <div className={styles.panel}>
          {canCreate
            ? "You don't have any modules yet. Create one to get started."
            : 'No modules found for your account.'}
        </div>
      ) : (
        <div className={styles.grid}>
          {modules.map((m) => (
            <article key={m.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{m.title}</h3>
                <span className={styles.badge}>{m.variantContext}</span>
              </div>
              <p className={styles.cardDescription}>
                {m.description ?? 'No description provided.'}
              </p>
              <div className={styles.meta}>
                {m.institutionId ? (
                  <span className={styles.metaItem}>Institution #{m.institutionId}</span>
                ) : (
                  <span className={styles.metaItem}>No institution</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreate ? (
        <ModuleCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(created) => setModules((prev) => [created, ...prev])}
        />
      ) : null}
    </MainSection>
  );
}
