/**
 * Central theme context primitives shared across provider and hook files.
 * Split out so component files can stay component-only for React Fast Refresh linting.
 */
import { createContext } from 'react';

// Theme ids match the cosmetic catalog ids in @scholarxp/progression so the rewards system can write
// a cosmetic id directly into setTheme without translation.
export const THEME_IDS = [
  'light',
  'dark',
  'aurora',
  'midnight',
  'ember',
  'celestial',
] as const;

export type Theme = (typeof THEME_IDS)[number];

// Themes that visually read as "dark mode" for components that need a binary light/dark branch
// (e.g. swapping between a light-background SVG and a dark-background SVG).
export const DARK_THEMES: readonly Theme[] = [
  'dark',
  'aurora',
  'midnight',
  'ember',
  'celestial',
];

export function isDarkFamily(theme: Theme): boolean {
  return DARK_THEMES.includes(theme);
}

export type ThemeContextValue = {
  theme: Theme;
  // Derived binary family — consumers that care about "is this visually dark?" use this rather than
  // comparing `theme` directly, so adding a new dark theme doesn't fan out branches across the app.
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const THEME_STORAGE_KEY = 'scholarxp:theme';
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
