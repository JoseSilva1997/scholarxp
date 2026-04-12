// Groups reward cards under a slot heading; separates unlocked items from locked ones with a visual divider.
import type { CosmeticSlot } from '@scholarxp/progression';
import type { CatalogItem, SlotDisplay } from '@/rewards';
import RewardCard from './RewardCard';
import styles from './Rewards.module.css';

type SlotGroupProps = {
  display: SlotDisplay;
  unlocked: CatalogItem[];
  locked: CatalogItem[];
  equippedId: string;
  onEquip: (slot: CosmeticSlot, rewardId: string) => void;
  isEquipping: boolean;
};

export default function SlotGroup({
  display,
  unlocked,
  locked,
  equippedId,
  onEquip,
  isEquipping,
}: SlotGroupProps) {
  return (
    <section className={styles.slotGroup}>
      <div className={styles.slotHeader}>
        <h2 className={styles.slotTitle}>{display.title}</h2>
        <p className={styles.slotDescription}>{display.description}</p>
      </div>

      <div className={styles.cardGrid}>
        {unlocked.map((item) => (
          <RewardCard
            key={item.id}
            item={item}
            isUnlocked
            isEquipped={item.id === equippedId}
            onEquip={() => onEquip(display.slot, item.id)}
            isEquipping={isEquipping}
          />
        ))}
        {locked.map((item) => (
          <RewardCard
            key={item.id}
            item={item}
            isUnlocked={false}
            isEquipped={false}
            onEquip={() => {}}
            isEquipping={false}
          />
        ))}
      </div>
    </section>
  );
}
