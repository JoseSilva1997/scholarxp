// Verifies OAuth entrypoint behavior for login/register screens.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialAuthButtons } from './SocialAuthButtons';

describe('SocialAuthButtons', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('disables provider buttons and shows helper when VITE_API_URL is missing', () => {
    vi.stubEnv('VITE_API_URL', '');
    render(<SocialAuthButtons context="login" />);

    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
    expect(screen.getByText('Set VITE_API_URL to enable OAuth sign-in.')).toBeInTheDocument();
  });

  it('redirects to provider OAuth endpoint with intent and redirect params', () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test');
    sessionStorage.setItem('postAuthRedirect', '/main/modules?tab=1#x');

    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    });

    render(<SocialAuthButtons context="register" />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));

    expect(assign).toHaveBeenCalledWith(
      'http://api.test/auth/oauth/google?intent=register&redirect=%2Fmain%2Fmodules%3Ftab%3D1%23x',
    );
  });
});
