// Authenticated app shell: keeps Header + Sidebar visible while swapping section content via nested routes.
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import SidebarNav from '../components/SidebarNav';
import { useAuth } from '../context/AuthContext';
import { UiLayoutProvider, useUiLayout } from '../context/UiLayoutContext';
import styles from './AuthedLayout.module.css';

function AuthedLayoutInner() {
  const { user, logout } = useAuth();
  const { isSidebarOpen, setSidebarOpen } = useUiLayout();

  const handleNavigate = () => {
    // Collapse the sidebar after navigation on small screens so content is not obstructed.
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className={styles.shell}>
      <Header user={user} onLogout={logout} />
      <div className={`${styles.mainWrapper} ${!isSidebarOpen ? styles.mainWrapperCollapsed : ''}`}>
        <SidebarNav collapsed={!isSidebarOpen} onNavigate={handleNavigate} />
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
