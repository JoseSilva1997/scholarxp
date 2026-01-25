import { useMemo, useState } from 'react';
import { AuthForm } from '../components/AuthForm';
import type { AuthFormData, AuthMode } from '../components/AuthForm';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);

  const title = useMemo(
    () => (mode === 'login' ? 'Sign in to ScholarXP' : 'Create your ScholarXP account'),
    [mode],
  );

  const resetMessages = () => {
    setError(null);
    setStatus(null);
  };

  // Translate form data into the specific auth calls.
  const handleSubmit = async (data: AuthFormData) => {
    resetMessages();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn({
          email: data.email,
          password: data.password,
        });
        setStatus('Signed in successfully.');
      } else {
        await signUp({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
        });
        setStatus('Account created. Welcome to ScholarXP!');
      }
      // Force a clean form after a successful auth action.
      setFormResetKey((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <p className="pill">ScholarXP • Daily practice companion</p>
        <h1>{title}</h1>
        <p className="subtitle">
          Build momentum with short, repeatable sessions and earn XP as you master course content.
        </p>
        <div className="mode-switch">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              resetMessages();
              setMode('login');
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              resetMessages();
              setMode('register');
            }}
          >
            Create account
          </button>
        </div>
      </header>

      <main className="panel">
        <section className="card">
          <AuthForm
            key={`${mode}-${formResetKey}`}
            mode={mode}
            submitting={submitting}
            onSubmit={handleSubmit}
          />

          {error && <div className="alert error">{error}</div>}
          {status && <div className="alert success">{status}</div>}
        </section>

        <section className="card summary">
          <h2>Session status</h2>
          <p className="meta">You are not signed in yet.</p>
        </section>
      </main>
    </div>
  );
}
