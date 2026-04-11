/**
 * Manages the active theme id and applies it via the `data-theme` attribute on <html>.
 * Keeps localStorage as the baseline source so anonymous and tutor users retain their preference across reloads;
 * the CosmeticThemeSync bridge is what pushes server-backed student cosmetics into this state when authenticated.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ThemeContext,
  THEME_IDS,
  THEME_STORAGE_KEY,
  isDarkFamily,
  type Theme,
} from './theme-context';

function isKnownTheme(value: string | null): value is Theme {
  return value !== null && (THEME_IDS as readonly string[]).includes(value);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isKnownTheme(stored) ? stored : 'light';
  });

  // Apply theme to <html> and persist to localStorage so subsequent loads hydrate without flashing the default.
  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Toggle remains a light/dark binary so the header button stays a simple one-tap affordance;
  // more exotic theme picks come through the Rewards page via setTheme directly.
  const toggleTheme = useCallback(() => {
    setThemeState((current) => (isDarkFamily(current) ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme: (isDarkFamily(theme) ? 'dark' : 'light') as 'light' | 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
