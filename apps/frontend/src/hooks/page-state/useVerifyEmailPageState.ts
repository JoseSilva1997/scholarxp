// This hook bundles all the logic required for the email verification
// screen. The route component uses its returned state and handlers so
// it can remain a plain UI layer.
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDisplayErrorMessage } from '../../api/get-display-error';
import { useAuth } from '../../context/AuthContext';
import {
  useResendVerificationMutation,
  useVerifyEmailMutation,
} from '../queries/useAuthMutations';

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

  // decrement the cooldown timer each second; the interval clears
  // itself when it reaches zero. This keeps the resend button disabled
  // for a short period after being pressed.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // called when the user submits the verification form. we clear any
  // previous messages, run the mutation, and navigate to the main app on
  // success. a missing user in the response is interpreted as a bad code.
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

  // triggered when the user asks to resend the code. protects against
  // double-click spam, requires an email value, and starts the cooldown
  // regardless of success so users can't hammer the API.
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
    setCooldown(30);
    try {
      const result = await resendVerificationMutation.mutateAsync(email.trim().toLowerCase());
      if ('alreadyVerified' in result && result.alreadyVerified) {
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
      setCooldown(0);
    }
  }

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

