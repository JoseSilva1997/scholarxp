// Owns logic for the ForgotPassword screen so the route component stays presentational.
// Submits the email, then surfaces feedback in place: confirmation when a link is sent,
// or an explicit "use Google sign-in" hint when the account is OAuth-only.
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { getDisplayErrorMessage } from '@/shared/api/get-display-error';
import { useForgotPasswordMutation } from '@/Auth/queries/useAuthMutations';

type Status = 'idle' | 'sent' | 'no_password';

export function useForgotPasswordPageState() {
  const forgotPasswordMutation = useForgotPasswordMutation();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
    if (status !== 'idle') {
      setStatus('idle');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }

    try {
      const result = await forgotPasswordMutation.mutateAsync(trimmed);
      // Backend distinguishes OAuth-only accounts so we can guide the user to Google sign-in.
      if (result.sent === false && result.reason === 'no_password') {
        setStatus('no_password');
        return;
      }
      setStatus('sent');
    } catch (submitError) {
      setError(
        getDisplayErrorMessage(submitError, {
          fallbackMessage: 'Unable to send reset link right now.',
        }),
      );
    }
  }

  return {
    email,
    error,
    status,
    isSubmitting: forgotPasswordMutation.isPending,
    handleChange,
    handleSubmit,
  };
}
