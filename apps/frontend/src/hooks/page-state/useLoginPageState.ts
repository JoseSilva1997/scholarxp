// Handles all logic for the Login page so the component can focus on rendering the form UI.
// Manages form state, authentication, CSRF, error handling, and post-login redirects.
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Location } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ensureCsrfToken, clearCsrfToken } from '../../api/client';
import { getDisplayErrorMessage } from '../../api/get-display-error';
import { useAuth } from '../../context/AuthContext';
import { logError } from '../../utils/logger';
import { useLoginMutation } from '../queries/useAuthMutations';

// Main hook for Login page state
export function useLoginPageState() {
  // --- Setup navigation, auth context, and form state ---
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const loginMutation = useLoginMutation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  // Store where the user was headed before login, so we can redirect them after authentication.
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

  // --- Form input handler ---
  // Updates form state as the user types.
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // --- Form submit handler ---
  // Handles login form submission, including CSRF refresh, authentication, error handling, and redirects.
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

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

      // If user needs email verification, redirect them to the verification page.
      if (user.requiresEmailVerification || !user.isVerified) {
        navigate('/verify-email', {
          replace: true,
          state: { email: form.email.trim().toLowerCase() },
        });
        return;
      }

      // Set user in context and redirect to intended destination or main page.
      setUser(user);
      const destination = redirectFrom
        ? `${redirectFrom.pathname}${redirectFrom.search}${redirectFrom.hash}`
        : '/main';
      sessionStorage.removeItem('postAuthRedirect');
      navigate(destination, { replace: true });
    } catch (submitError) {
      // Show a user-friendly error and redirect to verify page if needed.
      const message = getDisplayErrorMessage(submitError, {
        fallbackMessage: 'Something went wrong. Please try again.',
      });
      const normalizedEmail = form.email.trim().toLowerCase();
      setError(message);
      const wantsVerify =
        message.toLowerCase().includes('verify') ||
        message.toLowerCase().includes('not verified');
      if (wantsVerify) {
        navigate('/verify-email', {
          replace: false,
          state: { email: normalizedEmail, message },
        });
      }
    }
  }

  // --- Public API ---
  // Exposes form state, error, loading, and handlers for the Login page UI.
  return {
    form,
    error,
    isSubmitting: loginMutation.isPending,
    handleChange,
    handleSubmit,
  };
}

