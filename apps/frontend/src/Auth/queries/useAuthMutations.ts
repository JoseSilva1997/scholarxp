// Auth mutation hooks centralize request wiring so auth screens can stay focused on UX flow.
import { useMutation } from '@tanstack/react-query';
import {
  forgotPassword,
  login,
  registerByEmail,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '@/Auth/api/auth';

export function useLoginMutation() {
  return useMutation({
    mutationFn: login,
  });
}

export function useRegisterByEmailMutation() {
  return useMutation({
    mutationFn: registerByEmail,
  });
}

export function useVerifyEmailMutation() {
  return useMutation({
    mutationFn: verifyEmail,
  });
}

export function useResendVerificationMutation() {
  return useMutation({
    mutationFn: resendVerification,
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: forgotPassword,
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: resetPassword,
  });
}
