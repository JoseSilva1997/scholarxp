// Defines the public Privacy Policy page explaining how ScholarXP uses account and study data.
import { RiShieldCheckLine } from 'react-icons/ri';
import styles from '@/Public/Terms/Terms.module.css';

// Renders static privacy content using the same legal-page presentation as the Terms route.
export default function Privacy() {
  return (
    <div className={styles.scrollWrapper}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <RiShieldCheckLine className={styles.titleIcon} />
            <h1>Privacy Policy</h1>
          </div>
          <p className={styles.subtitle}>Last updated: April 04, 2026</p>
        </header>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2>About This Policy</h2>
            <p>
              ScholarXP uses account and study activity data to provide practice, revision, XP,
              quests, and module progress features. We keep this policy simple so you can understand
              what the platform needs and why.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Information We Collect</h2>
            <p>We collect the information needed to create your account and run the study app:</p>
            <ul>
              <li>Name, email address, account role, and verification status.</li>
              <li>Modules, questions, practice attempts, answers, scores, and progress.</li>
              <li>XP, quest activity, rewards, and profile preferences.</li>
              <li>Basic technical details needed for authentication, security, and diagnostics.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>How We Use Information</h2>
            <p>
              We use your information to personalize study sessions, track progress, recommend
              revision, manage access to modules, secure accounts, and improve reliability.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Sharing</h2>
            <p>
              We do not sell personal information. We may share limited information with teachers,
              module owners, or administrators when it is needed to support learning, moderation,
              or account access.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Retention</h2>
            <p>
              We keep account and learning records while your account is active or while they are
              needed for legitimate educational, security, or legal reasons.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Your Choices</h2>
            <p>
              You can request access, correction, or deletion of your personal information. Some
              records may need to be retained where required for security, audit, or legal reasons.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Security</h2>
            <p>
              We use reasonable technical and organizational safeguards to protect account and
              study data, but no online service can guarantee absolute security.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
