import { useEffect } from 'react';
import type { Location } from 'react-router-dom';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import '@/App.css';
import Header from '@/MainApp/Header/Header';
import Footer from '@/MainApp/Footer/Footer';
import Landing from '@/Public/Landing/Landing';
import Login from '@/Auth/Login/Login';
import Register from '@/Auth/Register/Register';
import VerifyEmail from '@/Auth/Register/VerifyEmail';
import ForgotPassword from '@/Auth/ForgotPassword/ForgotPassword';
import ResetPassword from '@/Auth/ForgotPassword/ResetPassword';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CosmeticThemeSync } from '@/context/CosmeticThemeSync';
import { CosmeticStyleSync } from '@/context/CosmeticStyleSync';
import { useCosmetics } from '@/Rewards/cosmetics';
import ScholarBackground from '@/Rewards/RewardsPage/components/ScholarBackground';
import RoleSelectorOverlay from '@/MainApp/RoleSelectorOverlay';
import AuthedLayout from '@/MainApp/AuthedLayout/AuthedLayout';
import ModulesPage from '@/Authoring/Modules/ModulesPage';
import SingleModulePage from '@/Authoring/SingleModule/SingleModulePage';
import ModuleUnitEditor from '@/Authoring/ModuleUnitEditor/ModuleUnitEditor';
import PracticeRoomPage from '@/Practice-Room/PracticeRoomPage';
import DailyPracticePage from '@/DailyPractice/DailyPracticePage';
import QuestsPage from '@/Quests/QuestsPage';
import RewardsPage from '@/Rewards/RewardsPage/RewardsPage';
import ProfilePage from '@/Account/Profile/ProfilePage';
import AcceptInvite from '@/Authoring/AcceptInvite/AcceptInvite';
import ModuleRosterPage from '@/Authoring/ModuleRoster/ModuleRosterPage';
import Terms from '@/Public/Terms/Terms';
import Privacy from '@/Public/Privacy/Privacy';
import { features, type FeatureKey } from '@scholarxp/permissions';
import { canUserAccess } from '@/shared/permissions/permission';

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const redirectFrom = (location.state as { from?: Location } | null)?.from;
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/verify-email' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password';
  const isShellRoute = location.pathname.startsWith('/main');

  const { user, isLoading, logout, setUser } = useAuth();
  const { cosmetic } = useCosmetics();
  // Public landing at '/' needs full-width, no padding — its own sections manage layout.
  const isLandingRoute = location.pathname === '/';
  const shouldShowRoleSelector =
    !isAuthRoute && !isLoading && user?.isVerified && user.globalRole === 'pending';
  // Shell renders its own header; we skip the global one to avoid double bars.
  const shouldShowHeader = !isShellRoute && !shouldShowRoleSelector;
  // Outside /main there is no sidebar instance, so the toggle acts as a shell shortcut for signed-in users.
  const shouldShowShellToggleShortcut = !!user && !isAuthRoute && !isShellRoute;
  // Sidebar shell needs the wider canvas so we reuse the auth width treatment.
  const usesFullWidth = isAuthRoute || isShellRoute || location.pathname === '/terms' || location.pathname === '/privacy';

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
      {/* Bridges server-backed cosmetic selections into ThemeProvider state for students;
          a null-render component so it doesn't disturb layout. */}
      <CosmeticThemeSync />
      <CosmeticStyleSync />
      {cosmetic('background') === 'scholar' ? <ScholarBackground /> : null}
      {shouldShowHeader ? (
        <Header
          user={user}
          onLogout={logout}
          showSidebarToggle={shouldShowShellToggleShortcut}
          onToggleSidebar={() => navigate('/main/modules')}
        />
      ) : null}
      <main
        className={`App__content ${usesFullWidth ? 'App__content--auth' : isLandingRoute ? 'App__content--landing' : ''}`}
      >
        {shouldShowRoleSelector ? (
          <RoleSelectorOverlay user={user} onRoleSelected={setUser} />
        ) : (
          <Routes>
            <Route
              path="/login"
              element={
                isLoading ? null : user ? (
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
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route
              path="/register"
              element={isLoading ? null : user ? <Navigate to="/main" replace /> : <Register />}
            />
            <Route
              path="/"
              element={
                isLoading ? null : user ? (
                  // Signed-in users should land inside the shell so sidebar/navigation remains available.
                  <Navigate to="/main/landing" replace />
                ) : (
                  <Landing />
                )
              }
            />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute isLoading={isLoading} isAuthed={!!user} />}>
              {/* Invite redemption sits outside the shell so it can stay focused and load without sidebar chrome. */}
              <Route path="/invite" element={<AcceptInvite />} />
              <Route element={<AuthedLayout />}>
                <Route path="/main" element={<Navigate to="/main/modules" replace />} />
                <Route path="/main/landing" element={<Landing />} />
                <Route path="/main/modules" element={<ModulesPage />} />
                <Route path="/main/modules/:moduleId" element={<SingleModulePage />} />
                <Route
                  path="/main/modules/:moduleId/roster"
                  element={
                    <RequireCapability capability={features.modules.roster}>
                      <ModuleRosterPage />
                    </RequireCapability>
                  }
                />
                <Route
                  path="/main/modules/:moduleId/:unitId/editor"
                  element={
                    <RequireCapability capability={features.modules.manageContent}>
                      <ModuleUnitEditor />
                    </RequireCapability>
                  }
                />
                <Route path="/main/modules/:moduleId/:unitId/practice-room" element={<PracticeRoomPage />} />
                <Route path="/main/modules/:moduleId/daily-practice" element={<DailyPracticePage />} />
                <Route
                  path="/main/quests"
                  element={
                    <RequireCapability capability={features.navigation.quests}>
                      <QuestsPage />
                    </RequireCapability>
                  }
                />
                <Route
                  path="/main/rewards"
                  element={
                    <RequireCapability capability={features.navigation.rewards}>
                      <RewardsPage />
                    </RequireCapability>
                  }
                />
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

function RequireCapability({
  capability,
  children,
}: {
  capability: FeatureKey;
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const params = useParams();
  if (isLoading) return null;
  if (!canUserAccess(capability, user)) {
    const fallback = params.moduleId
      ? `/main/modules/${params.moduleId}`
      : '/main/modules';
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

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
