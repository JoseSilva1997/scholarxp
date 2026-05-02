// Syncs the student-equipped theme family into ThemeProvider while leaving the local light/dark variant intact.
import { useEffect, useEffectEvent } from 'react';
import { useTheme } from '@/context/useTheme';
import { useAuth } from '@/context/AuthContext';
import { useCosmetics } from '@/Rewards/cosmetics';
import { isKnownThemeRewardId } from '@/context/theme-context';

// Null component pattern: performs cross-context theme synchronisation without rendering UI.
export function CosmeticThemeSync() {
  const { user } = useAuth();
  const { cosmetic } = useCosmetics();
  const { resetTheme, syncThemeReward } = useTheme();

  // Captures the latest context values for an effect whose trigger is the auth/cosmetic input change.
  const applyThemeSync = useEffectEvent(() => {
    if (!user || user.globalRole !== 'student') {
      resetTheme();
      return;
    }

    const next = cosmetic('theme');
    // Ignore stale ids so a future backend reward does not apply an invalid selector before the frontend ships support.
    if (!isKnownThemeRewardId(next)) {
      return;
    }

    syncThemeReward(next);
  });

  useEffect(() => {
    applyThemeSync();
  }, [cosmetic, user]);

  return null;
}
