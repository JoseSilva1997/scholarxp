// Forgot-password entry screen: collects the account email and emails a reset link.
import { Link } from 'react-router-dom';
import { AuthVisual } from '@/Auth/AuthVisual';
import { useForgotPasswordPageState } from '@/Auth/ForgotPassword/page-state/useForgotPasswordPageState';
import styles from '@/Auth/Login/Login.module.css';

// Renders the reset-link request form while page state owns validation and submission behavior.
export default function ForgotPassword() {
  const { email, error, status, isSubmitting, handleChange, handleSubmit } =
    useForgotPasswordPageState();

  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <AuthVisual />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Forgot password</h1>
            <p className={styles.subtitle}>
              Enter your email and we'll send you a link to reset your password.
            </p>

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
                  value={email}
                  onChange={handleChange}
                  required
                />
              </div>

              {error ? <div className={styles.error}>{error}</div> : null}

              {status === 'sent' ? (
                <div className={styles.helperCard}>
                  If an account with this email exists, we've sent a reset link.
                  Check your inbox — the link expires in 30 minutes.
                </div>
              ) : null}

              {status === 'no_password' ? (
                <div className={styles.helperCard}>
                  This account signs in with Google, so there's no password to reset.
                  Use <strong>Continue with Google</strong> on the log-in page instead.
                </div>
              ) : null}

              <div className={styles.actions}>
                <button
                  className={styles.primaryBtn}
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </button>
                <span className={styles.inlineHelper}>
                  <Link className={styles.helperLink} to="/login">
                    Back to log in
                  </Link>
                </span>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
