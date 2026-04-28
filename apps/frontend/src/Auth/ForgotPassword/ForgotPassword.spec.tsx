// Verifies forgot-password screen renders hook state and delegates user events to page-state handlers.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPassword from '@/Auth/ForgotPassword/ForgotPassword';
import { useForgotPasswordPageState } from '@/Auth/ForgotPassword/page-state/useForgotPasswordPageState';

vi.mock('@/Auth/AuthVisual', () => ({
  AuthVisual: () => <div data-testid="auth-visual" />,
}));

vi.mock('@/Auth/ForgotPassword/page-state/useForgotPasswordPageState', () => ({
  useForgotPasswordPageState: vi.fn(),
}));

describe('ForgotPassword', () => {
  const handleChange = vi.fn();
  const handleSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useForgotPasswordPageState).mockReturnValue({
      email: 'ada@example.com',
      error: null,
      status: 'idle',
      isSubmitting: false,
      handleChange,
      handleSubmit,
    });
  });

  it('renders the form and delegates typing/submission to page state', () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send reset link' }).closest('form')!);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Back to log in' })).toHaveAttribute('href', '/login');
  });

  it('renders error, sent, OAuth-only, and submitting states', () => {
    vi.mocked(useForgotPasswordPageState).mockReturnValue({
      email: 'ada@example.com',
      error: 'Unable to send reset link right now.',
      status: 'sent',
      isSubmitting: true,
      handleChange,
      handleSubmit,
    });

    const { rerender } = render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    expect(screen.getByText('Unable to send reset link right now.')).toBeInTheDocument();
    expect(screen.getByText(/we've sent a reset link/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();

    vi.mocked(useForgotPasswordPageState).mockReturnValue({
      email: 'ada@example.com',
      error: null,
      status: 'no_password',
      isSubmitting: false,
      handleChange,
      handleSubmit,
    });
    rerender(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>,
    );

    expect(screen.getByText(/This account signs in with Google/i)).toBeInTheDocument();
  });
});
