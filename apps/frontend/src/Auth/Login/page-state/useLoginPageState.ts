// Custom hook for Login page state, separating authentication flow control from form rendering.
// This follows the container/presentational pattern used across Auth route components.
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Location } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ensureCsrfToken, clearCsrfToken } from '@/shared/api/client';
import { getDisplayErrorMessage } from '@/shared/api/get-display-error';
import { useAuth } from '@/context/AuthContext';
import { logError } from '@/utils/logger';
import { useLoginMutation } from '@/Auth/queries/useAuthMutations';

// Coordinates login form state, CSRF preparation, session context updates, and redirect behavior.
export function useLoginPageState() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const loginMutation = useLoginMutation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  // Surface a positive notice when arriving here after a successful flow elsewhere (e.g., password reset).
  const initialMessage =
    (location.state as { message?: string } | null)?.message ?? null;
  const [info, setInfo] = useState<string | null>(initialMessage);
  // Preserve the protected route that sent the user here so successful login returns them to that intent.
  const redirectFrom = (location.state as { from?: Location } | null)?.from;

  useEffect(() => {
    // Save the intended destination in sessionStorage so OAuth or reloads can restore it after login.
    if (redirectFrom) {
      const target = `${redirectFrom.pathname}${redirectFrom.search}${redirectFrom.hash}`;
      sessionStorage.setItem('postAuthRedirect', target);
    } else {
      sessionStorage.removeItem('postAuthRedirect');
    }
  }, [redirectFrom]);

  useEffect(() => {
    // Preload a fresh CSRF token after logout so the first login attempt isn't rejected by the backend.
    ensureCsrfToken().catch((loadError) =>
      logError(loadError, { source: 'Login.ensureCsrfToken' }),
    );
  }, []);

  // Updates controlled input state using the field name so the form schema stays centralized.
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Submits credentials, handles verification-only accounts, and completes the authenticated redirect.
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    try {
      // Always refresh CSRF token before submitting to avoid backend rejections.
      clearCsrfToken();
      await ensureCsrfToken();

      const { user } = await loginMutation.mutateAsync({
        email: form.email.trim(),
        password: form.password,
      });

      if (!user) {
        setError('Login failed. Please try again.');
        return;
      }

      // Backend can return a partial user for unverified accounts; route them through verification before setting app auth state.
      if (user.requiresEmailVerification || !user.isVerified) {
        navigate('/verify-email', {
          replace: true,
          state: { email: form.email.trim().toLowerCase() },
        });
        return;
      }

      // Store the authenticated user only after verification checks pass, then return to the intended protected route.
      setUser(user);
      const destination = redirectFrom
        ? `${redirectFrom.pathname}${redirectFrom.search}${redirectFrom.hash}`
        : '/main';
      sessionStorage.removeItem('postAuthRedirect');
      navigate(destination, { replace: true });
    } catch (submitError) {
      // Treat "not verified" errors as a recoverable next step rather than a terminal login failure.
      const message = getDisplayErrorMessage(submitError, {
        fallbackMessage: 'Something went wrong. Please try again.',
      });
      const normalizedEmail = form.email.trim().toLowerCase();
      setError(message);
      const wantsVerify =
        message.toLowerCase().includes('verify') ||
        message.toLowerCase().includes('not verified');
      if (wantsVerify) {
        // Redirect to verify page without the error message—this is the normal flow, not an error.
        navigate('/verify-email', {
          replace: false,
          state: { email: normalizedEmail },
        });
      }
    }
  }

  // Return a narrow view-model API so the route component remains presentation-focused.
  return {
    form,
    error,
    info,
    isSubmitting: loginMutation.isPending,
    handleChange,
    handleSubmit,
  };
}
