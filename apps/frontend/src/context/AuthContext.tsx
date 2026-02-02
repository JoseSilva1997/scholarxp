// Provides app-wide authentication state and helper actions (fetch current user, logout).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getCurrentUser, logout as apiLogout } from '../api/auth';
import { clearCsrfToken, refreshCsrfToken } from '../api/client';
import { logError } from '../utils/logger';
import type { AuthUser } from '../types/auth';

type AuthContextValue = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await getCurrentUser();
      setUser(response.user);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // Clear client session first so UI reacts immediately even if the network call hangs or fails.
    setUser(null);
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
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      refreshUser,
      logout,
      isLoading,
    }),
    [user, refreshUser, logout, isLoading],
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
