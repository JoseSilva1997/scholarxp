// Verifies ThemeProvider migrates legacy theme ids and keeps user-toggled variants from being overwritten.
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from './ThemeContext';
import { useTheme } from './useTheme';

function ThemeProbe() {
  const {
    theme,
    themeVariant,
    toggleTheme,
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
    </>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
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
});
