import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

type AuthFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type AuthMode = 'login' | 'register';

export type AuthFormData = AuthFormState;

type AuthFormProps = {
  mode: AuthMode;
  submitting: boolean;
  onSubmit: (data: AuthFormData) => void | Promise<void>;
};

const emptyForm: AuthFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
};

export function AuthForm({ mode, submitting, onSubmit }: AuthFormProps) {
  const [form, setForm] = useState<AuthFormState>(emptyForm);

  // Curried updater keeps each input handler tiny and consistent.
  const updateField = (key: keyof AuthFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  // Keep form submission responsibilities in the parent.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      {mode === 'register' && (
        <div className="row">
          <label>
            First name
            <input
              value={form.firstName}
              onChange={updateField('firstName')}
              placeholder="Jamie"
              autoComplete="given-name"
              required
            />
          </label>
          <label>
            Last name
            <input
              value={form.lastName}
              onChange={updateField('lastName')}
              placeholder="Nguyen"
              autoComplete="family-name"
              required
            />
          </label>
        </div>
      )}

      <label>
        Email
        <input
          type="email"
          value={form.email}
          onChange={updateField('email')}
          placeholder="you@campus.edu"
          autoComplete="email"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={form.password}
          onChange={updateField('password')}
          placeholder="••••••••"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
    </form>
  );
}
