// Encapsulates AcceptInvite route orchestration so the page only renders status and actions.
import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/shared/api/client';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '@/shared/api/get-display-error';
import { logError } from '@/utils/logger';
import { useRedeemInviteQuery } from '@/Authoring/SingleModule/queries/useModuleInvitesQueries';

const INVITE_REDEEM_PERMISSION_MESSAGE =
  'This invite link can only be used from an eligible student account. If you are a teacher, ask the module owner to share access another way.';

function getInviteRedeemErrorMessage(error: unknown): string | null {
  // Keep the graceful override narrowly scoped so other invite failures still use backend-owned copy.
  if (
    error instanceof ApiError &&
    error.status === 403 &&
    error.message === 'Insufficient permissions'
  ) {
    return INVITE_REDEEM_PERMISSION_MESSAGE;
  }

  return null;
}

// Main hook for AcceptInvite page state
// Handles all logic for redeeming an invite link, error handling, and redirecting after success.
export function useAcceptInvitePageState() {
  // --- Token and navigation setup ---
  // Extracts the invite token from the URL and prepares navigation helpers.
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const hasToken = useMemo(() => token.trim().length > 0, [token]);

  // --- Invite redemption request ---
  // Keep redemption query-backed so StrictMode remounts share one in-flight request instead of
  // issuing duplicate POSTs for the same token.
  const redeemInviteQuery = useRedeemInviteQuery(token, hasToken);
  const {
    isPending,
    isSuccess,
    isError,
    error,
    data,
  } = redeemInviteQuery;

  useEffect(() => {
    // Log API errors that should be tracked for debugging or monitoring.
    if (!isError || !shouldLogApiError(error)) return;
    logError(error, { feature: 'module-invites', action: 'redeem' });
  }, [error, isError]);

  useEffect(() => {
    // After a successful invite redemption, send the student to the modules list so the refreshed
    // enrollment is visible inside the normal shell entry point instead of keeping them on the invite screen.
    if (!isSuccess || !data) return;
    const redirectTimer = setTimeout(() => {
      navigate('/main/modules', { replace: true });
    }, 900);
    return () => clearTimeout(redirectTimer);
  }, [data, isSuccess, navigate]);

  // --- Error message logic ---
  // Determines the appropriate error message to show based on token presence and API errors.
  const inviteRedeemPermissionMessage = getInviteRedeemErrorMessage(error);
  const errorMessage = !hasToken
    ? 'This invite link is missing a token.'
    : isError
      ? inviteRedeemPermissionMessage ??
        getDisplayErrorMessage(error, {
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
