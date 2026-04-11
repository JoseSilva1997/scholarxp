import { useTheme } from '../../context/useTheme';
import { useAuth } from '../../context/AuthContext';
import { useCosmetics } from '@/rewards';
import { BsSunFill, BsMoonStarsFill } from 'react-icons/bs';
import styles from './ThemeToggle.module.css';

/**
 * Header toggle that swaps between light and dark themes.
 * For students, also writes the choice through the cosmetic mutation so the selection persists across devices.
 * Non-students keep using the localStorage-backed ThemeProvider state alone.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { user } = useAuth();
  const { equipCosmetic } = useCosmetics();

  const handleToggle = () => {
    // Flip based on the resolved family so toggling from aurora/midnight/etc. still lands on a sensible opposite.
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user?.globalRole === 'student') {
      // Fire-and-forget: ThemeProvider state already updated so the UI reflects the change immediately,
      // and the mutation propagates the choice server-side for other devices.
      void equipCosmetic('theme', next);
    }
  };

  const getIcon = () => {
    if (resolvedTheme === 'dark') {
      return <BsMoonStarsFill className={`${styles.icon} ${styles.moonIcon}`} />;
    }
    return <BsSunFill className={`${styles.icon} ${styles.sunIcon}`} />;
  };

  const getLabel = () => (resolvedTheme === 'dark' ? 'Dark theme' : 'Light theme');

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={handleToggle}
      aria-label={`Switch theme (currently ${getLabel()})`}
      title={getLabel()}
    >
      <div className={styles.iconWrapper}>{getIcon()}</div>
    </button>
  );
}
