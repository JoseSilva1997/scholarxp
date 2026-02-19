import { Link } from 'react-router-dom';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { AuthVisual } from '../components/AuthVisual';
import styles from './Register.module.css';
import { useRegisterPageState } from '../hooks/page-state/useRegisterPageState';

export default function Register() {
  const {
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
    handleChange,
    handleSubmit,
  } = useRegisterPageState();

  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <AuthVisual />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>Set up your login so you can pick up practice anywhere.</p>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="firstName">
                    First name
                  </label>
                  <input
                    className={styles.input}
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Alex"
                    autoComplete="given-name"
                    maxLength={40}
                    value={form.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="lastName">
                    Last name
                  </label>
                  <input
                    className={styles.input}
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Rivera"
                    autoComplete="family-name"
                    maxLength={40}
                    value={form.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

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

              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="password">
                    Password
                  </label>
                  <input
                    className={styles.input}
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Create a password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    onFocus={() => setShowMeter(true)}
                    onBlur={() => setShowMeter(false)}
                    minLength={10}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <input
                    className={styles.input}
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setShowMeter(true)}
                    onBlur={() => setShowMeter(false)}
                    minLength={10}
                    required
                  />
                </div>
              </div>

              {errors.length > 0 ? (
                <div className={styles.error} role="alert">
                  <p className={styles.errorTitle}>Please fix the following:</p>
                  <ul className={styles.errorList}>
                    {errors.map((msg) => (
                      <li key={msg}>{msg}</li>
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
                <button className={styles.primaryBtn} type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating account…' : 'Create account'}
                </button>
                <span className={styles.inlineHelper}>
                  <span>Already have an account? </span>
                  <Link className={styles.helperLink} to="/login">
                    Log in
                  </Link>
                </span>
              </div>
            </form>

            <div className={styles.socialWrapper}>
              <SocialAuthButtons context="register" />
            </div>
          </section>

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
                  <li key={item.label} className={item.pass ? styles.reqPass : styles.reqFail}>
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <aside className={styles.helper}>
          </aside>
        </div>
      </div>
    </div>
  );
}
