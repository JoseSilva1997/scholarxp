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
                <Link className={styles.linkBtn} to="/register">
                  Create an account
                </Link>
              </div>
            </form>
          </section>

          <aside className={styles.helper}>
            <div className={styles.helperCard}>
              <strong>Why log in?</strong>
              <ul className={styles.list}>
                <li>Resume your latest practice session instantly.</li>
                <li>Track XP earned across quests.</li>
                <li>Keep progress synced with your LMS launch.</li>
              </ul>
            </div>
            <div className={styles.helperCard}>
              New here? <Link to="/register">Create your account</Link> to start earning XP.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
