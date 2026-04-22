// Simple Terms of Service page sourcing content from the license agreement
import { RiFileTextLine } from 'react-icons/ri';
import styles from './Terms.module.css';

export default function Terms() {
  return (
    <div className={styles.scrollWrapper}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <RiFileTextLine className={styles.titleIcon} />
            <h1>Terms of Service</h1>
          </div>
          <p className={styles.subtitle}>Last updated: April 21, 2026</p>
        </header>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>About These Terms</h2>
            <p>
              ScholarXP is provided under the PolyForm Noncommercial License 1.0.0. By using this
              platform, you agree to these terms as strict obligations and conditions for your use.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Permitted Use</h2>
            <p>
              ScholarXP is permitted for <strong>noncommercial purposes</strong> only. This includes:
            </p>
            <ul>
              <li>Personal study, research, and hobby projects.</li>
              <li>Charitable organizations and educational institutions.</li>
              <li>Public research, safety, or health organizations.</li>
              <li>Private entertainment and amateur pursuits.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Noncommercial Restriction</h2>
            <p>
              Use for any purpose with an anticipated commercial application is not permitted under
              this license.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Copyright & Patents</h2>
            <p>
              The software is licensed, not sold. You are granted a license to use, change, and make
              new works based on the software for permitted purposes, provided you include the
              original license notices.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Notice of Violations</h2>
            <p>
              If you violate these terms, your license may be terminated. However, first-time
              violations may be corrected within 32 days of written notice to maintain your license.
            </p>
          </section>

          <section className={styles.section}>
            <h2>No Warranty</h2>
            <p>
              The software is provided as-is, with no other rights or warranties implied.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
