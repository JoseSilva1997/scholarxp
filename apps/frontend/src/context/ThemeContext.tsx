/**
 * Manages the active theme family and light/dark variant on <html>.
 * Family syncs from the equipped cosmetic; the variant is an explicit local preference controlled by the header toggle.
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
  THEME_STORAGE_KEY,
  THEME_VARIANT_STORAGE_KEY,
  isKnownTheme,
  isKnownThemeRewardId,
  isKnownThemeVariant,
  themeFamilyFromRewardId,
  themeVariantFromRewardId,
  type Theme,
  type ThemeRewardId,
  type ThemeVariant,
} from '@/context/theme-context';

type StoredThemeState = {
  theme: Theme;
  variant: ThemeVariant;
  hasExplicitVariantPreference: boolean;
};

const DEFAULT_THEME: Theme = 'default';
const DEFAULT_THEME_VARIANT: ThemeVariant = 'light';

// Reads and normalises persisted theme settings, including legacy reward ids stored before the split family/variant model.
function readStoredThemeState(): StoredThemeState {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const storedVariant = localStorage.getItem(THEME_VARIANT_STORAGE_KEY);

  const theme = isKnownTheme(storedTheme)
    ? storedTheme
    : isKnownThemeRewardId(storedTheme)
      ? themeFamilyFromRewardId(storedTheme)
      : DEFAULT_THEME;

  const variant = isKnownThemeVariant(storedVariant)
    ? storedVariant
    : isKnownThemeRewardId(storedTheme)
      ? themeVariantFromRewardId(storedTheme)
      : DEFAULT_THEME_VARIANT;

  return {
    theme,
    variant,
    // Preserve legacy default light/dark selections until the user toggles a different variant locally.
    hasExplicitVariantPreference:
      isKnownThemeVariant(storedVariant)
      || storedTheme === 'light'
      || storedTheme === 'dark',
  };
}

// React Context Provider pattern: coordinates the selected cosmetic theme family with the user's light/dark preference.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredThemeState().theme);
  const [themeVariant, setThemeVariantState] = useState<ThemeVariant>(
    () => readStoredThemeState().variant,
  );
  const [hasExplicitVariantPreference, setHasExplicitVariantPreference] = useState(
    () => readStoredThemeState().hasExplicitVariantPreference,
  );

  // Persist both selectors explicitly so the app theme no longer follows the OS scheme behind the user's back.
  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-theme-family', theme);
    root.setAttribute('data-theme-variant', themeVariant);
    root.setAttribute('data-theme', `${theme}-${themeVariant}`);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(THEME_VARIANT_STORAGE_KEY, themeVariant);
  }, [theme, themeVariant]);

  // Updates only the cosmetic theme family; variant changes are handled separately to preserve user intent.
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  // Records an explicit light/dark choice so future cosmetic syncs do not silently override it.
  const setThemeVariant = useCallback((next: ThemeVariant) => {
    setHasExplicitVariantPreference(true);
    setThemeVariantState(next);
  }, []);

  // Aligns the theme family with an equipped reward while respecting a locally chosen light/dark variant.
  const syncThemeReward = useCallback((themeRewardId: ThemeRewardId) => {
    const nextTheme = themeFamilyFromRewardId(themeRewardId);
    setThemeState((current) => (current === nextTheme ? current : nextTheme));

    if (!hasExplicitVariantPreference) {
      const nextVariant = themeVariantFromRewardId(themeRewardId);
      setThemeVariantState((current) => (current === nextVariant ? current : nextVariant));
    }
  }, [hasExplicitVariantPreference]);

  // Restores the baseline visual theme when there is no student cosmetic source to sync from.
  const resetTheme = useCallback(() => {
    // Sessionless and non-student accounts have no server-backed cosmetic theme, so reset to the app default.
    setHasExplicitVariantPreference(false);
    setThemeState(DEFAULT_THEME);
    setThemeVariantState(DEFAULT_THEME_VARIANT);
  }, []);

  // Toggles the binary variant used by components that need explicit light/dark styling decisions.
  const toggleTheme = useCallback(() => {
    setHasExplicitVariantPreference(true);
    setThemeVariantState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      themeVariant,
      resolvedTheme: themeVariant,
      setTheme,
      setThemeVariant,
      syncThemeReward,
      resetTheme,
      toggleTheme,
    }),
    [theme, themeVariant, setTheme, setThemeVariant, syncThemeReward, resetTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
