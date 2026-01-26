import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <span className={styles.brand}>ScholarXP™</span>
      <div className={styles.meta}>
        <span>Helping students stay consistent.</span>
        <a className={styles.link} href="#" aria-label="Read the privacy policy">
          Privacy
        </a>
        <a className={styles.link} href="#" aria-label="View terms of service">
          Terms
        </a>
      </div>
    </footer>
  );
}
