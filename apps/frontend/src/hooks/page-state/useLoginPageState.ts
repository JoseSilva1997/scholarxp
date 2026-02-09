// Encapsulates Login route orchestration so the page component can focus on rendering the form UI.
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Location } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ensureCsrfToken, clearCsrfToken } from '../../api/client';
import { getDisplayErrorMessage } from '../../api/get-display-error';
import { useAuth } from '../../context/AuthContext';
import { logError } from '../../utils/logger';
import { useLoginMutation } from '../queries/useAuthMutations';

export function useLoginPageState() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const loginMutation = useLoginMutation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  // Capture where the user was headed (e.g., an invite link) so we can return them there after login.
  const redirectFrom = (location.state as { from?: Location } | null)?.from;

  useEffect(() => {
    // Persist the post-auth destination so OAuth redirects (full page navigations) can restore it.
    if (redirectFrom) {
      const target = `${redirectFrom.pathname}${redirectFrom.search}${redirectFrom.hash}`;
      sessionStorage.setItem('postAuthRedirect', target);
    } else {
      sessionStorage.removeItem('postAuthRedirect');
    }
  }, [redirectFrom]);

  useEffect(() => {
    // Preload a fresh CSRF token after logout so the first login attempt isn't rejected.
    ensureCsrfToken().catch((loadError) =>
      logError(loadError, { source: 'Login.ensureCsrfToken' }),
    );
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      // Refresh CSRF token immediately before submitting to avoid stale tokens after logout.
      clearCsrfToken(); // Drop any stale token explicitly, then fetch a new one.
      await ensureCsrfToken();

      const { user } = await loginMutation.mutateAsync({
        email: form.email.trim(),
        password: form.password,
      });

      if (!user) {
        setError('Login failed. Please try again.');
        return;
      }

      if (user.requiresEmailVerification || !user.isVerified) {
        navigate('/verify-email', {
          replace: true,
          state: { email: form.email.trim().toLowerCase() },
        });
        return;
      }

      setUser(user);
      const destination = redirectFrom
        ? `${redirectFrom.pathname}${redirectFrom.search}${redirectFrom.hash}`
        : '/main';
      sessionStorage.removeItem('postAuthRedirect');
      navigate(destination, { replace: true });
    } catch (submitError) {
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

  return {
    form,
    error,
    isSubmitting: loginMutation.isPending,
    handleChange,
    handleSubmit,
  };
}

