import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import './App.css';
import { login, logout, me, register } from './api/auth';
import type { AuthUser } from './types/auth';

type Mode = 'login' | 'register';

type AuthFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

const emptyForm: AuthFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
};

function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState<AuthFormState>(emptyForm);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === 'login' ? 'Sign in to ScholarXP' : 'Create your ScholarXP account'),
    [mode],
  );

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    me()
      .then((response) => {
        if (isActive) {
          setUser(response.user);
        }
      })
      .catch(() => {
        // ignore initial auth errors
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const updateField = (key: keyof AuthFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const resetMessages = () => {
    setError(null);
    setStatus(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      if (mode === 'login') {
        const response = await login({
          email: form.email,
          password: form.password,
        });
        setUser(response.user);
        setStatus('Signed in successfully.');
      } else {
        const response = await register({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
        });
        setUser(response.user);
        setStatus('Account created. Welcome to ScholarXP!');
      }
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    resetMessages();
    setLoading(true);
    try {
      await logout();
      setUser(null);
      setStatus('Signed out.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign out');
    } finally {
      setLoading(false);
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
          <form onSubmit={handleSubmit} className="form">
            {mode === 'register' && (
              <div className="row">
                <label>
                  First name
                  <input
                    value={form.firstName}
                    onChange={updateField('firstName')}
                    placeholder="Jamie"
                    autoComplete="given-name"
                  />
                </label>
                <label>
                  Last name
                  <input
                    value={form.lastName}
                    onChange={updateField('lastName')}
                    placeholder="Nguyen"
                    autoComplete="family-name"
                  />
                </label>
              </div>
            )}

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={updateField('email')}
                placeholder="you@campus.edu"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={updateField('password')}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {error && <div className="alert error">{error}</div>}
          {status && <div className="alert success">{status}</div>}
        </section>

        <section className="card summary">
          <h2>Session status</h2>
          {loading && <p>Checking your session…</p>}
          {!loading && user && (
            <div className="user">
              <p className="name">{user.firstName + ' ' + user.lastName}</p>
              <p className="meta">{user.email ?? 'No email on file'}</p>
              <p className="meta">Role: {user.globalRole}</p>
              <button type="button" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          )}
          {!loading && !user && <p className="meta">You are not signed in yet.</p>}
        </section>
      </main>
    </div>
  );
}

export default App;
