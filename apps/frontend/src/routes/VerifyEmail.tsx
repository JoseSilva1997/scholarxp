import { Link } from 'react-router-dom';
import { AuthVisual } from '../components/AuthVisual';
import { useVerifyEmailPageState } from '../hooks/page-state/useVerifyEmailPageState';
import styles from './Login.module.css';

// Simple verification card that matches the login/register layout; shown after signup or blocked login.
export default function VerifyEmail() {
  const {
    email,
    setEmail,
    code,
    setCode,
    error,
    info,
    cooldown,
    isVerifying,
    isResending,
    handleVerify,
    handleResend,
  } = useVerifyEmailPageState();

  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <AuthVisual />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Verify your email</h1>
            <p className={styles.subtitle}>
              Enter the code we sent to {email ? <strong>{email}</strong> : 'your email address'} to finish
              signing in.
            </p>

            <form className={styles.form} onSubmit={handleVerify}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="code">Verification code</label>
                <input
                  className={styles.input}
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={8}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">Email</label>
                <input
                  className={styles.input}
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error ? <div className={styles.error}>{error}</div> : null}
              {info ? <div className={styles.helperCard}>{info}</div> : null}

              <div className={styles.actions}>
                <button
                  className={styles.primaryBtn}
                  type="submit"
                  disabled={isVerifying || code.trim().length < 4}
                >
                  {isVerifying ? 'Verifying…' : 'Verify and continue'}
                </button>
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isResending}
                >
                  {isResending
                    ? 'Resending…'
                    : cooldown > 0
                      ? `Resend in ${cooldown}s`
                      : 'Resend code'}
                </button>
              </div>
            </form>

            <div className={styles.helper}>
              <p className={styles.inlineHelper}>
                Already verified?{' '}
                <Link className={styles.helperLink} to="/login">
                  Log in
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
