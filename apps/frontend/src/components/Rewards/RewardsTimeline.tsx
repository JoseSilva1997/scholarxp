// View-only progression timeline: vertical bar filling to user level, alternating reward branches per milestone.
import { useEffect, useRef, useState } from 'react';
import type { IconType } from 'react-icons';
import {
  FaPalette,
  FaImage,
  FaDroplet,
  FaMedal,
  FaUser,
  FaStar,
  FaAward,
  FaBolt,
} from 'react-icons/fa6';
import type { CosmeticSlot } from '@scholarxp/progression';
import type { CatalogItem } from '@/rewards';
import type {
  TimelineItem,
  TimelineEntry,
  TimelineBandHeader,
  BandRarity,
} from '../../hooks/page-state/useRewardsTimelineState';
import styles from './RewardsTimeline.module.css';

// One icon per slot — kept here rather than in slots.ts so the progression package
// stays framework-agnostic; icon imports only belong in frontend code.
const SLOT_ICON: Record<CosmeticSlot, IconType> = {
  theme: FaPalette,
  background: FaImage,
  expBarColor: FaDroplet,
  proficiencyBadge: FaMedal,
  userBadge: FaUser,
  userBadgeOverlay: FaStar,
  moduleUnitBadge: FaAward,
  answerFeedbackAnim: FaBolt,
};

const RARITY_LABEL: Record<BandRarity, string> = {
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

type RewardsTimelineProps = {
  level: number;
  timelineItems: TimelineItem[];
};

export default function RewardsTimeline({ level, timelineItems }: RewardsTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fillHeight, setFillHeight] = useState('0px');

  useEffect(() => {
    if (!containerRef.current) return;

    const measureHeight = () => {
      if (!containerRef.current) return;
      let measuredHeight = '0px';
      const entries = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>('[data-level]')
      );

      if (entries.length > 0) {
        let lastPassed: HTMLElement | null = null;
        let nextUpcoming: HTMLElement | null = null;
        let lastPassedLevel = 1;
        let nextUpcomingLevel = 100;

        for (const el of entries) {
          const itemLevel = parseInt(el.dataset.level || '0', 10);
          if (itemLevel <= level) {
            lastPassed = el;
            lastPassedLevel = itemLevel;
          } else if (!nextUpcoming) {
            nextUpcoming = el;
            nextUpcomingLevel = itemLevel;
          }
        }

        const getTickCenterY = (el: HTMLElement) => el.offsetTop + 24;

        if (!lastPassed && nextUpcoming) {
          const y0 = 0;
          const y1 = getTickCenterY(nextUpcoming);
          const fraction = level <= 1 ? 0 : (level - 1) / (nextUpcomingLevel - 1);
          measuredHeight = `${y0 + fraction * (y1 - y0)}px`;
        } else if (lastPassed && nextUpcoming) {
          const y0 = getTickCenterY(lastPassed);
          const y1 = getTickCenterY(nextUpcoming);
          const fraction = (level - lastPassedLevel) / (nextUpcomingLevel - lastPassedLevel);
          measuredHeight = `${y0 + fraction * (y1 - y0)}px`;
        } else if (lastPassed && !nextUpcoming) {
          measuredHeight = `100%`;
        }
      } else {
        measuredHeight = `${Math.min(100, Math.max(0, level))}%`;
      }

      setFillHeight(measuredHeight);
    };

    measureHeight();
    window.addEventListener('resize', measureHeight);
    return () => window.removeEventListener('resize', measureHeight);
  }, [level, timelineItems]);

  return (
    <div className={styles.timeline} ref={containerRef}>
      {/* Bar track uses overflow: hidden so the fill's height% clips correctly
          without needing to measure the container in pixels. */}
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ height: fillHeight }} />
      </div>

      {timelineItems.map((item) => {
        if (item.type === 'separator') {
          return <SeparatorRow key={`sep-${item.level}`} />;
        }
        if (item.type === 'band-header') {
          return <BandHeaderRow key={`band-${item.rarity}`} header={item} />;
        }
        return <EntryRow key={`entry-${item.level}`} entry={item} />;
      })}
    </div>
  );
}

function BandHeaderRow({ header }: { header: TimelineBandHeader }) {
  return (
    <div className={styles.bandHeaderRow}>
      <span className={`${styles.rarityChip} ${styles[`rarity_${header.rarity}`]}`}>
        {RARITY_LABEL[header.rarity]}
      </span>
    </div>
  );
}

function SeparatorRow() {
  return (
    <div className={styles.separatorRow}>
      <div className={styles.separatorLine} />
    </div>
  );
}

function EntryRow({ entry }: { entry: TimelineEntry }) {
  const { level, rewards, side, isUnlocked } = entry;
  const isLeft = side === 'left';

  return (
    <div className={styles.entryRow} data-level={level}>
      <div className={`${styles.tick} ${isUnlocked ? styles.tickUnlocked : ''}`} />
      <div
        className={`${styles.arm} ${isLeft ? styles.armLeft : styles.armRight} ${isUnlocked ? styles.armUnlocked : ''}`}
      />
      <div
        className={[
          styles.entryContent,
          isLeft ? styles.entryContentLeft : styles.entryContentRight,
          !isUnlocked ? styles.entryContentLocked : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={styles.levelBadge}>Level {level}</span>
        {rewards.map((reward) => (
          <RewardItem key={`${reward.slot}-${reward.id}`} reward={reward} />
        ))}
      </div>
    </div>
  );
}

function RewardItem({ reward }: { reward: CatalogItem }) {
  const SlotIcon = SLOT_ICON[reward.slot];

  return (
    <div className={styles.rewardItem}>
      <div className={styles.rewardIconWrap}>
        <SlotIcon className={styles.rewardIcon} aria-hidden="true" />
      </div>
      <div className={styles.rewardText}>
        <span className={styles.rewardName}>{reward.name}</span>
        <span className={styles.rewardDesc}>{reward.description}</span>
      </div>
    </div>
  );
}
