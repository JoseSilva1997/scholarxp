// Verifies role selector mutation flow and error fallback behavior.
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
  beforeEach(() => {
    pending = false;
    mocks.mutateAsync.mockReset();
    mocks.logError.mockReset();
  });

  it('saves selected role and calls onRoleSelected', async () => {
    const onRoleSelected = vi.fn();
    mocks.mutateAsync.mockResolvedValue({ id: 1, firstName: 'Jane' });

    render(<RoleSelectorOverlay user={{ id: 1, firstName: 'Jane', lastName: 'D', email: 'j@d.com', globalRole: 'pending', isVerified: true }} onRoleSelected={onRoleSelected} />);

    fireEvent.click(screen.getByRole('button', { name: 'I’m a student' }));

    await waitFor(() => expect(onRoleSelected).toHaveBeenCalled());
  });

  it('shows fallback error when role update fails', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('boom'));

    render(<RoleSelectorOverlay user={{ id: 1, firstName: 'Jane', lastName: 'D', email: 'j@d.com', globalRole: 'pending', isVerified: true }} onRoleSelected={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'I’m a teacher' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('We could not save your role right now. Please try again.');
    });
  });
});
