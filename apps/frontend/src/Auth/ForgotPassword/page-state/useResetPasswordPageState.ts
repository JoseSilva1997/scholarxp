// Owns logic for the ResetPassword screen: pulls the opaque token from the URL,
// validates the new password, submits, then routes to /login on success so the
// user signs in with the new credentials.
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@/Auth/api/auth';
import { getDisplayErrorMessage } from '@/shared/api/get-display-error';
import { useResetPasswordMutation } from '@/Auth/queries/useAuthMutations';

// Coordinates reset-token extraction, password policy feedback, submission, and success navigation.
export function useResetPasswordPageState() {
  const navigate = useNavigate();
  const location = useLocation();
  const resetPasswordMutation = useResetPasswordMutation();

  // Token arrives as ?token=... on the link emailed to the user.
  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token')?.trim() ?? '';
  }, [location.search]);

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showMeter, setShowMeter] = useState(false);

  // Same rules as registration so users only have to learn one password policy.
  const passwordChecks = useMemo(
    () => [
      { label: 'At least 10 characters', pass: form.password.length >= 10 },
      { label: 'Uppercase letter', pass: /[A-Z]/.test(form.password) },
      { label: 'Lowercase letter', pass: /[a-z]/.test(form.password) },
      { label: 'Number', pass: /\d/.test(form.password) },
      {
        label: 'Symbol (!@#$…)',
        pass: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password),
      },
    ],
    [form.password],
  );
  const passedCount = passwordChecks.filter((item) => item.pass).length;
  const strengthPercent = (passedCount / passwordChecks.length) * 100;
  const strengthLabel =
    passedCount <= 1
      ? 'Very weak'
      : passedCount === 2
        ? 'Weak'
        : passedCount === 3
          ? 'Okay'
          : passedCount === 4
            ? 'Strong'
            : 'Excellent';

  // Updates either password field through the input name so confirmation stays in the same form object.
  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Validates the reset token and password policy locally before sending a credential-changing request.
  function validate() {
    const issues: string[] = [];
    if (!token) {
      issues.push(
        'Reset link is missing or invalid. Request a new link from the forgot-password page.',
      );
    }
    if (!form.password || form.password.length < 10) {
      issues.push('Password must be at least 10 characters.');
    } else if (
      !/(?=.*[a-z])/.test(form.password) ||
      !/(?=.*[A-Z])/.test(form.password) ||
      !/(?=.*\d)/.test(form.password) ||
      !/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(form.password)
    ) {
      issues.push(
        'Password must include uppercase, lowercase, number, and symbol characters.',
      );
    }
    if (form.password !== form.confirmPassword) {
      issues.push('Passwords do not match.');
    }
    return issues;
  }

  // Completes the reset flow and sends users back to login with a success notice.
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setErrors([]);

    const issues = validate();
    if (issues.length) {
      setErrors(issues);
      return;
    }

    try {
      await resetPasswordMutation.mutateAsync({
        token,
        password: form.password,
      });
      navigate('/login', {
        replace: true,
        state: {
          message: 'Password reset. Log in with your new password.',
        },
      });
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        // Server validation details are rendered as field-style issues when available.
        const serverMessages =
          submitError.details?.map((detail) => detail.message) ??
          (() => {
            const data = submitError.data as { message?: unknown };
            return data && Array.isArray(data.message)
              ? data.message.map(String)
              : data && typeof data.message === 'string'
                ? [data.message]
                : [];
          })();
        if (serverMessages.length) {
          setErrors(serverMessages);
        } else {
          setError(
            getDisplayErrorMessage(submitError, {
              fallbackMessage: 'Unable to reset password right now.',
            }),
          );
        }
      } else {
        // Unexpected failures are intentionally generic because they may not be user-actionable.
        setError('Something went wrong. Please try again.');
      }
    }
  }

  // Return the reset-password page view model, including derived password-meter state.
  return {
    token,
    hasToken: token.length > 0,
    form,
    error,
    errors,
    showMeter,
    setShowMeter,
    passwordChecks,
    passedCount,
    strengthPercent,
    strengthLabel,
    isSubmitting: resetPasswordMutation.isPending,
    handlePasswordChange,
    handleSubmit,
  };
}
