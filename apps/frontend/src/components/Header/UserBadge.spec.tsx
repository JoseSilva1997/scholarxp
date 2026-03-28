// Verifies user badge menu behavior and profile navigation/logout actions.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import UserBadge from './UserBadge';
import type { AuthUser } from '../../types/auth';

const navigateMock = vi.fn();

// Mock motion/react to prevent animation delays causing test failures
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

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
    profilePictureUrl: '',
    avatar: {
      id: 1,
      totalExp: 850,
      level: 5,
      currentLevelExp: 50,
      nextLevelExpRequired: 318,
      xpToNextLevel: 268,
      progressPercent: 15.72,
    },
  };

  const adminUser: AuthUser = {
    ...user,
    globalRole: 'admin' as const,
  };

  beforeEach(() => {
    navigateMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders student progress correctly', async () => {
    render(<UserBadge user={user} />);

    // Initial XP state is set after first rAF.
    await vi.advanceTimersByTimeAsync(1);

    // Level label is gone — progress is now conveyed by the SVG arc progressbar.
    expect(screen.getByRole('progressbar', { name: 'XP progress to next level' })).toBeInTheDocument();
    // Level number lives in the aria-hidden ring badge overlay; query with hidden:true to reach it.
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('does not render progress for non-student users', () => {
    render(<UserBadge user={adminUser} />);

    expect(screen.queryByText(/Level/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/xp/i)).not.toBeInTheDocument();
  });

  it('triggers level-up animation when level increases', async () => {
    const levelTwoUser: AuthUser = {
      ...user,
      avatar: {
        ...(user.avatar as NonNullable<AuthUser['avatar']>),
        totalExp: 100,
      },
    };
    const { rerender } = render(<UserBadge user={levelTwoUser} />);
    
    // Process initial set
    await vi.advanceTimersByTimeAsync(1);

    // Trigger level up
    const levelThreeUser: AuthUser = {
      ...user,
      avatar: {
        ...(user.avatar as NonNullable<AuthUser['avatar']>),
        totalExp: 300,
      },
    };
    rerender(<UserBadge user={levelThreeUser} />);
    
    // totalExp=100 is exactly at level 2 start (progressPercent=0%), so fillToDuration=1200ms
    // plus the 200ms settling buffer means setIsLevelingUp fires at ~1400ms.
    await vi.advanceTimersByTimeAsync(1500);

    // Verify the user-visible behavior that matters: level-up state is triggered on level increase.
    // We avoid asserting exact teardown timing because animation/rAF scheduling is intentionally implementation-specific.
    expect(screen.queryAllByText('Level Up!').length).toBeGreaterThan(0);
  });

  it('does not trigger level-up animation when exp increases within the same level', async () => {
    const startingUser: AuthUser = {
      ...user,
      avatar: {
        ...(user.avatar as NonNullable<AuthUser['avatar']>),
        totalExp: 100,
      },
    };
    const { rerender } = render(<UserBadge user={startingUser} />);

    // Process initial set
    await vi.advanceTimersByTimeAsync(1);

    const sameLevelExpGainUser: AuthUser = {
      ...user,
      avatar: {
        ...(user.avatar as NonNullable<AuthUser['avatar']>),
        totalExp: 125,
      },
    };
    rerender(<UserBadge user={sameLevelExpGainUser} />);

    // Allow XP animation and queued frame callbacks to settle.
    await vi.advanceTimersByTimeAsync(1200);

    expect(screen.queryByText('Level Up!')).not.toBeInTheDocument();
  });

  it('shows and clears exp gain indicator when exp increases', async () => {
    const startingUser: AuthUser = {
      ...user,
      avatar: {
        ...(user.avatar as NonNullable<AuthUser['avatar']>),
        totalExp: 850,
      },
    };
    const { rerender } = render(<UserBadge user={startingUser} />);

    // Run enough fake time for the initial rAF sync so the next update is treated as a gain event.
    await vi.advanceTimersByTimeAsync(20);

    const updatedUser: AuthUser = {
      ...user,
      avatar: {
        ...(user.avatar as NonNullable<AuthUser['avatar']>),
        totalExp: 890,
      },
    };
    rerender(<UserBadge user={updatedUser} />);
    await vi.advanceTimersByTimeAsync(20);

    expect(screen.getByText('+40 XP')).toBeInTheDocument();
  });

  it('handles avatar image load errors by falling back to default', () => {
    render(<UserBadge user={{ ...user, profilePictureUrl: 'https://bad-link.com/img.jpg' }} />);
    
    const avatarImg = screen.getByRole('button', { name: /toggle user menu/i }).querySelector('img');
    
    expect(avatarImg).toHaveAttribute('src', 'https://bad-link.com/img.jpg');

    // Manually trigger error
    fireEvent.error(avatarImg!);

    // Should now point to the default avatar
    expect(avatarImg!.src).toContain('default-profile-pic.png');
  });

  it('closes menu when clicking outside', async () => {
    render(<UserBadge user={user} />);

    fireEvent.click(screen.getByRole('button', { name: /toggle user menu/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Click on something else
    fireEvent.mouseDown(document.body);
    
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens menu and navigates from action buttons', () => {
    render(<UserBadge user={user} />);

    fireEvent.click(screen.getByRole('button', { name: /toggle user menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'My content' }));

    expect(navigateMock).toHaveBeenCalledWith('/main');
  });

  it('calls onLogout from menu action', async () => {
    // Disable fake timers for this test to avoid waitFor timeouts
    vi.useRealTimers();
    const onLogout = vi.fn().mockResolvedValue(undefined);
    render(<UserBadge user={user} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole('button', { name: /toggle user menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });
});
