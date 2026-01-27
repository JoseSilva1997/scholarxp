import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, login } from '../api/auth';
import { updateUserRole } from '../api/users';
import { useAuth } from '../context/AuthContext';
import type { AuthUser, GlobalRole } from '../types/auth';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPendingUser(null);
    setIsSubmitting(true);

    try {
      const { user } = await login({
        email: form.email.trim(),
        password: form.password,
      });

      if (!user) {
        setError('Login failed. Please try again.');
        return;
      }

      if (!user.isVerified) {
        setError('Please verify your account before signing in. Check your email for the verification link.');
        return;
      }

      if (user.globalRole === 'pending') {
        setPendingUser(user);
        return;
      }

      setUser(user);
      navigate('/main', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Unable to log you in right now.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSelectRole(role: Exclude<GlobalRole, 'pending'>) {
    if (!pendingUser) return;
    setError(null);
    setIsUpdatingRole(true);
    try {
      const updatedUser = await updateUserRole(pendingUser.id, role);
      setUser(updatedUser);
      navigate('/main', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Unable to update your role right now.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsUpdatingRole(false);
    }
  }

  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <section className={styles.visual} aria-hidden="true" />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>Log in to continue your daily practice journey.</p>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">
                  Email
                </label>
                <input
                  className={styles.input}
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.edu"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">
                  Password
                </label>
                <input
                  className={styles.input}
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>

              {error ? <div className={styles.error}>{error}</div> : null}

              <div className={styles.actions}>
                <button className={styles.primaryBtn} type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Logging in…' : 'Log in'}
                </button>
                <span className={styles.inlineHelper}>
                  <span>New here? </span>
                  <Link className={styles.helperLink} to="/register">
                    Create an account
                  </Link>
                </span>
              </div>
            </form>
          </section>

          {pendingUser ? (
            <section className={styles.roleCard} aria-live="polite">
              <h2 className={styles.roleTitle}>Choose your role to continue</h2>
              <p className={styles.roleSubtitle}>
                Tell us how you use ScholarXP so we can tailor your experience.
              </p>
              <div className={styles.roleButtons}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={isUpdatingRole}
                  onClick={() => handleSelectRole('student')}
                >
                  I’m a student
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={isUpdatingRole}
                  onClick={() => handleSelectRole('instructor')}
                >
                  I’m a teacher
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
