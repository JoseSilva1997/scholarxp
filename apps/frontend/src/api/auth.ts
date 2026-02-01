import type { AuthResponse } from '../types/auth';
import { ApiError, apiFetch } from './client';

export type RegisterByEmailPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type RegisterResponse = AuthResponse & { pendingEmailVerification?: boolean };

export async function registerByEmail(payload: RegisterByEmailPayload): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type LoginPayload = {
  email: string;
  password: string;
};

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser(): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/me', {
    method: 'GET',
  });
}

export async function logout(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
  });
}

export async function verifyEmail(token: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(email: string): Promise<{ sent: boolean; alreadyVerified?: boolean; reason?: string }> {
  return apiFetch('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export { ApiError };
