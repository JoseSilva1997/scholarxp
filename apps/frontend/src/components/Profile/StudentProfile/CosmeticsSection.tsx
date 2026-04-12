// Compact cosmetics picker on the student profile: one row per slot showing the equipped item and swap options.
import { useNavigate } from 'react-router-dom';
import { BsGift } from 'react-icons/bs';
import { FaCheck } from 'react-icons/fa6';
import { ORDERED_SLOTS, SLOT_DISPLAY, getCatalogBySlot, useCosmetics } from '@/rewards';
import styles from '../StudentProfile.module.css';

export default function CosmeticsSection() {
  const { level, equipped, equipCosmetic, isEquipping } = useCosmetics();
  const navigate = useNavigate();

  return (
    <section className={styles.cosmeticsSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Cosmetics</h2>
        <button
          type="button"
          className={styles.cosmeticsViewAll}
          onClick={() => navigate('/main/rewards')}
        >
          View all rewards
        </button>
      </div>

      <div className={styles.cosmeticsGrid}>
        {ORDERED_SLOTS.map((slot) => {
          const display = SLOT_DISPLAY[slot];
          const items = getCatalogBySlot(slot);
          const unlocked = items.filter((item) => item.unlocksAtLevel <= level);
          // Single-option slots get a compact display — there's nothing to swap.
          if (unlocked.length <= 1) return null;

          const equippedId = equipped[slot];

          return (
            <div key={slot} className={styles.cosmeticsSlot}>
              <span className={styles.cosmeticsSlotLabel}>{display.title}</span>
              <div className={styles.cosmeticsOptions}>
                {unlocked.map((item) => {
                  const active = item.id === equippedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.cosmeticsOption} ${active ? styles.cosmeticsOptionActive : ''}`}
                      onClick={() => { if (!active) void equipCosmetic(slot, item.id); }}
                      disabled={isEquipping || active}
                      title={item.name}
                    >
                      {item.name}
                      {active ? (
                        <FaCheck className={styles.cosmeticsCheckIcon} aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint when no multi-option slots exist yet (very low level students). */}
      {ORDERED_SLOTS.every((slot) => {
        const unlocked = getCatalogBySlot(slot).filter((item) => item.unlocksAtLevel <= level);
        return unlocked.length <= 1;
      }) ? (
        <div className={styles.cosmeticsEmpty}>
          <BsGift className={styles.cosmeticsEmptyIcon} aria-hidden="true" />
          <p className={styles.cosmeticsEmptyText}>
            Keep levelling up to unlock cosmetics you can swap here!
          </p>
        </div>
      ) : null}
    </section>
  );
}
