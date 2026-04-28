import { Link } from 'react-router-dom';
import { SocialAuthButtons } from '@/Auth/SocialAuthButtons';
import { AuthVisual } from '@/Auth/AuthVisual';
import { useLoginPageState } from '@/Auth/Login/page-state/useLoginPageState';
import styles from '@/Auth/Login/Login.module.css';

export default function Login() {
  const { form, error, info, isSubmitting, handleChange, handleSubmit } =
    useLoginPageState();

  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <AuthVisual />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Log in</h1>
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
              {info ? <div className={styles.helperCard}>{info}</div> : null}

              <div className={styles.actions}>
                <button className={styles.primaryBtn} type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Logging in…' : 'Log in'}
                </button>
                <span className={styles.inlineHelper}>
                  <Link className={styles.helperLink} to="/forgot-password">
                    Forgot password?
                  </Link>
                </span>
                <span className={styles.inlineHelper}>
                  <span>New here? </span>
                  <Link className={styles.helperLink} to="/register">
                    Create an account
                  </Link>
                </span>
              </div>
            </form>

            <div className={styles.socialWrapper}>
              <SocialAuthButtons context="login" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
