import { Link } from 'react-router-dom';
import styles from './Login.module.css';

export default function Login() {
  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <section className={styles.visual} aria-hidden="true" />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>Log in to continue your daily practice journey.</p>

            <form className={styles.form}>
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
                />
              </div>

              <div className={styles.actions}>
                <button className={styles.primaryBtn} type="submit">
                  Log in
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
        </div>
      </div>
    </div>
  );
}
