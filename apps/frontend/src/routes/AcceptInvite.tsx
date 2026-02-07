// Invite acceptance screen: redeems an invite token and routes the student into the module.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { redeemInvite } from '../api/moduleInvites';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../api/get-display-error';
import { logError } from '../utils/logger';
import MainSection from '../components/MainSection';
import styles from './AcceptInvite.module.css';

type StatusState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success'; moduleId: number }
  | { state: 'error'; message: string };

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const hasToken = useMemo(() => token.trim().length > 0, [token]);
  const [status, setStatus] = useState<StatusState>(() =>
    hasToken ? { state: 'idle' } : { state: 'error', message: 'This invite link is missing a token.' },
  );
  // Use a ref to prevent duplicate redemptions; refs update synchronously unlike state.
  const redemptionAttempted = useRef(false);

  useEffect(() => {
    // Guard against missing tokens without triggering cascading renders.
    if (!hasToken) return;
    
    // Prevent duplicate redemptions using ref to guard against React StrictMode double-invocation.
    // State updates are async, so both effect invocations could see state === 'idle' and both fire.
    if (redemptionAttempted.current) {
      return;
    }
    redemptionAttempted.current = true;
    
    const redeem = async () => {
      setStatus({ state: 'loading' });
      try {
        const result = await redeemInvite(token);
        // Process success even if component unmounted - the ref prevents duplicate attempts.
        setStatus({ state: 'success', moduleId: result.moduleId });
        // After a short delay, take the learner into the module.
        setTimeout(() => navigate(`/main/modules/${result.moduleId}`, { replace: true }), 900);
      } catch (err) {
        const message = getDisplayErrorMessage(err, {
          fallbackMessage:
            'We could not redeem this invite. Please ask your instructor for a new link.',
        });
        setStatus({ state: 'error', message });
        if (shouldLogApiError(err)) {
          logError(err, { feature: 'module-invites', action: 'redeem' });
        }
      }
    };
    void redeem();
    return () => {
      // Do NOT reset ref - we want it to persist across StrictMode unmount/remount to prevent duplicate requests.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, token]);

  return (
    <MainSection className={styles.container}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Module invite</p>
        <h1 className={styles.title}>Join this module</h1>
        {status.state === 'loading' ? (
          <p className={styles.copy}>Redeeming your invite…</p>
        ) : status.state === 'success' ? (
          <p className={styles.copy}>Success! Redirecting you to the module.</p>
        ) : status.state === 'error' ? (
          <>
            <p className={styles.copy} role="alert">
              {status.message}
            </p>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => navigate('/main/modules')}
            >
              Go to modules
            </button>
          </>
        ) : null}
      </div>
    </MainSection>
  );
}
