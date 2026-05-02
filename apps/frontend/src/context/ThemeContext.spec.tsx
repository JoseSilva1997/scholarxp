// Verifies ThemeProvider migrates legacy theme ids and keeps user-toggled variants from being overwritten.
import { act, render, screen } from '@testing-library/react';
import type { AuthUser } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/context/AuthContext';
import { CosmeticThemeSync } from '@/context/CosmeticThemeSync';
import { ThemeProvider } from '@/context/ThemeContext';
import { useTheme } from '@/context/useTheme';
import { useCosmetics } from '@/Rewards/cosmetics';

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/Rewards/cosmetics', () => ({
  useCosmetics: vi.fn(),
}));

function ThemeProbe() {
  const {
    theme,
    themeVariant,
    toggleTheme,
    resetTheme,
    syncThemeReward,
  } = useTheme();

  return (
    <>
      <div data-testid="theme-family">{theme}</div>
      <div data-testid="theme-variant">{themeVariant}</div>
      <button type="button" onClick={toggleTheme}>
        toggle
      </button>
      <button type="button" onClick={() => syncThemeReward('ember')}>
        sync-ember
      </button>
      <button type="button" onClick={resetTheme}>
        reset
      </button>
    </>
  );
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

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-family');
    document.documentElement.removeAttribute('data-theme-variant');
  });

  it('migrates legacy storage values into family plus variant selectors', () => {
    localStorage.setItem('scholarxp:theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-family')).toHaveTextContent('default');
    expect(screen.getByTestId('theme-variant')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'default-dark');
    expect(document.documentElement).toHaveAttribute('data-theme-family', 'default');
    expect(document.documentElement).toHaveAttribute('data-theme-variant', 'dark');
    expect(localStorage.getItem('scholarxp:theme')).toBe('default');
    expect(localStorage.getItem('scholarxp:theme-variant')).toBe('dark');
  });

  it('preserves an explicitly toggled variant when cosmetic sync changes the family', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByRole('button', { name: 'toggle' }).click();
    });
    act(() => {
      screen.getByRole('button', { name: 'sync-ember' }).click();
    });

    expect(screen.getByTestId('theme-family')).toHaveTextContent('ember');
    expect(screen.getByTestId('theme-variant')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'ember-dark');
  });

  it('resets to the default theme and clears persisted user-specific state', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByRole('button', { name: 'toggle' }).click();
    });
    act(() => {
      screen.getByRole('button', { name: 'sync-ember' }).click();
    });
    act(() => {
      screen.getByRole('button', { name: 'reset' }).click();
    });

    expect(screen.getByTestId('theme-family')).toHaveTextContent('default');
    expect(screen.getByTestId('theme-variant')).toHaveTextContent('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'default-light');
    expect(localStorage.getItem('scholarxp:theme')).toBe('default');
    expect(localStorage.getItem('scholarxp:theme-variant')).toBe('light');
  });

  it('allows non-student accounts to toggle the default theme after sync resets prior user state', () => {
    stubAuth({ ...buildStudent(), globalRole: 'teacher', avatar: null });
    stubCosmetics('ember');

    render(
      <ThemeProvider>
        <CosmeticThemeSync />
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-family')).toHaveTextContent('default');
    expect(screen.getByTestId('theme-variant')).toHaveTextContent('light');

    act(() => {
      screen.getByRole('button', { name: 'toggle' }).click();
    });

    expect(screen.getByTestId('theme-family')).toHaveTextContent('default');
    expect(screen.getByTestId('theme-variant')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'default-dark');
  });
});
