// Sidebar navigation used inside the authenticated shell; highlights active route and supports compact mode for mobile.
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { RiBook3Line, RiUser3Line } from 'react-icons/ri';
import { PiPathDuotone } from "react-icons/pi";
import { useAuth } from '../context/AuthContext';
import { useUiLayout } from '../context/UiLayoutContext';
import { canUserAccess } from '../permissions/permission';
import { features, type FeatureKey } from '@scholarxp/permissions';
import styles from './SidebarNav.module.css';

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  showToggle?: boolean;
};

type NavItem = {
  to: string;
  label: string;
  hint: string;
  icon: React.ElementType;
  feature?: FeatureKey;
};

const navItems: NavItem[] = [
  {
    to: '/main/modules',
    label: 'Modules',
    hint: 'Module catalogue',
    icon: RiBook3Line,
    feature: features.navigation.modules,
  },
  {
    to: '/main/quests',
    label: 'Quest History',
    hint: 'My quest progress',
    icon: PiPathDuotone,
    feature: features.navigation.quests,
  },
  {
    to: '/main/profile',
    label: 'Profile',
    hint: 'My account',
    icon: RiUser3Line,
    feature: features.navigation.profile,
  },
];

export default function SidebarNav({ collapsed = false, onNavigate, showToggle = true }: SidebarNavProps) {
  const { user } = useAuth();
  const { toggleSidebar } = useUiLayout();

  const filteredItems = navItems.filter((item) => {
    if (!item.feature) return true;
    return canUserAccess(item.feature, user);
  });

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      {showToggle && (
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
      )}
      <div className={styles.section}>
        {filteredItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }: { isActive: boolean }) =>
              `${styles.link} ${isActive ? styles.linkActive : ''} ${collapsed ? styles.linkCollapsed : ''}`
            }
            onClick={onNavigate}
          >
            <motion.span 
              className={styles.icon} 
              aria-hidden
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              style={{ marginRight: collapsed ? 0 : 14 }}
            >
              <item.icon />
            </motion.span>
            
            {!collapsed ? (
              <div className={styles.labelBlock}>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.hint}>{item.hint}</span>
              </div>
            ) : (
              <span className={styles.labelCollapsed}>{item.label}</span>
            )}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
