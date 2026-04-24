// Compact cosmetics equip panel on the student profile: one row per slot with inline option chips.
import { useNavigate } from 'react-router-dom';
import type { CatalogItem } from '@/Rewards/cosmetics';
import { BsGift } from 'react-icons/bs';
import { FaCheck } from 'react-icons/fa6';
import { ORDERED_SLOTS, SLOT_DISPLAY, getCatalogBySlot, useCosmetics } from '@/Rewards/cosmetics';
import { themeFamilyFromRewardId } from '@/context/theme-context';
import styles from '@/Account/Profile/components/StudentProfile.module.css';

const DEFAULT_THEME_CHIP: Pick<CatalogItem, 'id' | 'name' | 'description'> = {
  id: 'default',
  name: 'Default - Theme',
  description: 'Balanced base palette. Use the header toggle to switch its light and dark variants.',
};

function getThemeChipItems(items: CatalogItem[]): CatalogItem[] {
  return items
    .filter((item) => item.id !== 'dark')
    .map((item) => (
      item.id === 'light'
        ? { ...item, ...DEFAULT_THEME_CHIP }
        : item
    ));
}

function getVisibleItems(slot: (typeof ORDERED_SLOTS)[number], items: CatalogItem[]): CatalogItem[] {
  if (slot !== 'theme') {
    return items;
  }
  return getThemeChipItems(items);
}

function getActiveItemId(slot: (typeof ORDERED_SLOTS)[number], equippedId: string): string {
  if (slot !== 'theme' || (equippedId !== 'light' && equippedId !== 'dark')) {
    return equippedId;
  }
  return themeFamilyFromRewardId(equippedId);
}

function getRewardIdToEquip(slot: (typeof ORDERED_SLOTS)[number], itemId: string): string {
  if (slot === 'theme' && itemId === 'default') {
    return 'light';
  }
  return itemId;
}

export default function CosmeticsSection() {
  const { level, equipped, equipCosmetic, isEquipping } = useCosmetics();
  const navigate = useNavigate();

  // Only show slots where the user has at least two options — single-option slots have nothing to swap.
  const activeSlots = ORDERED_SLOTS.filter((slot) => {
    const unlocked = getCatalogBySlot(slot).filter((item) => item.unlocksAtLevel <= level);
    return unlocked.length > 1;
  });

  return (
    <section className={styles.cosmeticsSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Cosmetics</h2>
        <button
          type="button"
          className={styles.cosmeticsViewAll}
          onClick={() => navigate('/main/rewards')}
        >
          View rewards
        </button>
      </div>

      {activeSlots.length > 0 ? (
        <div className={styles.cosmeticsRows}>
          {activeSlots.map((slot) => {
            const display = SLOT_DISPLAY[slot];
            const unlocked = getCatalogBySlot(slot).filter((item) => item.unlocksAtLevel <= level);
            const visibleItems = getVisibleItems(slot, unlocked);
            const equippedId = getActiveItemId(slot, equipped[slot]);

            return (
              <div key={slot} className={styles.cosmeticsRow}>
                <span className={styles.cosmeticsRowLabel}>{display.title}</span>
                <div className={styles.cosmeticsRowOptions}>
                  {visibleItems.map((item) => {
                    const active = item.id === equippedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.cosmeticChip} ${active ? styles.cosmeticChipActive : ''}`}
                        onClick={() => {
                          if (!active) void equipCosmetic(slot, getRewardIdToEquip(slot, item.id));
                        }}
                        disabled={isEquipping || active}
                        title={item.name}
                      >
                        {item.name}
                        {active ? (
                          <FaCheck className={styles.cosmeticChipCheck} aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.cosmeticsEmpty}>
          <BsGift className={styles.cosmeticsEmptyIcon} aria-hidden="true" />
          <p className={styles.cosmeticsEmptyText}>
            Keep levelling up to unlock cosmetics you can swap here!
          </p>
        </div>
      )}
    </section>
  );
}
