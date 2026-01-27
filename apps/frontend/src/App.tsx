import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';
import Landing from './routes/Landing';
import Login from './routes/Login';
import Register from './routes/Register';
import MainPage from './routes/MainPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import RoleSelectorOverlay from './components/RoleSelectorOverlay';

function AppLayout() {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';

  const { user, isLoading, logout, setUser } = useAuth();
  const shouldShowRoleSelector =
    !isAuthRoute && !isLoading && user?.isVerified && user.globalRole === 'pending';

  return (
    <div className={`App ${isAuthRoute ? 'App--auth' : ''}`}>
      <Header user={shouldShowRoleSelector ? null : user} onLogout={logout} />
      <main className={`App__content ${isAuthRoute ? 'App__content--auth' : ''}`}>
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
            <Route
              path="/main"
              element={
                <ProtectedRoute isLoading={isLoading} isAuthed={!!user} component={<MainPage />} />
              }
            />
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
  component: ReactElement;
};

function ProtectedRoute({ isLoading, isAuthed, component }: ProtectedRouteProps) {
  if (isLoading) {
    return null;
  }
  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }
  return component;
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
