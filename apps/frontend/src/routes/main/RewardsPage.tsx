// Rewards browse page: shows every cosmetic grouped by slot with unlock status and equip controls.
import { BsGift } from 'react-icons/bs';
import MainSection from '../../components/MainSection';
import SlotGroup from '../../components/Rewards/SlotGroup';
import { ORDERED_SLOTS, SLOT_DISPLAY } from '@/rewards';
import { useRewardsPageState } from '../../hooks/page-state/useRewardsPageState';
import styles from './RewardsPage.module.css';

export default function RewardsPage() {
  const {
    level,
    slotGroups,
    nextUnlockName,
    nextUnlockLevel,
    equipped,
    equipCosmetic,
    isEquipping,
    activeSlotFilter,
    setActiveSlotFilter,
  } = useRewardsPageState();

  return (
    <MainSection className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Rewards</h1>
            <p className={styles.subtitle}>
              Unlock cosmetics as you level up. Equip them to make ScholarXP yours.
            </p>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <BsGift className={styles.statIcon} aria-hidden="true" />
              <div className={styles.statInfo}>
                <span className={styles.statValue}>Level {level}</span>
                <span className={styles.statLabel}>Current level</span>
              </div>
            </div>

            {nextUnlockName ? (
              <div className={styles.statCard}>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{nextUnlockName}</span>
                  <span className={styles.statLabel}>
                    Next unlock at Level {nextUnlockLevel}
                  </span>
                </div>
              </div>
            ) : (
              <div className={styles.statCard}>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>All unlocked!</span>
                  <span className={styles.statLabel}>
                    Every cosmetic is yours
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slot filter chips */}
      <div className={styles.filterRow}>
        <button
          type="button"
          className={`${styles.filterChip} ${activeSlotFilter === null ? styles.filterChipActive : ''}`}
          onClick={() => setActiveSlotFilter(null)}
        >
          All
        </button>
        {ORDERED_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            className={`${styles.filterChip} ${activeSlotFilter === slot ? styles.filterChipActive : ''}`}
            onClick={() => setActiveSlotFilter(slot)}
          >
            {SLOT_DISPLAY[slot].title}
          </button>
        ))}
      </div>

      {/* Slot groups */}
      <div className={styles.slotList}>
        {slotGroups.map((group) => (
          <SlotGroup
            key={group.slot}
            display={group.display}
            unlocked={group.unlocked}
            locked={group.locked}
            equippedId={equipped[group.slot as keyof typeof equipped]}
            onEquip={equipCosmetic}
            isEquipping={isEquipping}
          />
        ))}
      </div>
    </MainSection>
  );
}
