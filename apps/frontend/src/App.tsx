import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
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
import QuestsPage from './routes/main/QuestsPage';
import ProfilePage from './routes/main/ProfilePage';

function AppLayout() {
  const location = useLocation();
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
              element={user && !isLoading ? <Navigate to="/main" replace /> : <Login />}
            />
            <Route
              path="/register"
              element={user && !isLoading ? <Navigate to="/main" replace /> : <Register />}
            />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route element={<ProtectedRoute isLoading={isLoading} isAuthed={!!user} />}>
              <Route element={<AuthedLayout />}>
                <Route path="/main" element={<Navigate to="/main/modules" replace />} />
                <Route path="/main/modules" element={<ModulesPage />} />
                <Route path="/main/modules/:moduleId" element={<SingleModulePage />} />
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
  if (isLoading) {
    return null;
  }
  if (!isAuthed) {
    return <Navigate to="/login" replace />;
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
