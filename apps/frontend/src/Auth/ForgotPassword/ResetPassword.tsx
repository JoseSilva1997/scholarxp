// Reset-password screen: takes the token from the email link plus a new password and finalizes the reset.
import { Link } from 'react-router-dom';
import { AuthVisual } from '@/Auth/AuthVisual';
import { useResetPasswordPageState } from '@/Auth/ForgotPassword/page-state/useResetPasswordPageState';
// Reuse Register's stylesheet so the form gets full-height column flow + meter styles instead of
// the centered Login layout, which pushes a tall form too close to the header.
import styles from '@/Auth/Register/Register.module.css';

export default function ResetPassword() {
  const {
    hasToken,
    form,
    error,
    errors,
    showMeter,
    setShowMeter,
    passwordChecks,
    passedCount,
    strengthPercent,
    strengthLabel,
    isSubmitting,
    handlePasswordChange,
    handleSubmit,
  } = useResetPasswordPageState();

  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <AuthVisual />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Reset password</h1>
            <p className={styles.subtitle}>
              Choose a new password to finish the reset. Your link expires in 30 minutes.
            </p>

            {!hasToken ? (
              <div className={styles.error} role="alert">
                Reset link is missing or invalid. Request a new link from the{' '}
                <Link className={styles.helperLink} to="/forgot-password">
                  forgot-password page
                </Link>
                .
              </div>
            ) : null}

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">
                  New password
                </label>
                <input
                  className={styles.input}
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Create a new password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handlePasswordChange}
                  onFocus={() => setShowMeter(true)}
                  onBlur={() => setShowMeter(false)}
                  minLength={10}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirmPassword">
                  Confirm new password
                </label>
                <input
                  className={styles.input}
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handlePasswordChange}
                  onFocus={() => setShowMeter(true)}
                  onBlur={() => setShowMeter(false)}
                  minLength={10}
                  required
                />
              </div>

              {showMeter ? (
                <section className={styles.meterPanel} aria-live="polite">
                  <div className={styles.meterPanelHeader}>
                    <span>Password strength</span>
                    <strong>{strengthLabel}</strong>
                  </div>
                  <div
                    className={styles.meter}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(strengthPercent)}
                  >
                    <div
                      className={`${styles.meterFill} ${
                        passedCount >= 4
                          ? styles.meterStrong
                          : passedCount >= 3
                            ? styles.meterOkay
                            : styles.meterWeak
                      }`}
                      style={{ width: `${strengthPercent}%` }}
                    />
                  </div>
                  <ul className={styles.requirements}>
                    {passwordChecks.map((item) => (
                      <li
                        key={item.label}
                        className={item.pass ? styles.reqPass : styles.reqFail}
                      >
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {errors.length > 0 ? (
                <div className={styles.error} role="alert">
                  <p className={styles.errorTitle}>Please fix the following:</p>
                  <ul className={styles.errorList}>
                    {errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {error ? (
                <div className={styles.error} role="alert">
                  {error}
                </div>
              ) : null}

              <div className={styles.actions}>
                <button
                  className={styles.primaryBtn}
                  type="submit"
                  disabled={isSubmitting || !hasToken}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {isSubmitting ? 'Resetting…' : 'Reset password'}
                </button>
                <span className={styles.inlineHelper}>
                  <span>Remembered your password? </span>
                  <Link className={styles.helperLink} to="/login">
                    Log in
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
