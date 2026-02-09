// Verifies top-level app routing guards and shell behavior so auth redirects remain stable.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

type MockUser = {
  globalRole: 'pending' | 'student' | 'admin';
  isVerified: boolean;
};

const authState = {
  user: null as MockUser | null,
  isLoading: false,
  logout: vi.fn(),
  setUser: vi.fn(),
};

vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => authState,
}));

vi.mock('./components/Header', () => ({
  default: () => <div>header</div>,
}));

vi.mock('./components/Footer', () => ({
  default: () => <div>footer</div>,
}));

vi.mock('./components/RoleSelectorOverlay', () => ({
  default: () => <div>role-selector-overlay</div>,
}));

vi.mock('./layouts/AuthedLayout', () => ({
  default: () => (
    <div>
      authed-layout
      <Outlet />
    </div>
  ),
}));

vi.mock('./routes/Landing', () => ({ default: () => <div>landing-page</div> }));
vi.mock('./routes/Login', () => ({ default: () => <div>login-page</div> }));
vi.mock('./routes/Register', () => ({ default: () => <div>register-page</div> }));
vi.mock('./routes/VerifyEmail', () => ({ default: () => <div>verify-email-page</div> }));
vi.mock('./routes/main/AcceptInvite', () => ({ default: () => <div>accept-invite-page</div> }));
vi.mock('./routes/main/ModulesPage', () => ({ default: () => <div>modules-page</div> }));
vi.mock('./routes/main/SingleModulePage', () => ({ default: () => <div>single-module-page</div> }));
vi.mock('./routes/main/ModuleUnitEditor', () => ({ default: () => <div>module-unit-editor-page</div> }));
vi.mock('./routes/main/QuestsPage', () => ({ default: () => <div>quests-page</div> }));
vi.mock('./routes/main/ProfilePage', () => ({ default: () => <div>profile-page</div> }));

function renderAt(pathname: string) {
  window.history.pushState({}, '', pathname);
  return render(<App />);
}

describe('App', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isLoading = false;
    authState.logout.mockReset();
    authState.setUser.mockReset();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects unauthenticated users from protected routes to login', async () => {
    renderAt('/main/modules');

    await waitFor(() => {
      expect(screen.getByText('login-page')).toBeInTheDocument();
    });
  });

  it('redirects authenticated users away from /login to modules', async () => {
    authState.user = { globalRole: 'admin', isVerified: true };

    renderAt('/login');

    await waitFor(() => {
      expect(screen.getByText('modules-page')).toBeInTheDocument();
    });
  });

  it('shows role selector overlay for verified pending users on non-auth routes', () => {
    authState.user = { globalRole: 'pending', isVerified: true };

    renderAt('/');

    expect(screen.getByText('role-selector-overlay')).toBeInTheDocument();
    expect(screen.queryByText('landing-page')).not.toBeInTheDocument();
  });

  it('shows global header on public routes and hides it on shell routes', async () => {
    authState.user = { globalRole: 'admin', isVerified: true };

    renderAt('/');
    expect(screen.getByText('header')).toBeInTheDocument();

    cleanup();
    renderAt('/main/modules');
    await waitFor(() => {
      expect(screen.getByText('authed-layout')).toBeInTheDocument();
      expect(screen.queryByText('header')).not.toBeInTheDocument();
    });
  });
});
