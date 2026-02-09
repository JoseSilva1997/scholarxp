// Exercises register page-state covering all validation paths, password strength calculations, and error handling branches.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChangeEvent, FormEvent } from 'react';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/auth';
import { useRegisterPageState } from './useRegisterPageState';

const navigateMock = vi.fn();
const mutateAsyncMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../queries/useAuthMutations', () => ({
  useRegisterByEmailMutation: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

describe('useRegisterPageState', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mutateAsyncMock.mockReset();
  });

  describe('Form State and Changes', () => {
    it('initializes form with empty strings', () => {
      const { result } = renderHook(() => useRegisterPageState());

      expect(result.current.form).toEqual({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
    });

    it('updates form fields via handleChange', () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'john@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.form.firstName).toBe('John');
      expect(result.current.form.lastName).toBe('Doe');
      expect(result.current.form.email).toBe('john@example.com');
      expect(result.current.form.password).toBe('Secure123!');
      expect(result.current.form.confirmPassword).toBe('Secure123!');
    });

    it('preserves partial form state when updating individual fields', () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'Jane' } } as ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.form.firstName).toBe('Jane');
      expect(result.current.form.lastName).toBe('');
      expect(result.current.form.email).toBe('');
    });
  });

  describe('Password Strength Calculations', () => {
    it('calculates password checks (0/5 when empty)', () => {
      const { result } = renderHook(() => useRegisterPageState());

      expect(result.current.passedCount).toBe(0);
      expect(result.current.passwordChecks).toHaveLength(5);
      expect(result.current.passwordChecks.every((check) => !check.pass)).toBe(true);
      expect(result.current.strengthLabel).toBe('Very weak');
      expect(result.current.strengthPercent).toBe(0);
    });

    it('calculates password checks (1/5: length only)', () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        // Use 10 spaces to pass only the length check, avoid numbers/letters/symbols
        result.current.handleChange({ target: { name: 'password', value: '          ' } } as ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.passedCount).toBe(1);
      expect(result.current.passwordChecks[0].pass).toBe(true); // length
      expect(result.current.strengthLabel).toBe('Very weak');
      expect(result.current.strengthPercent).toBe(20);
    });

    it('calculates password checks (2/5: length + lowercase)', () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'password', value: 'abcdefghij' } } as ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.passedCount).toBe(2);
      expect(result.current.passwordChecks[0].pass).toBe(true); // length
      expect(result.current.passwordChecks[2].pass).toBe(true); // lowercase
      expect(result.current.strengthLabel).toBe('Weak');
      expect(result.current.strengthPercent).toBe(40);
    });

    it('calculates password checks (2/5: length + uppercase)', () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'password', value: 'ABCDEFGHIJ' } } as ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.passedCount).toBe(2);
      expect(result.current.strengthLabel).toBe('Weak');
      expect(result.current.strengthPercent).toBe(40);
    });

    it('calculates password checks (3/5: length + uppercase + lowercase)', () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'password', value: 'AbCdEfGhIj' } } as ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.passedCount).toBe(3);
      expect(result.current.strengthLabel).toBe('Okay');
      expect(result.current.strengthPercent).toBe(60);
    });

    it('calculates password checks (4/5: length + upper + lower + number)', () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'password', value: 'AbCdEfGhi1' } } as ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.passedCount).toBe(4);
      expect(result.current.strengthLabel).toBe('Strong');
      expect(result.current.strengthPercent).toBe(80);
    });

    it('calculates password checks (5/5: all checks pass)', () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'password', value: 'AbCdEfGhi1!' } } as ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.passedCount).toBe(5);
      expect(result.current.strengthLabel).toBe('Excellent');
      expect(result.current.strengthPercent).toBe(100);
    });

    it('updates password checks when password field changes', () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'password', value: '' } } as ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.passedCount).toBe(0);

      act(() => {
        result.current.handleChange({ target: { name: 'password', value: 'TestPass123!' } } as ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.passedCount).toBe(5);
    });
  });

  describe('Form Validation - Individual Fields', () => {
    it('requires first name (empty)', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: '' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors).toContain('First name is required.');
    });

    it('requires first name (whitespace only)', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: '   ' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors).toContain('First name is required.');
    });

    it('rejects first name exceeding max length', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'a'.repeat(256) } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'test@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors.some((e) => e.includes('First name must be at most'))).toBe(true);
    });

    it('rejects first name with invalid characters', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John<script>' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'test@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors.some((e) => e.includes('cannot contain'))).toBe(true);
    });

    it('requires last name (empty)', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'lastName', value: '' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors).toContain('Last name is required.');
    });

    it('rejects last name exceeding max length', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'a'.repeat(256) } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'test@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors.some((e) => e.includes('Last name must be at most'))).toBe(true);
    });

    it('rejects last name with invalid characters', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe@#$' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'test@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors.some((e) => e.includes('cannot contain'))).toBe(true);
    });

    it('requires email', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'email', value: '' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors).toContain('Email is required.');
    });

    it('rejects invalid email format', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'not-an-email' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors).toContain('Enter a valid email address.');
    });

    it('rejects password shorter than 10 characters', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'test@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Short1!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Short1!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors).toContain('Password must be at least 10 characters.');
    });

    it('rejects password without uppercase letter', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'test@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors.some((e) => e.includes('uppercase, lowercase, number, and symbol'))).toBe(true);
    });

    it('rejects password without lowercase letter', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'test@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'ABCDEF1234!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'ABCDEF1234!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors.some((e) => e.includes('uppercase, lowercase, number, and symbol'))).toBe(true);
    });

    it('rejects password without number', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'test@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'AbCdEfGhIj!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'AbCdEfGhIj!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors.some((e) => e.includes('uppercase, lowercase, number, and symbol'))).toBe(true);
    });

    it('rejects password without symbol', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'test@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'AbCdEfGhIj1' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'AbCdEfGhIj1' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors.some((e) => e.includes('uppercase, lowercase, number, and symbol'))).toBe(true);
    });

    it('rejects mismatched passwords', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'John' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'test@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Secure123!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Different456@' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors).toContain('Passwords do not match.');
    });
  });

  describe('Multiple Validation Errors', () => {
    it('surfaces all validation issues at once', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.errors.length).toBeGreaterThan(0);
      expect(result.current.errors).toContain('First name is required.');
      expect(result.current.errors).toContain('Last name is required.');
      expect(result.current.errors).toContain('Email is required.');
    });

    it('blocks mutation when validation fails', async () => {
      const { result } = renderHook(() => useRegisterPageState());

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(mutateAsyncMock).not.toHaveBeenCalled();
    });
  });

  describe('Successful Submission', () => {
    it('submits trimmed and lowercased payload and redirects to verify-email on success', async () => {
      mutateAsyncMock.mockResolvedValue({});
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: '  Jane  ' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: '  Doe  ' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: '  STUDENT@EXAMPLE.COM  ' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(mutateAsyncMock).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'student@example.com',
        password: 'Abcdef1234!',
      });
      expect(navigateMock).toHaveBeenCalledWith('/verify-email', {
        replace: true,
        state: { email: 'student@example.com' },
      });
    });

    it('clears errors on successful submission', async () => {
      mutateAsyncMock.mockResolvedValue({});
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'Jane' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'student@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.errors).toEqual([]);
    });
  });

  describe('API Error Handling', () => {
    it('prefers ApiError details when available', async () => {
      mutateAsyncMock.mockRejectedValue(
        new ApiError({
          message: 'Validation failed',
          status: 422,
          code: 'UNPROCESSABLE_ENTITY',
          data: { message: ['ignored fallback'] },
          details: [{ message: 'Email already exists.' }],
        }),
      );

      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'Jane' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'student@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      await waitFor(() => {
        expect(result.current.errors).toEqual(['Email already exists.']);
        expect(result.current.error).toBeNull();
      });
    });

    it('falls back to data.message array when details unavailable', async () => {
      mutateAsyncMock.mockRejectedValue(
        new ApiError({
          message: 'Validation failed',
          status: 422,
          code: 'UNPROCESSABLE_ENTITY',
          data: { message: ['Field validation failed', 'Another error'] },
        }),
      );

      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'Jane' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'student@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      await waitFor(() => {
        expect(result.current.errors).toEqual(['Field validation failed', 'Another error']);
      });
    });

    it('falls back to data.message string when details unavailable', async () => {
      mutateAsyncMock.mockRejectedValue(
        new ApiError({
          message: 'Validation failed',
          status: 422,
          code: 'UNPROCESSABLE_ENTITY',
          data: { message: 'Single validation error' },
        }),
      );

      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'Jane' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'student@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      await waitFor(() => {
        expect(result.current.errors).toEqual(['Single validation error']);
      });
    });

    it('uses display error message when ApiError has no server messages', async () => {
      mutateAsyncMock.mockRejectedValue(
        new ApiError({
          message: 'Generic error',
          status: 500,
          code: 'INTERNAL_SERVER_ERROR',
          data: {},
        }),
      );

      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'Jane' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'student@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      await waitFor(() => {
        // Should have an error string, not empty
        expect(result.current.error).toBeTruthy();
        expect(result.current.errors).toEqual([]);
      });
    });

    it('handles non-ApiError exceptions with generic message', async () => {
      mutateAsyncMock.mockRejectedValue(new Error('Network failed'));

      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'Jane' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'student@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Something went wrong. Please try again.');
      });
    });
  });

  describe('Show Meter State', () => {
    it('initializes showMeter as false', () => {
      const { result } = renderHook(() => useRegisterPageState());

      expect(result.current.showMeter).toBe(false);
    });

    it('allows toggling showMeter state', () => {
      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.setShowMeter(true);
      });
      expect(result.current.showMeter).toBe(true);

      act(() => {
        result.current.setShowMeter(false);
      });
      expect(result.current.showMeter).toBe(false);
    });
  });

  describe('Error State Management', () => {
    it('clears error and errors on new submission', async () => {
      mutateAsyncMock.mockRejectedValueOnce(new Error('First error'));
      mutateAsyncMock.mockResolvedValueOnce({});

      const { result } = renderHook(() => useRegisterPageState());

      act(() => {
        result.current.handleChange({ target: { name: 'firstName', value: 'Jane' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'email', value: 'student@example.com' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'password', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
        result.current.handleChange({ target: { name: 'confirmPassword', value: 'Abcdef1234!' } } as ChangeEvent<HTMLInputElement>);
      });

      // First submission fails
      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Second submission should clear the previous error
      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.errors).toEqual([]);
    });
  });

  describe('Return Value Structure', () => {
    it('returns all expected properties and methods', () => {
      const { result } = renderHook(() => useRegisterPageState());

      expect(result.current).toHaveProperty('form');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('errors');
      expect(result.current).toHaveProperty('showMeter');
      expect(result.current).toHaveProperty('setShowMeter');
      expect(result.current).toHaveProperty('passwordChecks');
      expect(result.current).toHaveProperty('passedCount');
      expect(result.current).toHaveProperty('strengthPercent');
      expect(result.current).toHaveProperty('strengthLabel');
      expect(result.current).toHaveProperty('isSubmitting');
      expect(result.current).toHaveProperty('handleChange');
      expect(result.current).toHaveProperty('handleSubmit');
    });
  });
});
