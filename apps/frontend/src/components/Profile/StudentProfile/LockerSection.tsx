// Keeps reward shelf rendering separate because equip logic is intentionally deferred until the backend supports it.
import { BsLightningChargeFill } from 'react-icons/bs';
import { FaLock } from 'react-icons/fa6';
import type {
  RewardCategory,
  RewardItem,
  StudentProfileResponse,
  UpcomingReward,
} from '@scholarxp/api-contracts';
import styles from '../StudentProfile.module.css';

type LockerSectionProps = {
  rewards: StudentProfileResponse['rewards'];
};

const EQUIPPED_SLOT_LABELS: { category: RewardCategory; label: string }[] = [
  { category: 'avatar_frame', label: 'Avatar Frame' },
  { category: 'profile_background', label: 'Background' },
  { category: 'title_badge', label: 'Title / Badge' },
  { category: 'flair_effect', label: 'Flair Effect' },
];

export default function LockerSection({ rewards }: LockerSectionProps) {
  const hasAnyItems = rewards.equipped.length > 0
    || rewards.owned.length > 0
    || rewards.upcoming.length > 0;

  return (
    <section className={styles.lockerSection}>
      <h2 className={styles.sectionTitle}>Locker</h2>

      {!hasAnyItems ? (
        <div className={styles.lockerEmpty}>
          <BsLightningChargeFill className={styles.lockerEmptyIcon} aria-hidden="true" />
          <p className={styles.lockerEmptyText}>
            Your locker is empty for now. Keep levelling up to unlock cosmetics!
          </p>
        </div>
      ) : (
        <div className={styles.lockerContent}>
          <div className={styles.lockerGroup}>
            <h3 className={styles.lockerGroupTitle}>Equipped</h3>
            <div className={styles.equippedGrid}>
              {EQUIPPED_SLOT_LABELS.map((slot) => {
                const equipped = rewards.equipped.find((reward) => reward.category === slot.category);
                return (
                  <div key={slot.category} className={styles.equippedSlot}>
                    {equipped ? (
                      <span className={styles.equippedItemName}>{equipped.name}</span>
                    ) : (
                      <span className={styles.equippedEmpty}>{slot.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {rewards.owned.length > 0 ? (
            <div className={styles.lockerGroup}>
              <h3 className={styles.lockerGroupTitle}>Owned</h3>
              <div className={styles.ownedGrid}>
                {rewards.owned.map((item: RewardItem) => (
                  <div key={item.id} className={styles.ownedCard}>
                    <span className={styles.ownedName}>{item.name}</span>
                    <span className={`${styles.rarityBadge} ${styles[`rarity_${item.rarity}`]}`}>
                      {item.rarity}
                    </span>
                    <span className={styles.ownedSource}>{item.sourceLabel}</span>
                    <button type="button" className={styles.equipButton} disabled>
                      Equip
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {rewards.upcoming.length > 0 ? (
            <div className={styles.lockerGroup}>
              <h3 className={styles.lockerGroupTitle}>Upcoming</h3>
              <div className={styles.ownedGrid}>
                {rewards.upcoming.map((item: UpcomingReward) => (
                  <div key={item.id} className={`${styles.ownedCard} ${styles.ownedCardLocked}`}>
                    <FaLock className={styles.lockedIcon} aria-hidden="true" />
                    <span className={styles.ownedName}>{item.name}</span>
                    <span className={styles.ownedSource}>
                      Unlocks at Level {item.unlocksAtLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
