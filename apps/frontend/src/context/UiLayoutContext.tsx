// Provides shared UI layout state (e.g., sidebar toggle) so Header and SidebarNav stay in sync across authed pages.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type UiLayoutContextValue = {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

const UiLayoutContext = createContext<UiLayoutContextValue | undefined>(undefined);
const SIDEBAR_STORAGE_KEY = 'scholarxp:sidebar-open';

// React Context Provider pattern: centralises sidebar state for layout components mounted in different branches.
export function UiLayoutProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    // Start from stored preference; default closed on small screens to avoid covering content on first load.
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    if (typeof window !== 'undefined') {
      return !window.matchMedia('(max-width: 900px)').matches;
    }
    return true;
  });

  // Persist preference so users do not have to keep retoggling on each visit.
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarOpen));
  }, [isSidebarOpen]);

  // Provides a stable command for controls that only need to invert the current sidebar state.
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((open) => !open);
  }, []);

  const value = useMemo(
    () => ({
      isSidebarOpen,
      setSidebarOpen: setIsSidebarOpen,
      toggleSidebar,
    }),
    [isSidebarOpen, toggleSidebar],
  );

  return <UiLayoutContext.Provider value={value}>{children}</UiLayoutContext.Provider>;
}

// Gives consumers access to layout state and prevents silent fallback values outside UiLayoutProvider.
// eslint-disable-next-line react-refresh/only-export-components -- hooks alongside providers are fine and used together here.
export function useUiLayout(): UiLayoutContextValue {
  const ctx = useContext(UiLayoutContext);
  if (!ctx) {
    throw new Error('useUiLayout must be used within UiLayoutProvider');
  }
  return ctx;
}
