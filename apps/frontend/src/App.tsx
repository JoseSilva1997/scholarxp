import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardPage } from './routes/DashboardPage';
import { LoginPage } from './routes/LoginPage';
function AppContent() {
  const { user, loading } = useAuth();

  // Show a minimal loading shell while the session check runs.
  if (loading) {
    return (
      <div className="page">
        <header className="hero">
          <p className="pill">ScholarXP • Daily practice companion</p>
          <h1>Checking your session</h1>
          <p className="subtitle">Hang tight while we verify your sign-in status.</p>
        </header>
        <main className="panel">
          <section className="card summary">
            <h2>Session status</h2>
            <p className="meta">Checking your session…</p>
          </section>
        </main>
      </div>
    );
  }

  // Route selection based on auth state.
  return user ? <DashboardPage /> : <LoginPage />;
}

export default function App() {
  return (
    // AuthProvider shares session state across the app tree.
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
