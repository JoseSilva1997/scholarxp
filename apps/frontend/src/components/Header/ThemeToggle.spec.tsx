// Unit tests for ThemeToggle verify explicit light/dark variant switching without changing the theme family.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../../context/useTheme';

vi.mock('../../context/useTheme', () => ({
  useTheme: vi.fn(),
}));

describe('ThemeToggle', () => {
  const mockSetTheme = vi.fn();
  const mockSetThemeVariant = vi.fn();
  const mockSyncThemeReward = vi.fn();
  const mockResetTheme = vi.fn();
  const mockToggleTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the light-mode affordance when resolvedTheme is light', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'default',
      themeVariant: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      setThemeVariant: mockSetThemeVariant,
      syncThemeReward: mockSyncThemeReward,
      resetTheme: mockResetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button');

    expect(button).toHaveAttribute('aria-label', 'Switch theme variant (currently Light variant)');
    expect(button).toHaveAttribute('title', 'Light variant');
  });

  it('renders the dark-mode affordance when resolvedTheme is dark', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'aurora',
      themeVariant: 'dark',
      resolvedTheme: 'dark',
      setTheme: mockSetTheme,
      setThemeVariant: mockSetThemeVariant,
      syncThemeReward: mockSyncThemeReward,
      resetTheme: mockResetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button');

    expect(button).toHaveAttribute('aria-label', 'Switch theme variant (currently Dark variant)');
    expect(button).toHaveAttribute('title', 'Dark variant');
  });

  it('delegates clicks to the explicit toggleTheme action', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'midnight',
      themeVariant: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      setThemeVariant: mockSetThemeVariant,
      syncThemeReward: mockSyncThemeReward,
      resetTheme: mockResetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(mockSetThemeVariant).not.toHaveBeenCalled();
    expect(mockSyncThemeReward).not.toHaveBeenCalled();
    expect(mockResetTheme).not.toHaveBeenCalled();
  });
});
