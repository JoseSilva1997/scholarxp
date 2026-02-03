import { useEffect } from 'react';
import type { Location } from 'react-router-dom';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';
import Landing from './routes/Landing';
import Login from './routes/Login';
import Register from './routes/Register';
import VerifyEmail from './routes/VerifyEmail';
import { AuthProvider, useAuth } from './context/AuthContext';
import RoleSelectorOverlay from './components/RoleSelectorOverlay';
import AuthedLayout from './layouts/AuthedLayout';
import ModulesPage from './routes/main/ModulesPage';
import SingleModulePage from './routes/main/SingleModulePage';
import ModuleUnitEditor from './routes/main/ModuleUnitEditor';
import QuestsPage from './routes/main/QuestsPage';
import ProfilePage from './routes/main/ProfilePage';
import AcceptInvite from './routes/AcceptInvite';

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const redirectFrom = (location.state as { from?: Location } | null)?.from;
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/verify-email';
  const isShellRoute = location.pathname.startsWith('/main');

  const { user, isLoading, logout, setUser } = useAuth();
  const shouldShowRoleSelector =
    !isAuthRoute && !isLoading && user?.isVerified && user.globalRole === 'pending';
  // Shell renders its own header; we skip the global one to avoid double bars.
  const shouldShowHeader = !isShellRoute && !shouldShowRoleSelector;
  // Sidebar shell needs the wider canvas so we reuse the auth width treatment.
  const usesFullWidth = isAuthRoute || isShellRoute;

  useEffect(() => {
    if (!user || isLoading) return;
    const pendingRedirect = sessionStorage.getItem('postAuthRedirect');
    if (!pendingRedirect) return;
    // Clear first to prevent loops if navigation fails.
    sessionStorage.removeItem('postAuthRedirect');
    if (pendingRedirect !== `${location.pathname}${location.search}${location.hash}`) {
      // After OAuth callback we land on /main; hop to the originally requested route (e.g., invite with token).
      navigate(pendingRedirect, { replace: true });
    }
  }, [isLoading, location.hash, location.pathname, location.search, navigate, user]);

  return (
    <div className={`App ${usesFullWidth ? 'App--auth' : ''}`}>
      {shouldShowHeader ? <Header user={user} onLogout={logout} /> : null}
      <main className={`App__content ${usesFullWidth ? 'App__content--auth' : ''}`}>
        {shouldShowRoleSelector ? (
          <RoleSelectorOverlay user={user} onRoleSelected={setUser} />
        ) : (
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/login"
              element={
                user && !isLoading ? (
                  // If user hit login while unauthenticated, send them back to their intended page post-login.
                  <Navigate
                    to={
                      redirectFrom
                        ? `${redirectFrom.pathname}${redirectFrom.search}${redirectFrom.hash}`
                        : '/main'
                    }
                    replace
                  />
                ) : (
                  <Login />
                )
              }
            />
            <Route
              path="/register"
              element={user && !isLoading ? <Navigate to="/main" replace /> : <Register />}
            />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route element={<ProtectedRoute isLoading={isLoading} isAuthed={!!user} />}>
              {/* Invite redemption sits outside the shell so it can stay focused and load without sidebar chrome. */}
              <Route path="/invite" element={<AcceptInvite />} />
              <Route element={<AuthedLayout />}>
                <Route path="/main" element={<Navigate to="/main/modules" replace />} />
                <Route path="/main/modules" element={<ModulesPage />} />
                <Route path="/main/modules/:moduleId" element={<SingleModulePage />} />
                <Route path="/main/modules/:moduleId/:unitId/editor" element={<ModuleUnitEditor />} />
                <Route path="/main/quests" element={<QuestsPage />} />
                <Route path="/main/profile" element={<ProfilePage />} />
              </Route>
            </Route>
          </Routes>
        )}
      </main>
      <Footer />
    </div>
  );
}

type ProtectedRouteProps = {
  isLoading: boolean;
  isAuthed: boolean;
};

function ProtectedRoute({ isLoading, isAuthed }: ProtectedRouteProps) {
  const location = useLocation();
  // Preserve the originally requested route (including query params) so post-login flow can return there.
  if (isLoading) {
    return null;
  }
  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
