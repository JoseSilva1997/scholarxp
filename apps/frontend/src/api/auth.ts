import type { AuthResponse } from '../types/auth';
import { ApiError, apiFetch } from './client';

export type RegisterByEmailPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export async function registerByEmail(payload: RegisterByEmailPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register-by-email', {
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

export { ApiError };
