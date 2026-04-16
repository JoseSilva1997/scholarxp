import { useTheme } from '../../context/useTheme';
import { BsSunFill, BsMoonStarsFill } from 'react-icons/bs';
import styles from './ThemeToggle.module.css';

/**
 * Header toggle that flips the active theme variant without changing the selected family.
 */
export default function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();

  const getIcon = () => {
    if (resolvedTheme === 'dark') {
      return <BsMoonStarsFill className={`${styles.icon} ${styles.moonIcon}`} />;
    }
    return <BsSunFill className={`${styles.icon} ${styles.sunIcon}`} />;
  };

  const getLabel = () => (resolvedTheme === 'dark' ? 'Dark variant' : 'Light variant');

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={`Switch theme variant (currently ${getLabel()})`}
      title={getLabel()}
    >
      <div className={styles.iconWrapper}>{getIcon()}</div>
    </button>
  );
}
