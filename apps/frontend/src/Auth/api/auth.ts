import type { 
  AuthResponse, 
  LoginPayload, 
  VerifyEmailPayload,
  ResendVerificationPayload,
  ResendVerificationResponse,
  RegisterPayload, 
  RegisterResponse,
  LogoutResponse
} from '@scholarxp/api-contracts';
import { ApiError, apiFetch } from '@/shared/api/client';

export async function registerByEmail(payload: RegisterPayload): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

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

export async function logout(): Promise<LogoutResponse> {
  return apiFetch<LogoutResponse>('/auth/logout', {
    method: 'POST',
  });
}

export async function verifyEmail(token: string): Promise<AuthResponse> {
  const payload: VerifyEmailPayload = { token };
  return apiFetch<AuthResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resendVerification(
  email: string,
): Promise<ResendVerificationResponse> {
  const payload: ResendVerificationPayload = { email };
  return apiFetch<ResendVerificationResponse>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export { ApiError };
export type { LoginPayload, RegisterPayload, RegisterResponse, LogoutResponse };
