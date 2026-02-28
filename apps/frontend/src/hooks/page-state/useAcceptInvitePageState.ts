// Encapsulates AcceptInvite route orchestration so the page only renders status and actions.
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import { logError } from '../../utils/logger';
import { useRedeemInviteMutation } from '../queries/useModuleInvitesQueries';

// Main hook for AcceptInvite page state
// Handles all logic for redeeming an invite link, error handling, and redirecting after success.
export function useAcceptInvitePageState() {
  // --- Token and navigation setup ---
  // Extracts the invite token from the URL and prepares navigation helpers.
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const hasToken = useMemo(() => token.trim().length > 0, [token]);

  // --- Invite redemption mutation ---
  // Prepares the mutation hook for redeeming the invite using the token.
  const redeemInviteMutation = useRedeemInviteMutation();
  const {
    mutate: redeemInvite,
    isPending,
    isSuccess,
    isError,
    error,
    data,
  } = redeemInviteMutation;

  // --- Redemption guard ---
  // Uses a ref to ensure the invite is only redeemed once, even if React renders twice (e.g. StrictMode).
  const redemptionAttempted = useRef(false);

  useEffect(() => {
    // Attempt to redeem the invite as soon as a valid token is present.
    // Prevents duplicate submissions by checking the ref.
    if (!hasToken) return;
    if (redemptionAttempted.current) return;
    redemptionAttempted.current = true;
    redeemInvite(token);
  }, [hasToken, redeemInvite, token]);

  useEffect(() => {
    // Log API errors that should be tracked for debugging or monitoring.
    if (!isError || !shouldLogApiError(error)) return;
    logError(error, { feature: 'module-invites', action: 'redeem' });
  }, [error, isError]);

  useEffect(() => {
    // After a successful invite redemption, redirect the user to the module page after a short delay.
    // This gives time for a success message or animation if needed.
    if (!isSuccess || !data) return;
    const redirectTimer = setTimeout(() => {
      navigate(`/main/modules/${data.moduleId}`, { replace: true });
    }, 900);
    return () => clearTimeout(redirectTimer);
  }, [data, isSuccess, navigate]);

  // --- Error message logic ---
  // Determines the appropriate error message to show based on token presence and API errors.
  const errorMessage = !hasToken
    ? 'This invite link is missing a token.'
    : isError
      ? getDisplayErrorMessage(error, {
          fallbackMessage:
            'We could not redeem this invite. Please ask your instructor for a new link.',
        })
      : null;

  // --- Public API ---
  // Exposes state and navigation actions for the AcceptInvite page to use in its UI.
  return {
    hasToken,
    isPending,
    isSuccess,
    errorMessage,
    goToModules: () => navigate('/main/modules'),
  };
}

