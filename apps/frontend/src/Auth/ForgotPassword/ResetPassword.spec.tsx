// Verifies reset-password screen renders token, meter, error, and submission states from page state.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPassword from '@/Auth/ForgotPassword/ResetPassword';
import { useResetPasswordPageState } from '@/Auth/ForgotPassword/page-state/useResetPasswordPageState';

vi.mock('@/Auth/AuthVisual', () => ({
  AuthVisual: () => <div data-testid="auth-visual" />,
}));

vi.mock('@/Auth/ForgotPassword/page-state/useResetPasswordPageState', () => ({
  useResetPasswordPageState: vi.fn(),
}));

function baseState() {
  return {
    token: 'reset-token',
    hasToken: true,
    form: { password: '', confirmPassword: '' },
    error: null,
    errors: [],
    showMeter: false,
    setShowMeter: vi.fn(),
    passwordChecks: [
      { label: 'At least 10 characters', pass: true },
      { label: 'Uppercase letter', pass: false },
    ],
    passedCount: 1,
    strengthPercent: 50,
    strengthLabel: 'Weak',
    isSubmitting: false,
    handlePasswordChange: vi.fn(),
    handleSubmit: vi.fn(async (event: React.FormEvent) => {
      event.preventDefault();
    }),
  };
}

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useResetPasswordPageState).mockReturnValue(baseState());
  });

  it('renders the reset form and delegates input/submission to page state', () => {
    const state = baseState();
    vi.mocked(useResetPasswordPageState).mockReturnValue(state);

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Validpass1!' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Reset password' }).closest('form')!);

    expect(state.handlePasswordChange).toHaveBeenCalledTimes(1);
    expect(state.handleSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('renders missing-token warning, meter, validation errors, and submitting state', () => {
    vi.mocked(useResetPasswordPageState).mockReturnValue({
      ...baseState(),
      hasToken: false,
      showMeter: true,
      error: 'Unable to reset password right now.',
      errors: ['Password must be at least 10 characters.'],
      isSubmitting: true,
    });

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Reset link is missing or invalid/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('Password must be at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByText('Unable to reset password right now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resetting…' })).toBeDisabled();
  });
});
