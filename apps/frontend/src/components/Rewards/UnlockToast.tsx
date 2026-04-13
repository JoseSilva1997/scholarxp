// Floating toast shown after a level-up when new cosmetics are unlocked. Auto-dismisses or links to the rewards page.
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BsGift } from 'react-icons/bs';
import type { CatalogItem } from '@/rewards';
import styles from './UnlockToast.module.css';

type UnlockToastProps = {
  items: CatalogItem[];
  onDismiss: () => void;
};

export default function UnlockToast({ items, onDismiss }: UnlockToastProps) {
  const navigate = useNavigate();

  if (items.length === 0) return null;

  const handleViewRewards = () => {
    onDismiss();
    navigate('/main/rewards');
  };

  return (
    <motion.div
      className={styles.toast}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.35, ease: 'backOut' }}
    >
      <div className={styles.iconWrap}>
        <BsGift className={styles.icon} aria-hidden="true" />
      </div>

      <div className={styles.body}>
        <span className={styles.title}>
          {items.length === 1 ? 'New Cosmetic Unlocked!' : `${items.length} Cosmetics Unlocked!`}
        </span>
        <span className={styles.names}>
          {items.map((item) => item.name).join(', ')}
        </span>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.viewButton} onClick={handleViewRewards}>
          View
        </button>
        <button type="button" className={styles.dismissButton} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </motion.div>
  );
}
