// Invite acceptance screen: redeems an invite token and routes the student into the module.
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import { logError } from '../../utils/logger';
import MainSection from '../../components/MainSection';
import { useRedeemInviteMutation } from '../../hooks/useModuleInvitesQueries';
import styles from './AcceptInvite.module.css';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const hasToken = useMemo(() => token.trim().length > 0, [token]);
  const redeemInviteMutation = useRedeemInviteMutation();
  const {
    mutate: redeemInvite,
    isPending,
    isSuccess,
    isError,
    error,
    data,
  } = redeemInviteMutation;
  // Use a ref to prevent duplicate redemptions; refs update synchronously unlike state.
  const redemptionAttempted = useRef(false);

  useEffect(() => {
    // Guard against missing tokens without triggering cascading renders.
    if (!hasToken) return;

    // Prevent duplicate redemptions using ref to guard against React StrictMode double-invocation.
    if (redemptionAttempted.current) {
      return;
    }
    redemptionAttempted.current = true;
    redeemInvite(token);
  }, [hasToken, redeemInvite, token]);

  useEffect(() => {
    if (!isError || !shouldLogApiError(error)) return;
    logError(error, { feature: 'module-invites', action: 'redeem' });
  }, [error, isError]);

  useEffect(() => {
    if (!isSuccess || !data) return;
    const redirectTimer = setTimeout(() => {
      navigate(`/main/modules/${data.moduleId}`, { replace: true });
    }, 900);
    return () => clearTimeout(redirectTimer);
  }, [data, isSuccess, navigate]);

  const errorMessage = !hasToken
    ? 'This invite link is missing a token.'
    : isError
      ? getDisplayErrorMessage(error, {
          fallbackMessage:
            'We could not redeem this invite. Please ask your instructor for a new link.',
        })
      : null;

  return (
    <MainSection className={styles.container}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Module invite</p>
        <h1 className={styles.title}>Join this module</h1>
        {hasToken && isPending ? (
          <p className={styles.copy}>Redeeming your invite…</p>
        ) : isSuccess ? (
          <p className={styles.copy}>Success! Redirecting you to the module.</p>
        ) : errorMessage ? (
          <>
            <p className={styles.copy} role="alert">
              {errorMessage}
            </p>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => navigate('/main/modules')}
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
