// Verifies user badge menu behavior and profile navigation/logout actions.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserBadge from './UserBadge';
import type { AuthUser } from '../types/auth';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('UserBadge', () => {
  const user: AuthUser = {
    id: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@x.com',
    globalRole: 'student' as const,
    isVerified: true,
    // Keep fixture aligned with shared AuthUser contract so tests also validate real prop expectations.
    avatar: { id: 101, level: 2, currentExp: 30 },
    profilePictureUrl: '',
  };

  beforeEach(() => {
    navigateMock.mockReset();
  });

  const getAvatarMenuButton = () =>
    document.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');

  it('opens menu and navigates from action buttons', () => {
    render(<UserBadge user={user} level={2} exp={{ current: 10, max: 100 }} />);

    fireEvent.click(getAvatarMenuButton()!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'My content' }));

    expect(navigateMock).toHaveBeenCalledWith('/main');
  });

  it('calls onLogout from menu action', async () => {
    const onLogout = vi.fn().mockResolvedValue(undefined);
    render(<UserBadge user={user} onLogout={onLogout} />);

    fireEvent.click(getAvatarMenuButton()!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });
});
