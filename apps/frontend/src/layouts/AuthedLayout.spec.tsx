// Verifies authenticated layout wiring so header/sidebar actions trigger expected auth and navigation behavior.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthedLayout from './AuthedLayout';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  setSidebarOpen: vi.fn(),
  toggleSidebar: vi.fn(),
}));

let authState = {
  user: { id: 1, globalRole: 'admin' },
  logout: mocks.logout,
};

let uiState = {
  isSidebarOpen: true,
  setSidebarOpen: mocks.setSidebarOpen,
  toggleSidebar: mocks.toggleSidebar,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    Outlet: () => <div>outlet-content</div>,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../context/UiLayoutContext', () => ({
  UiLayoutProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUiLayout: () => uiState,
}));

vi.mock('../components/header/Header', () => ({
  default: ({
    onLogout,
    onToggleSidebar,
  }: {
    onLogout: () => Promise<void>;
    onToggleSidebar: () => void;
  }) => (
    <div data-testid="header">
      <button onClick={() => void onLogout()}>header-logout</button>
      <button onClick={onToggleSidebar}>header-toggle</button>
    </div>
  ),
}));

vi.mock('../components/SidebarNav', () => ({
  default: ({ onNavigate, collapsed }: { onNavigate: () => void; collapsed: boolean }) => (
    <div data-testid="sidebar" data-collapsed={collapsed}>
      <button onClick={onNavigate}>sidebar-navigate</button>
    </div>
  ),
}));

describe('AuthedLayout', () => {
  beforeEach(() => {
    authState = {
      user: { id: 1, globalRole: 'admin' },
      logout: mocks.logout,
    };
    uiState = {
      isSidebarOpen: true,
      setSidebarOpen: mocks.setSidebarOpen,
      toggleSidebar: mocks.toggleSidebar,
    };

    mocks.navigate.mockReset();
    mocks.logout.mockReset();
    mocks.setSidebarOpen.mockReset();
    mocks.toggleSidebar.mockReset();
    mocks.logout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('runs logout flow and redirects to login', async () => {
    render(<AuthedLayout />);

    fireEvent.click(screen.getByText('header-logout'));

    expect(mocks.logout).toHaveBeenCalled();
    await Promise.resolve();
    expect(mocks.navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('collapses sidebar on mobile navigation', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 700,
    });

    render(<AuthedLayout />);

    fireEvent.click(screen.getAllByText('sidebar-navigate')[0]);

    expect(mocks.setSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('overlay click closes sidebar', () => {
    const { container } = render(<AuthedLayout />);

    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).not.toBeNull();

    fireEvent.click(overlay!);

    expect(mocks.setSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('toggles sidebar state', () => {
    render(<AuthedLayout />);

    fireEvent.click(screen.getByText('header-toggle'));

    expect(mocks.setSidebarOpen).toHaveBeenCalled();
  });

  it('starts with sidebar collapsed', () => {
    uiState.isSidebarOpen = false;
    render(<AuthedLayout />);

    const sidebar = screen.getByTestId('sidebar');

    expect(sidebar.getAttribute('data-collapsed')).toBe('true');
  });

  it('skips sidebar collapse on desktop navigation', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });

    render(<AuthedLayout />);

    fireEvent.click(screen.getAllByText('sidebar-navigate')[0]);

    expect(mocks.setSidebarOpen).not.toHaveBeenCalled();
  });

  it('locks body scroll on mobile when sidebar is open', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 700,
    });

    render(<AuthedLayout />);

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('unlocks body scroll when sidebar is closed', () => {
    uiState.isSidebarOpen = false;
    render(<AuthedLayout />);

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('unlocks body scroll on desktop even if sidebar is open', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });

    render(<AuthedLayout />);

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
