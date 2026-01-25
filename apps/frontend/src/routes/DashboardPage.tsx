import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user, signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep logout behavior here so the UI can handle errors.
  const handleLogout = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign out');
    } finally {
      setSubmitting(false);
    }
  };

  // This route should be guarded, but keep a null-render fallback.
  if (!user) return null;

  return (
    <div className="page">
      <header className="hero">
        <p className="pill">ScholarXP • Daily practice companion</p>
        <h1>Welcome back, {user.firstName}</h1>
        <p className="subtitle">
          Your next practice set is ready. Keep the streak going and earn XP as you master course
          content.
        </p>
      </header>

      <main className="panel">
        <section className="card summary">
          <h2>Session status</h2>
          <div className="user">
            <p className="name">{user.firstName + ' ' + user.lastName}</p>
            <p className="meta">{user.email ?? 'No email on file'}</p>
            <p className="meta">Role: {user.globalRole}</p>
            <button type="button" onClick={handleLogout} disabled={submitting}>
              {submitting ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
          {error && <div className="alert error">{error}</div>}
        </section>

        <section className="card">
          <h2>Daily focus</h2>
          <p className="meta">
            Start with short, repeatable sessions to build mastery. We’ll surface today’s questions
            once your course data is connected.
          </p>
        </section>
      </main>
    </div>
  );
}
