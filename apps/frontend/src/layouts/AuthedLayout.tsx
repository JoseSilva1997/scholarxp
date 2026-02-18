// Authenticated app shell: keeps Header + Sidebar visible while swapping section content via nested routes.
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import SidebarNav from '../components/SidebarNav';
import { useAuth } from '../context/AuthContext';
import { UiLayoutProvider, useUiLayout } from '../context/UiLayoutContext';
import styles from './AuthedLayout.module.css';

function AuthedLayoutInner() {
  const { user, logout } = useAuth();
  const { isSidebarOpen, setSidebarOpen } = useUiLayout();
  const navigate = useNavigate();

  const handleLogout = async () => {
    // Force client-side redirect so the user sees immediate sign-out even if the API call errors or is slow.
    await logout();
    navigate('/login', { replace: true });
  };

  const handleNavigate = () => {
    // Collapse the sidebar after navigation on small screens so content is not obstructed.
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setSidebarOpen(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Lock document scroll only for mobile sidebar overlay so header stays anchored during nav interactions.
    const shouldLockDocumentScroll = isSidebarOpen && window.innerWidth <= 900;
    if (!shouldLockDocumentScroll) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isSidebarOpen]);

  return (
    <div className={`${styles.shell} ${isSidebarOpen ? styles.shellNavOpen : ''}`}>
      <Header
        user={user}
        onLogout={handleLogout}
        onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
        showSidebarToggle
      />
      <div className={`${styles.mainWrapper} ${!isSidebarOpen ? styles.mainWrapperCollapsed : ''}`}>
        <SidebarNav collapsed={!isSidebarOpen} onNavigate={handleNavigate} showToggle={false} />
        <div className={styles.body}>
          <section className={styles.content} aria-live="polite">
            <Outlet />
          </section>
        </div>
      </div>
      <div
        className={`${styles.overlay} ${isSidebarOpen ? styles.overlayVisible : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />
    </div>
  );
}

export default function AuthedLayout() {
  // Provider lives here so the sidebar preference persists across the authed section without touching public pages.
  return (
    <UiLayoutProvider>
      <AuthedLayoutInner />
    </UiLayoutProvider>
  );
}
