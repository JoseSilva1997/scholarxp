// Renders a single catalog item as a card — unlocked items show an equip button, locked ones show level requirements.
import { FaLock, FaCheck } from 'react-icons/fa6';
import type { CatalogItem } from '@/Rewards/cosmetics';
import styles from '@/Rewards/RewardsPage/components/Rewards.module.css';

type RewardCardProps = {
  item: CatalogItem;
  isUnlocked: boolean;
  isEquipped: boolean;
  onEquip: () => void;
  isEquipping: boolean;
};

// Presents a catalog reward with state-dependent actions for unlocked, equipped, and locked cases.
export default function RewardCard({
  item,
  isUnlocked,
  isEquipped,
  onEquip,
  isEquipping,
}: RewardCardProps) {
  return (
    <div
      className={`${styles.card} ${isUnlocked ? styles.cardUnlocked : styles.cardLocked} ${isEquipped ? styles.cardEquipped : ''}`}
    >
      <div className={styles.cardHeader}>
        <span className={styles.cardName}>{item.name}</span>
        <span className={`${styles.rarityBadge} ${styles[`rarity_${item.rarity}`]}`}>
          {item.rarity}
        </span>
      </div>

      <p className={styles.cardDescription}>{item.description}</p>

      <div className={styles.cardFooter}>
        {/* The nested conditional mirrors the domain state order: unavailable rewards cannot also be equipped. */}
        {isUnlocked ? (
          isEquipped ? (
            <span className={styles.equippedLabel}>
              <FaCheck aria-hidden="true" /> Equipped
            </span>
          ) : (
            <button
              type="button"
              className={styles.equipButton}
              onClick={onEquip}
              disabled={isEquipping}
            >
              {isEquipping ? 'Equipping...' : 'Equip'}
            </button>
          )
        ) : (
          <span className={styles.lockedLabel}>
            <FaLock aria-hidden="true" /> Level {item.unlocksAtLevel}
          </span>
        )}
      </div>
    </div>
  );
}
