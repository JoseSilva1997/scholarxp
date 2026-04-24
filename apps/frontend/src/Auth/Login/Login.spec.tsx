// Verifies Login route wiring so form inputs and submit actions delegate to page-state handlers.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from '@/Auth/Login/Login';

const mocks = vi.hoisted(() => ({
  handleChange: vi.fn(),
  handleSubmit: vi.fn(),
}));

let state = {
  form: { email: 'student@example.com', password: 'secret' },
  error: null as string | null,
  isSubmitting: false,
};

vi.mock('@/Auth/Login/page-state/useLoginPageState', () => ({
  useLoginPageState: () => ({
    ...state,
    handleChange: mocks.handleChange,
    handleSubmit: mocks.handleSubmit,
  }),
}));

vi.mock('@/Auth/SocialAuthButtons', () => ({
  SocialAuthButtons: ({ context }: { context: string }) => <div>social-{context}</div>,
}));

describe('Login route', () => {
  beforeEach(() => {
    state = {
      form: { email: 'student@example.com', password: 'secret' },
      error: null,
      isSubmitting: false,
    };
    mocks.handleChange.mockReset();
    mocks.handleSubmit.mockReset();
  });

  it('renders login form and delegates input/submit handlers', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    expect(mocks.handleChange).toHaveBeenCalled();

    const form = screen.getByRole('button', { name: 'Log in' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(mocks.handleSubmit).toHaveBeenCalled();
  });

  it('shows error text and submitting button state when provided by hook', () => {
    state.error = 'Invalid credentials';
    state.isSubmitting = true;

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logging in…' })).toBeDisabled();
  });
});
