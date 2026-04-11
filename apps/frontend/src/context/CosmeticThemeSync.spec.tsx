// Verifies CosmeticThemeSync pushes the student-equipped theme into ThemeProvider state and leaves non-students alone.
import { render } from '@testing-library/react';
import type { AuthUser } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from './AuthContext';
import { CosmeticThemeSync } from './CosmeticThemeSync';
import { useTheme } from './useTheme';
import { useCosmetics } from '@/rewards';

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./useTheme', () => ({
  useTheme: vi.fn(),
}));

vi.mock('@/rewards', () => ({
  useCosmetics: vi.fn(),
}));

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

function stubCosmetics(themeId: string) {
  vi.mocked(useCosmetics).mockReturnValue({
    equipped: {} as never,
    cosmetic: (slot: string) => (slot === 'theme' ? themeId : 'default'),
    level: 20,
    equipCosmetic: vi.fn(),
    isEquipping: false,
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
      totalExp: 2000,
      level: 20,
      currentLevelExp: 100,
      nextLevelExpRequired: 300,
      xpToNextLevel: 200,
      progressPercent: 33,
      equippedCosmetics: {},
    },
  };
}

describe('CosmeticThemeSync', () => {
  const setTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme,
      toggleTheme: vi.fn(),
    });
  });

  it('pushes the equipped theme into ThemeProvider for authenticated students', () => {
    stubAuth(buildStudent());
    stubCosmetics('aurora');

    render(<CosmeticThemeSync />);

    expect(setTheme).toHaveBeenCalledWith('aurora');
  });

  it('does not touch theme state for teachers', () => {
    stubAuth({ ...buildStudent(), globalRole: 'teacher', avatar: null });
    stubCosmetics('midnight');

    render(<CosmeticThemeSync />);

    expect(setTheme).not.toHaveBeenCalled();
  });

  it('does not touch theme state for anonymous users', () => {
    stubAuth(null);
    stubCosmetics('ember');

    render(<CosmeticThemeSync />);

    expect(setTheme).not.toHaveBeenCalled();
  });

  it('skips the update when the cosmetic theme already matches the current theme', () => {
    stubAuth(buildStudent());
    stubCosmetics('light');

    render(<CosmeticThemeSync />);

    // Same value — no redundant state updates so ThemeProvider's effect does not re-run unnecessarily.
    expect(setTheme).not.toHaveBeenCalled();
  });

  it('ignores unknown theme ids that might appear from a stale catalog', () => {
    stubAuth(buildStudent());
    stubCosmetics('not-a-real-theme');

    render(<CosmeticThemeSync />);

    expect(setTheme).not.toHaveBeenCalled();
  });
});
