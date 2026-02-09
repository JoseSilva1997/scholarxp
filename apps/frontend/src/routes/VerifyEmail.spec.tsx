// Verifies VerifyEmail route wiring so verification/resend actions delegate to page-state handlers.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VerifyEmail from './VerifyEmail';

const mocks = vi.hoisted(() => ({
  setEmail: vi.fn(),
  setCode: vi.fn(),
  handleVerify: vi.fn(),
  handleResend: vi.fn(),
}));

let state = {
  email: 'student@example.com',
  code: '',
  error: null as string | null,
  info: null as string | null,
  cooldown: 0,
  isVerifying: false,
  isResending: false,
};

vi.mock('../hooks/page-state/useVerifyEmailPageState', () => ({
  useVerifyEmailPageState: () => ({
    ...state,
    setEmail: mocks.setEmail,
    setCode: mocks.setCode,
    handleVerify: mocks.handleVerify,
    handleResend: mocks.handleResend,
  }),
}));

describe('VerifyEmail route', () => {
  beforeEach(() => {
    state = {
      email: 'student@example.com',
      code: '',
      error: null,
      info: null,
      cooldown: 0,
      isVerifying: false,
      isResending: false,
    };
    mocks.setEmail.mockReset();
    mocks.setCode.mockReset();
    mocks.handleVerify.mockReset();
    mocks.handleResend.mockReset();
  });

  it('delegates field changes and verify/resend actions', () => {
    render(
      <MemoryRouter>
        <VerifyEmail />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '1234' },
    });
    expect(mocks.setCode).toHaveBeenCalledWith('1234');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    expect(mocks.setEmail).toHaveBeenCalledWith('new@example.com');

    fireEvent.submit(screen.getByRole('button', { name: 'Verify and continue' }).closest('form')!);
    expect(mocks.handleVerify).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    expect(mocks.handleResend).toHaveBeenCalled();
  });

  it('renders error/info and disabled resend state from hook', () => {
    state.error = 'Invalid code';
    state.info = 'Code sent';
    state.cooldown = 10;

    render(
      <MemoryRouter>
        <VerifyEmail />
      </MemoryRouter>,
    );

    expect(screen.getByText('Invalid code')).toBeInTheDocument();
    expect(screen.getByText('Code sent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend in 10s' })).toBeDisabled();
  });
});
