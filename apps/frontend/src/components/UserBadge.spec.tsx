// Verifies user badge menu behavior and profile navigation/logout actions.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import UserBadge from './UserBadge';
import type { AuthUser } from '../types/auth';

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
    render(<UserBadge user={user} level={5} exp={{ current: 50, max: 100 }} />);

    // Initial XP state is set after first rAF.
    await vi.advanceTimersByTimeAsync(1);

    expect(screen.getByText(/Level/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('50 xp')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('does not render progress for non-student users', () => {
    render(<UserBadge user={adminUser} />);

    expect(screen.queryByText(/Level/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/xp/i)).not.toBeInTheDocument();
  });

  it('triggers level-up animation when level increases', async () => {
    const { rerender } = render(<UserBadge user={user} level={1} exp={{ current: 0, max: 100 }} />);
    
    // Process initial set
    await vi.advanceTimersByTimeAsync(1);

    // Trigger level up
    rerender(<UserBadge user={user} level={2} exp={{ current: 10, max: 100 }} />);
    
    // Advance time for the total exp animation to complete and trigger the check
    await vi.advanceTimersByTimeAsync(1000); 

    // Level-up text should appear. Use queryAllByText because AnimatePresence might have multiple during transition.
    expect(screen.queryAllByText('Level Up!').length).toBeGreaterThan(0);
    
    // Wait for animation cycle to finish
    await vi.advanceTimersByTimeAsync(3000);
    expect(screen.queryAllByText('Level Up!')).toHaveLength(0);
  });

  it('shows and clears exp gain indicator when exp increases', async () => {
    const { rerender } = render(<UserBadge user={user} level={5} exp={{ current: 20, max: 100 }} />);

    // Run enough fake time for the initial rAF sync so the next update is treated as a gain event.
    await vi.advanceTimersByTimeAsync(20);

    rerender(<UserBadge user={user} level={5} exp={{ current: 60, max: 100 }} />);
    await vi.advanceTimersByTimeAsync(20);

    expect(screen.getByText('+40')).toBeInTheDocument();
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
    render(<UserBadge user={user} level={2} exp={{ current: 10, max: 100 }} />);

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
