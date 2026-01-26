import { Link } from 'react-router-dom';
import styles from './Register.module.css';

export default function Register() {
  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <section className={styles.visual} aria-hidden="true" />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>Set up your login so you can pick up practice anywhere.</p>

            <form className={styles.form}>
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
                  />
                </div>
              </div>

              <div className={styles.actions}>
                <button className={styles.primaryBtn} type="submit">
                  Create account
                </button>
                <span className={styles.inlineHelper}>
                  <span>Already have an account? </span>
                  <Link className={styles.helperLink} to="/login">
                    Log in
                  </Link>
                </span>
              </div>
            </form>
          </section>

          <aside className={styles.helper}>
            <div className={styles.helperCard}>
              Have an invite code? You can enter it after creating your account.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
