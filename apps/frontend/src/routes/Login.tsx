import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { Location } from 'react-router-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ensureCsrfToken, clearCsrfToken } from '../api/client';
import { getDisplayErrorMessage } from '../api/get-display-error';
import { useAuth } from '../context/AuthContext';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { logError } from '../utils/logger';
import { useLoginMutation } from '../hooks/useAuthMutations';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const loginMutation = useLoginMutation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  // Capture where the user was headed (e.g., an invite link) so we can return them there after login.
  const redirectFrom = (location.state as { from?: Location } | null)?.from;

  useEffect(() => {
    // Persist the post-auth destination so OAuth redirects (full page navigations) can restore it.
    if (redirectFrom) {
      const target = `${redirectFrom.pathname}${redirectFrom.search}${redirectFrom.hash}`;
      sessionStorage.setItem('postAuthRedirect', target);
    } else {
      sessionStorage.removeItem('postAuthRedirect');
    }
  }, [redirectFrom]);

  useEffect(() => {
    // Preload a fresh CSRF token after logout so the first login attempt isn't rejected.
    ensureCsrfToken().catch((error) => logError(error, { source: 'Login.ensureCsrfToken' }));
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      // Refresh CSRF token immediately before submitting to avoid stale tokens after logout.
      clearCsrfToken(); // Drop any stale token explicitly, then fetch a new one.
      await ensureCsrfToken();

      const { user } = await loginMutation.mutateAsync({
        email: form.email.trim(),
        password: form.password,
      });

      if (!user) {
        setError('Login failed. Please try again.');
        return;
      }

      if (user.requiresEmailVerification || !user.isVerified) {
        navigate('/verify-email', {
          replace: true,
          state: { email: form.email.trim().toLowerCase() },
        });
        return;
      }

      setUser(user);
      const destination = redirectFrom
        ? `${redirectFrom.pathname}${redirectFrom.search}${redirectFrom.hash}`
        : '/main';
      sessionStorage.removeItem('postAuthRedirect');
      navigate(destination, { replace: true });
    } catch (err) {
      const message = getDisplayErrorMessage(err, {
        fallbackMessage: 'Something went wrong. Please try again.',
      });
      const normalizedEmail = form.email.trim().toLowerCase();
      setError(message);
      const wantsVerify =
        message.toLowerCase().includes('verify') ||
        message.toLowerCase().includes('not verified');
      if (wantsVerify) {
        navigate('/verify-email', {
          replace: false,
          state: { email: normalizedEmail, message },
        });
      }
    }
  }

  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <section className={styles.visual} aria-hidden="true" />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Login</h1>
            <p className={styles.subtitle}>Continue your daily practice journey.</p>

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
                <button className={styles.primaryBtn} type="submit" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? 'Logging in…' : 'Log in'}
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

          <SocialAuthButtons context="login" />
        </div>
      </div>
    </div>
  );
}
