import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';
import Landing from './routes/Landing';
import Login from './routes/Login';
import Register from './routes/Register';
import type { AuthUser } from './types/auth';

function AppLayout() {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';

  // TODO: Replace this placeholder with real auth state once the login flow is wired.
  const currentUser: AuthUser | null = null;

  return (
    <div className={`App ${isAuthRoute ? 'App--auth' : ''}`}>
      <Header user={currentUser} />
      <main className={`App__content ${isAuthRoute ? 'App__content--auth' : ''}`}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
