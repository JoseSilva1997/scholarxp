import { useTheme } from '../../context/useTheme';
import { BsSunFill, BsMoonStarsFill } from 'react-icons/bs';
import styles from './ThemeToggle.module.css';

/**
 * A toggle button to switch between light, dark, and system themes.
 * Cycle through: light -> dark -> light
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleToggle = () => {
    if (theme === 'light') setTheme('dark');
    else setTheme('light');
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <BsSunFill className={`${styles.icon} ${styles.sunIcon}`}/>;
      case 'dark':
        return <BsMoonStarsFill className={`${styles.icon} ${styles.moonIcon}`} />;
      default:
        return <BsSunFill className={`${styles.icon} ${styles.sunIcon}`} />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light theme';
      case 'dark':
        return 'Dark theme';
      default:
        return 'Light theme';
    }
  };

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
