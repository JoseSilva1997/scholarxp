// Verifies role selector mutation flow, error handling, pending state, and accessibility.
// Tests branch coverage for both role selections, mutations, error states, and UI disabled conditions.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoleSelectorOverlay from './RoleSelectorOverlay';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  logError: vi.fn(),
}));

let pending = false;

vi.mock('../hooks/queries/useUserMutations', () => ({
  useUpdateUserRoleMutation: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: pending,
  }),
}));

vi.mock('../utils/logger', () => ({
  logError: mocks.logError,
}));

describe('RoleSelectorOverlay', () => {
  const baseUser = {
    id: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    profilePictureUrl: '',
    globalRole: 'pending' as const,
    isVerified: true,
    timezone: 'UTC',
  };

  beforeEach(() => {
    pending = false;
    mocks.mutateAsync.mockReset();
    mocks.logError.mockReset();
  });

  describe('Role selection - student role', () => {
    it('saves student role and calls onRoleSelected', async () => {
      const onRoleSelected = vi.fn();
      const updatedUser = { ...baseUser, globalRole: 'student' as const };
      mocks.mutateAsync.mockResolvedValue(updatedUser);

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={onRoleSelected} />);

      const studentButton = screen.getByRole('button', { name: /I.m a student/ });
      fireEvent.click(studentButton);

      await waitFor(() => {
        expect(mocks.mutateAsync).toHaveBeenCalledWith({
          userId: 1,
          globalRole: 'student',
        });
        expect(onRoleSelected).toHaveBeenCalledWith(updatedUser);
      });
    });

    it('passes correct student role to mutateAsync', async () => {
      mocks.mutateAsync.mockResolvedValue({ ...baseUser, globalRole: 'student' });

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /I.m a student/ }));

      await waitFor(() => {
        expect(mocks.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ globalRole: 'student' }),
        );
      });
    });
  });

  describe('Role selection - teacher role', () => {
    it('saves teacher role and calls onRoleSelected', async () => {
      const onRoleSelected = vi.fn();
      const updatedUser = { ...baseUser, globalRole: 'teacher' as const };
      mocks.mutateAsync.mockResolvedValue(updatedUser);

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={onRoleSelected} />);

      fireEvent.click(screen.getByRole('button', { name: /I.m a teacher/ }));

      await waitFor(() => {
        expect(mocks.mutateAsync).toHaveBeenCalledWith({
          userId: 1,
          globalRole: 'teacher',
        });
        expect(onRoleSelected).toHaveBeenCalledWith(updatedUser);
      });
    });

    it('passes correct teacher role to mutateAsync', async () => {
      mocks.mutateAsync.mockResolvedValue({ ...baseUser, globalRole: 'teacher' });

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /I.m a teacher/ }));

      await waitFor(() => {
        expect(mocks.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ globalRole: 'teacher' }),
        );
      });
    });
  });

  describe('Pending state - idempotency', () => {
    it('does not call mutateAsync if already pending on student click', async () => {
      pending = true;
      mocks.mutateAsync.mockResolvedValue({ ...baseUser, globalRole: 'student' });

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getAllByRole('button', { name: 'Saving…' })[0]);

      expect(mocks.mutateAsync).not.toHaveBeenCalled();
    });

    it('does not call mutateAsync if already pending on teacher click', async () => {
      pending = true;
      mocks.mutateAsync.mockResolvedValue({ ...baseUser, globalRole: 'teacher' });

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getAllByRole('button', { name: 'Saving…' })[1]);

      expect(mocks.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('Button disabled state', () => {
    it('disables student button when pending', () => {
      pending = true;

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      const studentButton = screen.getAllByRole('button', { name: 'Saving…' })[0];
      expect(studentButton).toBeDisabled();
    });

    it('disables teacher button when pending', () => {
      pending = true;

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      const buttons = screen.getAllByRole('button', { name: 'Saving…' });
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });

    it('enables buttons when not pending', () => {
      pending = false;

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      expect(screen.getByRole('button', { name: /I.m a student/ })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /I.m a teacher/ })).not.toBeDisabled();
    });
  });

  describe('Button label based on pending state', () => {
    it('shows student label when not pending', () => {
      pending = false;

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      expect(screen.getByRole('button', { name: /I.m a student/ })).toBeInTheDocument();
    });

    it('shows saving label on buttons when pending', () => {
      pending = true;

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      expect(screen.getAllByRole('button', { name: 'Saving…' })).toHaveLength(2);
    });

    it('shows teacher label when not pending', () => {
      pending = false;

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      expect(screen.getByRole('button', { name: /I.m a teacher/ })).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('shows error when role update fails', async () => {
      mocks.mutateAsync.mockRejectedValue(new Error('Network error'));

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /I.m a student/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'We could not save your role right now. Please try again.',
        );
      });
    });

    it('calls logError when mutation fails', async () => {
      const error = new Error('boom');
      mocks.mutateAsync.mockRejectedValue(error);

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /I.m a student/ }));

      await waitFor(() => {
        expect(mocks.logError).toHaveBeenCalledWith(error, {
          feature: 'role-selector',
          action: 'update-role',
        });
      });
    });

    it('does not show error alert when no error', () => {
      pending = false;

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('clears error when retrying after failure', async () => {
      mocks.mutateAsync
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({ ...baseUser, globalRole: 'student' });

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /I.m a student/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /I.m a student/ }));

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('shows error for both student and teacher role failures', async () => {
      mocks.mutateAsync.mockRejectedValue(new Error('failed'));

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /I.m a teacher/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'We could not save your role right now. Please try again.',
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('renders backdrop with dialog role', () => {
      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('sets aria-modal="true" on dialog', () => {
      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('sets aria-labelledby to title id', () => {
      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'role-title');

      const titleElement = screen.getByText('Choose your role to continue');
      expect(titleElement).toHaveAttribute('id', 'role-title');
    });

    it('marks error message with role="alert"', async () => {
      mocks.mutateAsync.mockRejectedValue(new Error('error'));

      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /I.m a student/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('UI content and copy', () => {
    it('displays welcome message with user first name', () => {
      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      expect(screen.getByText('Welcome, Jane')).toBeInTheDocument();
    });

    it('displays welcome message with different user names', () => {
      const differentUser = { ...baseUser, firstName: 'Alice' };
      render(<RoleSelectorOverlay user={differentUser} onRoleSelected={vi.fn()} />);

      expect(screen.getByText('Welcome, Alice')).toBeInTheDocument();
    });

    it('displays title', () => {
      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      expect(screen.getByText('Choose your role to continue')).toBeInTheDocument();
    });

    it('displays instructions', () => {
      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      expect(screen.getByText(/best matches how you will use ScholarXP/)).toBeInTheDocument();
    });

    it('displays both role buttons', () => {
      render(<RoleSelectorOverlay user={baseUser} onRoleSelected={vi.fn()} />);

      expect(screen.getByRole('button', { name: /I.m a student/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /I.m a teacher/ })).toBeInTheDocument();
    });
  });

  describe('Mutation calls with user context', () => {
    it('includes correct user ID in mutation payload', async () => {
      const userWithId = { ...baseUser, id: 42 };
      mocks.mutateAsync.mockResolvedValue(userWithId);

      render(<RoleSelectorOverlay user={userWithId} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /I.m a student/ }));

      await waitFor(() => {
        expect(mocks.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 42 }),
        );
      });
    });

    it('passes correct user ID for teacher role', async () => {
      const userWithId = { ...baseUser, id: 999 };
      mocks.mutateAsync.mockResolvedValue(userWithId);

      render(<RoleSelectorOverlay user={userWithId} onRoleSelected={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /I.m a teacher/ }));

      await waitFor(() => {
        expect(mocks.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 999 }),
        );
      });
    });
  });
});
