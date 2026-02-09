// Encapsulates Register route orchestration (validation + submission) so the page stays render-focused.
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/auth';
import { getDisplayErrorMessage } from '../../api/get-display-error';
import { NAME_MAX_LENGTH, NAME_REGEX } from '@scholarxp/constants';
import { useRegisterByEmailMutation } from '../queries/useAuthMutations';

export function useRegisterPageState() {
  const navigate = useNavigate();
  const registerByEmailMutation = useRegisterByEmailMutation();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showMeter, setShowMeter] = useState(false);

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

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validateForm() {
    const issues: string[] = [];
    const trimmedFirst = form.firstName.trim();
    const trimmedLast = form.lastName.trim();
    const trimmedEmail = form.email.trim();
    const INVALID_NAME_MESSAGE =
      'First and last names cannot contain < > / @ # $ % ^ & * ( ) [ ] { } ; : " \' | ` ~ or \\';

    if (!trimmedFirst) {
      issues.push('First name is required.');
    } else {
      if (trimmedFirst.length > NAME_MAX_LENGTH) {
        issues.push(`First name must be at most ${NAME_MAX_LENGTH} characters.`);
      }
      if (!NAME_REGEX.test(trimmedFirst)) {
        issues.push(INVALID_NAME_MESSAGE);
      }
    }

    if (!trimmedLast) {
      issues.push('Last name is required.');
    } else {
      if (trimmedLast.length > NAME_MAX_LENGTH) {
        issues.push(`Last name must be at most ${NAME_MAX_LENGTH} characters.`);
      }
      if (!NAME_REGEX.test(trimmedLast) && !issues.includes(INVALID_NAME_MESSAGE)) {
        issues.push(INVALID_NAME_MESSAGE);
      }
    }

    if (!trimmedEmail) {
      issues.push('Email is required.');
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      issues.push('Enter a valid email address.');
    }

    if (!form.password || form.password.length < 10) {
      issues.push('Password must be at least 10 characters.');
    } else if (
      !/(?=.*[a-z])/.test(form.password) ||
      !/(?=.*[A-Z])/.test(form.password) ||
      !/(?=.*\d)/.test(form.password) ||
      !/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(form.password)
    ) {
      issues.push('Password must include uppercase, lowercase, number, and symbol characters.');
    }

    if (form.password !== form.confirmPassword) {
      issues.push('Passwords do not match.');
    }

    return issues;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setErrors([]);

    const validationIssues = validateForm();
    if (validationIssues.length) {
      setErrors(validationIssues);
      return;
    }

    try {
      await registerByEmailMutation.mutateAsync({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      // Send the user to the verification screen so they can confirm their email before logging in.
      navigate('/verify-email', {
        replace: true,
        state: { email: form.email.trim().toLowerCase() },
      });
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        // Prefer normalized detail messages from the API parser so validation UX is consistent.
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
              fallbackMessage: 'Unable to create your account right now.',
            }),
          );
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  }

  return {
    form,
    error,
    errors,
    showMeter,
    setShowMeter,
    passwordChecks,
    passedCount,
    strengthPercent,
    strengthLabel,
    isSubmitting: registerByEmailMutation.isPending,
    handleChange,
    handleSubmit,
  };
}

