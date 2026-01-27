import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, registerByEmail } from '../api/auth';
import styles from './Register.module.css';

// Keep client-side validation aligned with backend rules so users see immediate feedback.
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ'\- ]+$/;
const NAME_MAX_LENGTH = 40;

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validateForm() {
    const issues: string[] = [];
    const trimmedFirst = form.firstName.trim();
    const trimmedLast = form.lastName.trim();
    const trimmedEmail = form.email.trim();

    if (!trimmedFirst) {
      issues.push('First name is required.');
    } else {
      if (trimmedFirst.length > NAME_MAX_LENGTH) {
        issues.push(`First name must be at most ${NAME_MAX_LENGTH} characters.`);
      }
      if (!NAME_REGEX.test(trimmedFirst)) {
        issues.push('First name can only include letters, spaces, apostrophes, or hyphens.');
      }
    }

    if (!trimmedLast) {
      issues.push('Last name is required.');
    } else {
      if (trimmedLast.length > NAME_MAX_LENGTH) {
        issues.push(`Last name must be at most ${NAME_MAX_LENGTH} characters.`);
      }
      if (!NAME_REGEX.test(trimmedLast)) {
        issues.push('Last name can only include letters, spaces, apostrophes, or hyphens.');
      }
    }

    if (!trimmedEmail) {
      issues.push('Email is required.');
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      issues.push('Enter a valid email address.');
    }

    if (!form.password || form.password.length < 8) {
      issues.push('Password must be at least 8 characters.');
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

    setIsSubmitting(true);
    try {
      await registerByEmail({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { message?: unknown };
        const serverMessages =
          data && Array.isArray(data.message)
            ? data.message.map(String)
            : data && typeof data.message === 'string'
              ? [data.message]
              : [];
        if (serverMessages.length) {
          setErrors(serverMessages);
        } else {
          setError(err.message || 'Unable to create your account right now.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
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
                    minLength={8}
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
                    minLength={8}
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
                <button className={styles.primaryBtn} type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating account…' : 'Create account'}
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
