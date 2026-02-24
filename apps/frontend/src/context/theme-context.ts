/**
 * Central theme context primitives shared across provider and hook files.
 * Split out so component files can stay component-only for React Fast Refresh linting.
 */
import { createContext } from 'react';

export type Theme = 'light' | 'dark';

export type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const THEME_STORAGE_KEY = 'scholarxp:theme';
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
