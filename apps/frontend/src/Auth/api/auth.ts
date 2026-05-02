// Provides the frontend Auth module's repository-style API boundary for backend authentication endpoints.
import type {
  AuthResponse,
  LoginPayload,
  VerifyEmailPayload,
  ResendVerificationPayload,
  ResendVerificationResponse,
  RegisterPayload,
  RegisterResponse,
  LogoutResponse,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  ResetPasswordPayload,
  ResetPasswordResponse
} from '@scholarxp/api-contracts';
import { ApiError, apiFetch } from '@/shared/api/client';

// Creates a password-based account and returns the backend's registration outcome.
export async function registerByEmail(payload: RegisterPayload): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Authenticates an existing email/password account and returns the session user when successful.
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Retrieves the current session user, allowing app bootstrapping to restore authentication state.
export async function getCurrentUser(): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/me', {
    method: 'GET',
  });
}

// Ends the current server-backed session and returns the backend logout acknowledgement.
export async function logout(): Promise<LogoutResponse> {
  return apiFetch<LogoutResponse>('/auth/logout', {
    method: 'POST',
  });
}

// Exchanges an email verification token for an authenticated session when the token is valid.
export async function verifyEmail(token: string): Promise<AuthResponse> {
  const payload: VerifyEmailPayload = { token };
  return apiFetch<AuthResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Requests a fresh verification message for users who have not completed email confirmation.
export async function resendVerification(
  email: string,
): Promise<ResendVerificationResponse> {
  const payload: ResendVerificationPayload = { email };
  return apiFetch<ResendVerificationResponse>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Starts the password recovery flow without exposing whether the email belongs to an account.
export async function forgotPassword(
  email: string,
): Promise<ForgotPasswordResponse> {
  const payload: ForgotPasswordPayload = { email };
  return apiFetch<ForgotPasswordResponse>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Completes password recovery by submitting the emailed reset token with the replacement password.
export async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<ResetPasswordResponse> {
  return apiFetch<ResetPasswordResponse>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export { ApiError };
export type { LoginPayload, RegisterPayload, RegisterResponse, LogoutResponse };
