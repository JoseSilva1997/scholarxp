// Verifies AcceptInvite route rendering branches so invite redemption states stay user-readable.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AcceptInvite from './AcceptInvite';

const mocks = vi.hoisted(() => ({
  goToModules: vi.fn(),
}));

let state = {
  hasToken: true,
  isPending: false,
  isSuccess: false,
  errorMessage: null as string | null,
};

vi.mock('../../hooks/page-state/useAcceptInvitePageState', () => ({
  useAcceptInvitePageState: () => ({
    ...state,
    goToModules: mocks.goToModules,
  }),
}));

vi.mock('../../components/MainSection', () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <section data-classname={className}>{children}</section>
  ),
}));

describe('AcceptInvite route', () => {
  beforeEach(() => {
    state = {
      hasToken: true,
      isPending: false,
      isSuccess: false,
      errorMessage: null,
    };
    mocks.goToModules.mockReset();
  });

  it('shows pending copy while invite redemption is in progress', () => {
    state.isPending = true;

    render(<AcceptInvite />);

    expect(screen.getByText('Redeeming your invite…')).toBeInTheDocument();
  });

  it('shows success copy after invite redemption completes', () => {
    state.isSuccess = true;

    render(<AcceptInvite />);

    expect(screen.getByText('Success! Redirecting you to your modules.')).toBeInTheDocument();
  });

  it('shows error and triggers goToModules action from CTA', () => {
    state.errorMessage = 'Invite token is invalid.';

    render(<AcceptInvite />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invite token is invalid.');

    fireEvent.click(screen.getByRole('button', { name: 'Go to modules' }));
    expect(mocks.goToModules).toHaveBeenCalled();
  });

  it('shows preparing copy when no branch is active', () => {
    state.hasToken = false;

    render(<AcceptInvite />);

    expect(screen.getByText('Preparing invite redemption…')).toBeInTheDocument();
  });
});
