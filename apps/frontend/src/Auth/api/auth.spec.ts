// Verifies auth API helpers call apiFetch with expected auth-route contracts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentUser,
  login,
  logout,
  registerByEmail,
  resendVerification,
  verifyEmail,
} from '@/Auth/api/auth';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiFetch: clientMocks.apiFetch,
  ApiError: class ApiError extends Error {},
}));

describe('auth api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('registers by email with POST /auth/register', async () => {
    const payload = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'Abcdef!234',
    };

    await registerByEmail(payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('logs in with POST /auth/login', async () => {
    const payload = {
      email: 'jane@example.com',
      password: 'Abcdef!234',
    };

    await login(payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('fetches current user with GET /auth/me', async () => {
    await getCurrentUser();

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/auth/me', {
      method: 'GET',
    });
  });

  it('logs out with POST /auth/logout', async () => {
    await logout();

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
    });
  });

  it('verifies email with POST /auth/verify-email and token payload', async () => {
    await verifyEmail('verify-token-123');

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: 'verify-token-123' }),
    });
  });

  it('resends verification with POST /auth/resend-verification and email payload', async () => {
    await resendVerification('jane@example.com');

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: 'jane@example.com' }),
    });
  });
});
