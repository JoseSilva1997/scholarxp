import { apiRequest } from './client';
import type { AuthResponse } from '../types/auth';

export function register(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return apiRequest<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
  });
}

export function me() {
  return apiRequest<AuthResponse>('/auth/me');
}
