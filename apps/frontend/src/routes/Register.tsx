import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/auth';
import { getDisplayErrorMessage } from '../api/get-display-error';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import styles from './Register.module.css';
import { NAME_MAX_LENGTH, NAME_REGEX} from '@scholarxp/constants';
import { useRegisterByEmailMutation } from '../hooks/useAuthMutations';

export default function Register() {
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
  // Derive password strength feedback so users can fix issues before submission.
  const passwordChecks = [
    { label: 'At least 10 characters', pass: form.password.length >= 10 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(form.password) },
    { label: 'Lowercase letter', pass: /[a-z]/.test(form.password) },
    { label: 'Number', pass: /\d/.test(form.password) },
    {
      label: 'Symbol (!@#$…)',
      pass: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password),
    },
  ];
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
    const INVALID_NAME_MESSAGE = 'First and last names cannot contain < > / @ # $ % ^ & * ( ) [ ] { } ; : " \' | ` ~ or \\';

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
    } catch (err) {
      if (err instanceof ApiError) {
        // Prefer normalized detail messages from the API parser so validation UX is consistent.
        const serverMessages =
          err.details?.map((detail) => detail.message) ??
          (() => {
            const data = err.data as { message?: unknown };
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
            getDisplayErrorMessage(err, {
              fallbackMessage: 'Unable to create your account right now.',
            }),
          );
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <div className={styles.authShell}>
      <div className={styles.authLayout}>
        <section className={styles.visual} aria-hidden="true" />

        <div className={styles.cardColumn}>
          <section className={styles.card}>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>Set up your login so you can pick up practice anywhere.</p>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="firstName">
                    First name
                  </label>
                  <input
                    className={styles.input}
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Alex"
                    autoComplete="given-name"
                    maxLength={40}
                    value={form.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="lastName">
                    Last name
                  </label>
                  <input
                    className={styles.input}
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Rivera"
                    autoComplete="family-name"
                    maxLength={40}
                    value={form.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">
                  Email
                </label>
                <input
                  className={styles.input}
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.edu"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="password">
                    Password
                  </label>
                  <input
                    className={styles.input}
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Create a password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    onFocus={() => setShowMeter(true)}
                    onBlur={() => setShowMeter(false)}
                    minLength={10}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <input
                    className={styles.input}
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setShowMeter(true)}
                    onBlur={() => setShowMeter(false)}
                    minLength={10}
                    required
                  />
                </div>
              </div>

              {errors.length > 0 ? (
                <div className={styles.error} role="alert">
                  <p className={styles.errorTitle}>Please fix the following:</p>
                  <ul className={styles.errorList}>
                    {errors.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {error ? (
                <div className={styles.error} role="alert">
                  {error}
                </div>
              ) : null}

              <div className={styles.actions}>
                <button className={styles.primaryBtn} type="submit" disabled={registerByEmailMutation.isPending}>
                  {registerByEmailMutation.isPending ? 'Creating account…' : 'Create account'}
                </button>
                <span className={styles.inlineHelper}>
                  <span>Already have an account? </span>
                  <Link className={styles.helperLink} to="/login">
                    Log in
                  </Link>
                </span>
              </div>
            </form>
          </section>

          <SocialAuthButtons context="register" />

          {showMeter ? (
            <section className={styles.meterPanel} aria-live="polite">
              <div className={styles.meterPanelHeader}>
                <span>Password strength</span>
                <strong>{strengthLabel}</strong>
              </div>
              <div
                className={styles.meter}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(strengthPercent)}
              >
                <div
                  className={`${styles.meterFill} ${
                    passedCount >= 4
                      ? styles.meterStrong
                      : passedCount >= 3
                        ? styles.meterOkay
                        : styles.meterWeak
                  }`}
                  style={{ width: `${strengthPercent}%` }}
                />
              </div>
              <ul className={styles.requirements}>
                {passwordChecks.map((item) => (
                  <li key={item.label} className={item.pass ? styles.reqPass : styles.reqFail}>
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <aside className={styles.helper}>
            <div className={styles.helperCard}>
              Have an invite code? You can enter it after creating your account.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
