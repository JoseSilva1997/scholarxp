import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login, logout, me, register } from '../api/auth';
import type { AuthUser } from '../types/auth';

type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (payload: LoginPayload) => Promise<AuthUser | null>;
  signUp: (payload: RegisterPayload) => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the current session on app load or after auth actions.
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await me();
      setUser(response.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Wrap auth API calls so components only deal with user state.
  const signIn = useCallback(async (payload: LoginPayload) => {
    const response = await login(payload);
    setUser(response.user);
    return response.user;
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const response = await register(payload);
    setUser(response.user);
    return response.user;
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh,
      signIn,
      signUp,
      signOut,
    }),
    [loading, refresh, signIn, signOut, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
