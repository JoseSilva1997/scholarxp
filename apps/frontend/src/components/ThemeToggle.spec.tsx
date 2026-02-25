// Unit tests for ThemeToggle verify theme-switching transitions and icon rendering.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/useTheme';

// Mock the useTheme hook to control the theme state in tests.
vi.mock('../context/useTheme', () => ({
  useTheme: vi.fn(),
}));

describe('ThemeToggle', () => {
  const mockSetTheme = vi.fn();
  const mockToggleTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders light theme state correctly', () => {
    // Stage: hook returns light theme.
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    
    // Verify accessibility and labels.
    expect(button).toHaveAttribute('aria-label', 'Switch theme (currently Light theme)');
    expect(button).toHaveAttribute('title', 'Light theme');
    
    // Note: Icon rendering is verified by presence of the component without crashing,
    // as icons are third-party components (react-icons).
  });

  it('renders dark theme state correctly', () => {
    // Stage: hook returns dark theme.
    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    
    // Verify labels update for dark theme.
    expect(button).toHaveAttribute('aria-label', 'Switch theme (currently Dark theme)');
    expect(button).toHaveAttribute('title', 'Dark theme');
  });

  it('switches to dark when clicked in light theme', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    
    // Action: Toggle.
    fireEvent.click(button);
    
    // Assert: Transition directed to dark.
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('switches to light when clicked in dark theme', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    
    // Action: Toggle.
    fireEvent.click(button);
    
    // Assert: Transition directed to light.
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('defaults to light theme for unknown or system themes', () => {
    // Stage: theme is unexpected or 'system' (if added in future).
    vi.mocked(useTheme).mockReturnValue({
      // Intentionally cast an out-of-contract value to verify fallback behavior.
      theme: 'system' as unknown as ReturnType<typeof useTheme>['theme'],
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      toggleTheme: mockToggleTheme,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    
    // Verify fallback labels.
    expect(button).toHaveAttribute('title', 'Light theme');
    
    // Action: Toggle from unknown state.
    fireEvent.click(button);
    
    // Assert: Fallback to light state.
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});
