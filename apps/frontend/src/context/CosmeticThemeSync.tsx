// Syncs the student-equipped theme family into ThemeProvider while leaving the local light/dark variant intact.
import { useEffect } from 'react';
import { useTheme } from './useTheme';
import { useAuth } from './AuthContext';
import { useCosmetics } from '@/rewards';
import { isKnownThemeRewardId } from './theme-context';

export function CosmeticThemeSync() {
  const { user } = useAuth();
  const { cosmetic } = useCosmetics();
  const { syncThemeReward } = useTheme();

  useEffect(() => {
    if (!user || user.globalRole !== 'student') {
      return;
    }
    const next = cosmetic('theme');
    // Ignore stale ids so a future backend reward does not apply an invalid selector before the frontend ships support.
    if (!isKnownThemeRewardId(next)) {
      return;
    }
    syncThemeReward(next);
  }, [user, cosmetic, syncThemeReward]);

  return null;
}
