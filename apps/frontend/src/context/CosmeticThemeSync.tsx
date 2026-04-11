// Syncs the student-equipped theme cosmetic into the local ThemeProvider state so all theme tokens flow from one source.
// Non-students keep their localStorage-based theme preference untouched — their theme toggle continues to work
// without requiring a backend round trip.
import { useEffect } from 'react';
import { THEME_IDS, type Theme } from './theme-context';
import { useTheme } from './useTheme';
import { useAuth } from './AuthContext';
import { useCosmetics } from '@/rewards';

function isKnownTheme(value: string): value is Theme {
  return (THEME_IDS as readonly string[]).includes(value);
}

export function CosmeticThemeSync() {
  const { user } = useAuth();
  const { cosmetic } = useCosmetics();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!user || user.globalRole !== 'student') {
      return;
    }
    const next = cosmetic('theme');
    // Guard against unknown ids so a future catalog entry without a matching theme CSS file
    // does not produce an unset data-theme attribute at runtime.
    if (!isKnownTheme(next)) {
      return;
    }
    if (next !== theme) {
      setTheme(next);
    }
  }, [user, cosmetic, theme, setTheme]);

  return null;
}
