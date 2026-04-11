// Unit tests for ThemeToggle verify theme-switching transitions, icon rendering, and student-only cosmetic writes.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuthUser } from '@scholarxp/api-contracts';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../../context/useTheme';
import { useAuth } from '../../context/AuthContext';
import { useCosmetics } from '@/rewards';

vi.mock('../../context/useTheme', () => ({
  useTheme: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/rewards', () => ({
  useCosmetics: vi.fn(),
}));

describe('ThemeToggle', () => {
  const mockSetTheme = vi.fn();
  const mockToggleTheme = vi.fn();
  const mockEquipCosmetic = vi.fn();

  function stubCosmetics() {
    vi.mocked(useCosmetics).mockReturnValue({
      equipped: {} as never,
      cosmetic: () => 'light',
      level: 1,
      equipCosmetic: mockEquipCosmetic,
      isEquipping: false,
    });
  }

  function stubAuth(user: AuthUser | null) {
    vi.mocked(useAuth).mockReturnValue({
      user,
      setUser: vi.fn(),
      applyStudentExpReward: vi.fn(),
      refreshUser: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
    });
  }

  function buildStudent(): AuthUser {
    return {
      id: 1,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      profilePictureUrl: 'https://example.com/ada.png',
      globalRole: 'student',
      isVerified: true,
      timezone: 'UTC',
      avatar: {
        id: 1,
        totalExp: 500,
        level: 10,
        currentLevelExp: 100,
        nextLevelExpRequired: 200,
        xpToNextLevel: 100,
        progressPercent: 50,
        equippedCosmetics: {},
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockEquipCosmetic.mockResolvedValue(undefined);
    stubAuth(null);
    stubCosmetics();
  });

  it('renders the light-mode affordance when resolvedTheme is light', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button');

    expect(button).toHaveAttribute('aria-label', 'Switch theme (currently Light theme)');
    expect(button).toHaveAttribute('title', 'Light theme');
  });

  it('renders the dark-mode affordance when resolvedTheme is dark', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'midnight',
      resolvedTheme: 'dark',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button');

    // Dark-family themes (midnight, ember, celestial) all surface as "Dark theme" in the label
    // because the toggle collapses them into the same visual bucket.
    expect(button).toHaveAttribute('aria-label', 'Switch theme (currently Dark theme)');
    expect(button).toHaveAttribute('title', 'Dark theme');
  });

  it('switches light → dark locally for anonymous users without firing the cosmetic mutation', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(mockEquipCosmetic).not.toHaveBeenCalled();
  });

  it('switches dark → light locally for anonymous users', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockSetTheme).toHaveBeenCalledWith('light');
    expect(mockEquipCosmetic).not.toHaveBeenCalled();
  });

  it('also fires the cosmetic equip mutation for authenticated students', () => {
    stubAuth(buildStudent());
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));

    // Local theme update keeps the UI immediate; the equip mutation persists the selection cross-device.
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(mockEquipCosmetic).toHaveBeenCalledWith('theme', 'dark');
  });

  it('does not fire the cosmetic mutation for teachers', () => {
    const teacher = { ...buildStudent(), globalRole: 'teacher' as const, avatar: null };
    stubAuth(teacher);
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(mockEquipCosmetic).not.toHaveBeenCalled();
  });
});
