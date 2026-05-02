// Custom hook for the email verification screen, separating token submission and resend flow from rendering.
// This follows the Auth module's route view-model pattern.
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDisplayErrorMessage } from '@/shared/api/get-display-error';
import { useAuth } from '@/context/AuthContext';
import {
  useResendVerificationMutation,
  useVerifyEmailMutation,
} from '@/Auth/queries/useAuthMutations';

// Coordinates verification form state, resend cooldowns, authenticated user assignment, and navigation.
export function useVerifyEmailPageState() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const verifyEmailMutation = useVerifyEmailMutation();
  const resendVerificationMutation = useResendVerificationMutation();

  const initialEmail = (location.state as { email?: string } | null)?.email ?? '';
  const initialMessage = (location.state as { message?: string } | null)?.message ?? null;

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(initialMessage);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // The cooldown is client-side throttling for UX; backend rate limits remain the source of enforcement.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Submits the verification token and promotes the returned user into app-wide auth state on success.
  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    try {
      const { user } = await verifyEmailMutation.mutateAsync(code.trim());
      if (user) {
        setUser(user);
        navigate('/main', { replace: true });
        return;
      }
      setError('Invalid or expired code.');
    } catch (verifyError) {
      setError(
        getDisplayErrorMessage(verifyError, {
          fallbackMessage: 'Unable to verify right now.',
        }),
      );
    }
  }

  // Requests a replacement verification code while preventing duplicate in-flight resend requests.
  async function handleResend() {
    if (resendVerificationMutation.isPending) {
      return;
    }
    if (!email) {
      setError('Enter your email to resend a code.');
      return;
    }
    setError(null);
    setInfo(null);
    // Start cooldown before the request completes to discourage repeated submits during latency.
    setCooldown(30);
    try {
      const result = await resendVerificationMutation.mutateAsync(email.trim().toLowerCase());
      if ('alreadyVerified' in result && result.alreadyVerified) {
        // The backend may discover the user is already verified; direct them back to normal login.
        setInfo('Already verified—try logging in.');
        return;
      }
      setInfo('New code sent. Check your inbox.');
    } catch (resendError) {
      setError(
        getDisplayErrorMessage(resendError, {
          fallbackMessage: 'Unable to resend right now.',
        }),
      );
      // Retry should be immediately available after a failed resend because no new email was sent.
      setCooldown(0);
    }
  }

  // Return the verification page view model and mutation-derived loading states.
  return {
    email,
    setEmail,
    code,
    setCode,
    error,
    info,
    cooldown,
    isVerifying: verifyEmailMutation.isPending,
    isResending: resendVerificationMutation.isPending,
    handleVerify,
    handleResend,
  };
}
