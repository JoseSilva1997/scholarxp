// Verifies CosmeticThemeSync forwards student theme rewards into ThemeProvider's family/variant migration path.
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
  const syncThemeReward = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTheme).mockReturnValue({
      theme: 'default',
      themeVariant: 'light',
      resolvedTheme: 'light',
      setTheme: vi.fn(),
      setThemeVariant: vi.fn(),
      syncThemeReward,
      toggleTheme: vi.fn(),
    });
  });

  it('pushes the equipped theme into ThemeProvider for authenticated students', () => {
    stubAuth(buildStudent());
    stubCosmetics('aurora');

    render(<CosmeticThemeSync />);

    expect(syncThemeReward).toHaveBeenCalledWith('aurora');
  });

  it('does not touch theme state for teachers', () => {
    stubAuth({ ...buildStudent(), globalRole: 'teacher', avatar: null });
    stubCosmetics('midnight');

    render(<CosmeticThemeSync />);

    expect(syncThemeReward).not.toHaveBeenCalled();
  });

  it('does not touch theme state for anonymous users', () => {
    stubAuth(null);
    stubCosmetics('ember');

    render(<CosmeticThemeSync />);

    expect(syncThemeReward).not.toHaveBeenCalled();
  });

  it('forwards legacy default ids so ThemeProvider can migrate them centrally', () => {
    stubAuth(buildStudent());
    stubCosmetics('dark');

    render(<CosmeticThemeSync />);

    expect(syncThemeReward).toHaveBeenCalledWith('dark');
  });

  it('ignores unknown theme ids that might appear from a stale catalog', () => {
    stubAuth(buildStudent());
    stubCosmetics('not-a-real-theme');

    render(<CosmeticThemeSync />);

    expect(syncThemeReward).not.toHaveBeenCalled();
  });
});
