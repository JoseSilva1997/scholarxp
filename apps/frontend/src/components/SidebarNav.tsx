// Sidebar navigation used inside the authenticated shell; highlights active route and supports compact mode for mobile.
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUiLayout } from '../context/UiLayoutContext';
import styles from './SidebarNav.module.css';

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

type Role = 'admin' | 'institution_admin' | 'teacher' | 'student';

type NavItem = {
  to: string;
  label: string;
  hint: string;
  icon: string;
  roles?: Role[];
};

const navItems: NavItem[] = [
  { to: '/main/modules', label: 'Modules', hint: 'Create and manage', icon: '📚' },
  { to: '/main/quests', label: 'Quests', hint: 'Daily practice', icon: '🎯' },
  { to: '/main/profile', label: 'Profile', hint: 'Account and role', icon: '👤' },
];

export default function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { user } = useAuth();
  const { toggleSidebar } = useUiLayout();

  const filteredItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.globalRole as Role);
  });

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={toggleSidebar}
        aria-label="Toggle navigation panel"
      >
        <span className={styles.toggleIcon} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      <div className={styles.section}>
        {filteredItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.linkActive : ''}`
            }
            onClick={onNavigate}
          >
            <span className={styles.icon} aria-hidden>
              {item.icon}
            </span>
            {!collapsed ? (
              <span className={styles.labelBlock}>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.hint}>{item.hint}</span>
              </span>
            ) : (
              <span className={styles.labelSr}>{item.label}</span>
            )}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
