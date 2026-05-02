// Adapts Auth repository calls into React Query mutations for use by route-level page-state hooks.
import { useMutation } from '@tanstack/react-query';
import {
  forgotPassword,
  login,
  registerByEmail,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '@/Auth/api/auth';

// Exposes the email/password login mutation to the Login page-state hook.
export function useLoginMutation() {
  return useMutation({
    mutationFn: login,
  });
}

// Exposes the account registration mutation while keeping API details outside the Register component.
export function useRegisterByEmailMutation() {
  return useMutation({
    mutationFn: registerByEmail,
  });
}

// Exposes the email verification mutation used after registration or blocked login attempts.
export function useVerifyEmailMutation() {
  return useMutation({
    mutationFn: verifyEmail,
  });
}

// Exposes the resend-code mutation and lets page state own cooldown and messaging behavior.
export function useResendVerificationMutation() {
  return useMutation({
    mutationFn: resendVerification,
  });
}

// Exposes the forgot-password mutation for requesting a reset link from the backend.
export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: forgotPassword,
  });
}

// Exposes the reset-password mutation used to submit the emailed token and new credential.
export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: resetPassword,
  });
}
