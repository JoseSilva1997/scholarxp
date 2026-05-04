// Invite acceptance screen: redeems an invite token and routes the student back into the modules shell.
import MainSection from '@/MainApp/MainSection/MainSection';
import { useAcceptInvitePageState } from '@/Authoring/AcceptInvite/page-state/useAcceptInvitePageState';
import styles from '@/Authoring/AcceptInvite/AcceptInvite.module.css';

// Displays invite-redemption progress and recovery actions for the token route.
export default function AcceptInvite() {
  const { hasToken, isPending, isSuccess, errorMessage, goToModules } =
    useAcceptInvitePageState();

  return (
    <MainSection className={styles.container}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Module invite</p>
        <h1 className={styles.title}>Join this module</h1>
        {hasToken && isPending ? (
          <p className={styles.copy}>Redeeming your invite…</p>
        ) : isSuccess ? (
          <p className={styles.copy}>Success! Redirecting you to your modules.</p>
        ) : errorMessage ? (
          <>
            <p className={styles.copy} role="alert">
              {errorMessage}
            </p>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={goToModules}
            >
              Go to modules
            </button>
          </>
        ) : (
          <p className={styles.copy}>Preparing invite redemption…</p>
        )}
      </div>
    </MainSection>
  );
}
