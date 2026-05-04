// Verifies Register route wiring so page-state handlers drive form behavior and password meter rendering.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Register from '@/Auth/Register/Register';

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

vi.mock('@/Auth/Register/page-state/useRegisterPageState', () => ({
  useRegisterPageState: () => ({
    ...state,
    setShowMeter: mocks.setShowMeter,
    handleChange: mocks.handleChange,
    handleSubmit: mocks.handleSubmit,
  }),
}));

vi.mock('@/Auth/SocialAuthButtons', () => ({
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

  it('applies meterWeak class when passedCount < 3', () => {
    // Test the weak branch: passedCount < 3 → styles.meterWeak
    state.showMeter = true;
    state.passedCount = 1;
    state.strengthLabel = 'Weak';

    const { container } = render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    const meterFill = container.querySelector('[role="progressbar"] > div');
    const className = meterFill?.className || '';
    expect(className).toMatch(/_meterWeak_/);
    expect(className).not.toMatch(/_meterOkay_/);
    expect(className).not.toMatch(/_meterStrong_/);
  });

  it('applies meterOkay class when passedCount is 3 or 4', () => {
    // Test the okay branch: passedCount >= 3 && passedCount < 4 → styles.meterOkay
    state.showMeter = true;
    state.passedCount = 3;
    state.strengthLabel = 'Okay';

    const { container } = render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    const meterFill = container.querySelector('[role="progressbar"] > div');
    const className = meterFill?.className || '';
    expect(className).toMatch(/_meterOkay_/);
    expect(className).not.toMatch(/_meterWeak_/);
    expect(className).not.toMatch(/_meterStrong_/);
  });

  it('applies meterStrong class when passedCount >= 4', () => {
    // Test the strong branch: passedCount >= 4 → styles.meterStrong
    state.showMeter = true;
    state.passedCount = 4;
    state.strengthPercent = 80;
    state.strengthLabel = 'Strong';

    const { container } = render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    const meterFill = container.querySelector('[role="progressbar"] > div');
    const className = meterFill?.className || '';
    expect(className).toMatch(/_meterStrong_/);
    expect(className).not.toMatch(/_meterWeak_/);
    expect(className).not.toMatch(/_meterOkay_/);
  });

  it('shows "Creating account…" button text when isSubmitting is true', () => {
    // Test the isSubmitting true branch: isSubmitting ? 'Creating account…' : 'Create account'
    state.isSubmitting = true;

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Creating account…' });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('shows "Create account" button text when isSubmitting is false', () => {
    // Test the isSubmitting false branch
    state.isSubmitting = false;

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Create account' });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('applies reqPass class for passed password checks and reqFail for failed', () => {
    // Test the item.pass ternary: item.pass ? styles.reqPass : styles.reqFail
    state.showMeter = true;
    state.passwordChecks = [
      { label: 'At least 10 characters', pass: true },
      { label: 'Contains uppercase letter', pass: false },
      { label: 'Contains special character', pass: true },
    ];

    const { container } = render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    // Find all requirement items
    const items = container.querySelectorAll('[role="progressbar"] ~ ul li');
    expect(items).toHaveLength(3);

    // Verify first item (pass=true) has reqPass applied
    const firstItem = items[0];
    const firstClassName = firstItem.className;
    expect(firstClassName).toMatch(/_reqPass_/);

    // Verify second item (pass=false) has reqFail applied
    const secondItem = items[1];
    const secondClassName = secondItem.className;
    expect(secondClassName).toMatch(/_reqFail_/);

    // Verify third item (pass=true) has reqPass applied
    const thirdItem = items[2];
    const thirdClassName = thirdItem.className;
    expect(thirdClassName).toMatch(/_reqPass_/);
  });
});
