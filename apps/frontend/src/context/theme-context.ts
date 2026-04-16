/**
 * Central theme context primitives shared across provider and hook files.
 * Split out so component files can stay component-only for React Fast Refresh linting.
 */
import { createContext } from 'react';

// Reward ids mirror the progression package so cosmetic sync can ingest the backend payload verbatim.
export const THEME_REWARD_IDS = [
  'light',
  'dark',
  'aurora',
  'midnight',
  'ember',
  'celestial',
] as const;

export type ThemeRewardId = (typeof THEME_REWARD_IDS)[number];

// Theme families are the persistent cosmetic choice shown in the profile and rewards UI.
export const THEME_IDS = [
  'default',
  'aurora',
  'midnight',
  'ember',
  'celestial',
] as const;

export type Theme = (typeof THEME_IDS)[number];

export const THEME_VARIANTS = [
  'light',
  'dark',
] as const;

export type ThemeVariant = (typeof THEME_VARIANTS)[number];

const DEFAULT_VARIANT_BY_THEME: Record<Theme, ThemeVariant> = {
  default: 'light',
  aurora: 'light',
  midnight: 'dark',
  ember: 'dark',
  celestial: 'dark',
};

export function isKnownTheme(value: string | null): value is Theme {
  return value !== null && (THEME_IDS as readonly string[]).includes(value);
}

export function isKnownThemeVariant(value: string | null): value is ThemeVariant {
  return value !== null && (THEME_VARIANTS as readonly string[]).includes(value);
}

export function isKnownThemeRewardId(value: string | null): value is ThemeRewardId {
  return value !== null && (THEME_REWARD_IDS as readonly string[]).includes(value);
}

export function themeFamilyFromRewardId(themeRewardId: ThemeRewardId): Theme {
  if (themeRewardId === 'light' || themeRewardId === 'dark') {
    return 'default';
  }
  return themeRewardId;
}

export function themeVariantFromRewardId(themeRewardId: ThemeRewardId): ThemeVariant {
  if (themeRewardId === 'light' || themeRewardId === 'dark') {
    return themeRewardId;
  }
  return DEFAULT_VARIANT_BY_THEME[themeRewardId];
}

export type ThemeContextValue = {
  theme: Theme;
  themeVariant: ThemeVariant;
  // Components that need a binary light/dark branch depend on the explicit variant, not OS preference.
  resolvedTheme: ThemeVariant;
  setTheme: (theme: Theme) => void;
  setThemeVariant: (variant: ThemeVariant) => void;
  syncThemeReward: (themeRewardId: ThemeRewardId) => void;
  toggleTheme: () => void;
};

export const THEME_STORAGE_KEY = 'scholarxp:theme';
export const THEME_VARIANT_STORAGE_KEY = 'scholarxp:theme-variant';
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
