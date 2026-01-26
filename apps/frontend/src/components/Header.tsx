import logo from '../assets/logo.svg';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src={logo} alt="ScholarXP logo" className={styles.logo} />
        <span className={styles.wordmark}>ScholarXP</span>
      </div>

      <nav className={styles.nav} aria-label="Primary navigation">
        {/* Navigation links will be added here as pages are introduced. */}
      </nav>

      <div className={styles.actions}>
        <button className={`${styles.btn} ${styles.btnGhost}`} type="button">
          Login
        </button>
        <button className={`${styles.btn} ${styles.btnPrimary}`} type="button">
          Sign-up
        </button>
      </div>
    </header>
  );
}
