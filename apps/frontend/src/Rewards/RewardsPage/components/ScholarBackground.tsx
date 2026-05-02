// Renders a tiled wallpaper of study-themed react-icons at low opacity behind the app content.
// Only mounted when the scholar background cosmetic is equipped.
import {
  BsBook,
  BsLightbulb,
  BsStar,
  BsPencil,
  BsMortarboard,
  BsTrophy,
  BsCheckCircle,
  BsLightningCharge,
  BsJournal,
  BsBookmark,
} from 'react-icons/bs';
import type { IconType } from 'react-icons';
import styles from '@/Rewards/RewardsPage/components/ScholarBackground.module.css';

const ICONS: IconType[] = [
  BsBook, BsStar, BsLightbulb, BsPencil, BsMortarboard,
  BsTrophy, BsCheckCircle, BsLightningCharge, BsJournal, BsBookmark,
];

// Enough icons to tile large viewports; flex-wrap fills the space naturally.
const ICON_COUNT = 1000; // Adjust as needed for performance vs. coverage.

const ICON_LIST = Array.from({ length: ICON_COUNT }, (_, i) => ({
  id: i,
  Icon: ICONS[i % ICONS.length],
}));

// Renders the scholar wallpaper as decorative content that remains hidden from assistive technologies.
export default function ScholarBackground() {
  return (
    <div className={styles.wallpaper} aria-hidden="true">
      {ICON_LIST.map(({ id, Icon }) => (
        <span key={id} className={styles.icon}>
          <Icon />
        </span>
      ))}
    </div>
  );
}
