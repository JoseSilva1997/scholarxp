// Verifies Register route wiring so page-state handlers drive form behavior and password meter rendering.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Register from './Register';

const mocks = vi.hoisted(() => ({
  setShowMeter: vi.fn(),
  handleChange: vi.fn(),
  handleSubmit: vi.fn(),
}));

let state = {
  form: {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    password: 'Abcdef!234',
    confirmPassword: 'Abcdef!234',
  },
  error: null as string | null,
  errors: [] as string[],
  showMeter: false,
  passwordChecks: [{ label: 'At least 10 characters', pass: true }],
  passedCount: 1,
  strengthPercent: 20,
  strengthLabel: 'Weak',
  isSubmitting: false,
};

vi.mock('../hooks/page-state/useRegisterPageState', () => ({
  useRegisterPageState: () => ({
    ...state,
    setShowMeter: mocks.setShowMeter,
    handleChange: mocks.handleChange,
    handleSubmit: mocks.handleSubmit,
  }),
}));

vi.mock('../components/SocialAuthButtons', () => ({
  SocialAuthButtons: ({ context }: { context: string }) => <div>social-{context}</div>,
}));

describe('Register route', () => {
  beforeEach(() => {
    state = {
      form: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'Abcdef!234',
        confirmPassword: 'Abcdef!234',
      },
      error: null,
      errors: [],
      showMeter: false,
      passwordChecks: [{ label: 'At least 10 characters', pass: true }],
      passedCount: 1,
      strengthPercent: 20,
      strengthLabel: 'Weak',
      isSubmitting: false,
    };
    mocks.setShowMeter.mockReset();
    mocks.handleChange.mockReset();
    mocks.handleSubmit.mockReset();
  });

  it('delegates input/focus/submit interactions to page-state handlers', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Janet' },
    });
    expect(mocks.handleChange).toHaveBeenCalled();

    fireEvent.focus(screen.getByLabelText('Password'));
    expect(mocks.setShowMeter).toHaveBeenCalledWith(true);

    fireEvent.blur(screen.getByLabelText('Password'));
    expect(mocks.setShowMeter).toHaveBeenCalledWith(false);

    const form = screen.getByRole('button', { name: 'Create account' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(mocks.handleSubmit).toHaveBeenCalled();
  });

  it('renders meter and alert blocks when hook exposes them', () => {
    state.showMeter = true;
    state.error = 'Server failed';
    state.errors = ['First name is required.'];

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    expect(screen.getByText('Password strength')).toBeInTheDocument();
    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.getByText('Please fix the following:')).toBeInTheDocument();
    expect(screen.getByText('Server failed')).toBeInTheDocument();
  });
});
