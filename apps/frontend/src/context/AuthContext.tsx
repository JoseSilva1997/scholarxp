// Provides app-wide auth session state via TanStack Query while preserving the existing consumer API.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse } from '@scholarxp/api-contracts';
import { getProgressWithinLevel } from '@scholarxp/progression';
import { getCurrentUser, logout as apiLogout } from '../api/auth';
import { clearCsrfToken, refreshCsrfToken } from '../api/client';
import { updateTimezone } from '../api/users';
import { queryKeys } from '../hooks/query-keys';
import { logError } from '../utils/logger';
import type { AuthUser } from '../types/auth';

type AuthContextValue = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  applyStudentExpReward: (expGained: number) => void;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const authQuery = useQuery<AuthResponse>({
    queryKey: queryKeys.auth.me,
    queryFn: getCurrentUser,
    // Session bootstrapping should happen exactly once per app mount unless explicitly invalidated.
    staleTime: 60_000,
    retry: false,
  });

  const setUser = useCallback(
    (user: AuthUser | null) => {
      // Keep auth writes in one cache key so all subscribers observe a consistent session snapshot.
      queryClient.setQueryData<AuthResponse>(queryKeys.auth.me, { user });
    },
    [queryClient],
  );
  const applyStudentExpReward = useCallback(
    (expGained: number) => {
      if (expGained <= 0) {
        return;
      }

      // Apply rewards through one cache update so header and any auth consumers react in the same render cycle.
      queryClient.setQueryData<AuthResponse | undefined>(
        queryKeys.auth.me,
        (previousValue) => {
          if (!previousValue?.user || previousValue.user.globalRole !== 'student') {
            return previousValue;
          }

          const avatar = previousValue.user.avatar;
          if (!avatar) {
            return previousValue;
          }

          // Keep client-side reward preview aligned with backend level rules by deriving progression from totalExp.
          const totalExp = avatar.totalExp + expGained;
          const nextProgress = getProgressWithinLevel(totalExp);

          return {
            ...previousValue,
            user: {
              ...previousValue.user,
              avatar: {
                ...avatar,
                totalExp,
                ...nextProgress,
              },
            },
          };
        },
      );
    },
    [queryClient],
  );

  const refreshUser = useCallback(async () => {
    try {
      const result = await authQuery.refetch();
      if (result.error) {
        throw result.error;
      }
      return result.data?.user ?? null;
    } catch (error) {
      // Expected auth failures should still resolve the UI to logged-out instead of leaving stale identity.
      logError(error, { source: 'AuthContext.refreshUser' });
      setUser(null);
      return null;
    }
  }, [authQuery, setUser]);

  const logout = useCallback(async () => {
    // Clear client session first so UI reacts immediately even if the network call hangs or fails.
    setUser(null);
    queryClient.removeQueries({ queryKey: queryKeys.modules.all });
    try {
      const response = await apiLogout();
      // Regardless of what comes back, drop any cached token to avoid cross-session reuse.
      if (response.csrfToken) {
        // We intentionally ignore the provided token and force-fetch to bind to the new anonymous session.
        clearCsrfToken();
      } else {
        clearCsrfToken();
      }
    } catch (error) {
      // Backend failures are non-blocking for the UI; they are logged for diagnostics only.
      logError(error, { source: 'AuthContext.logout' });
      clearCsrfToken();
    }
    // Always fetch a fresh CSRF token bound to the new anonymous session to avoid stale reuse.
    await refreshCsrfToken();
  }, [queryClient, setUser]);

  // Sync browser timezone to the server once per user identity so date-keyed features
  // (quests, streaks) use the user's local clock rather than UTC.
  useEffect(() => {
    if (!authQuery.data?.user) return;
    const currentUser = authQuery.data.user;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected || detected === currentUser.timezone) return;

    updateTimezone(currentUser.id, detected)
      .then((updated) => {
        setUser(updated);
      })
      .catch((error: unknown) => {
        logError(error, { source: 'AuthContext.timezoneSync' });
      });
    // Re-run only when the user identity changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authQuery.data?.user?.id]);

  const value = useMemo(
    () => ({
      user: authQuery.data?.user ?? null,
      setUser,
      applyStudentExpReward,
      refreshUser,
      logout,
      isLoading: authQuery.isPending,
    }),
    [
      applyStudentExpReward,
      authQuery.data?.user,
      authQuery.isPending,
      refreshUser,
      logout,
      setUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
