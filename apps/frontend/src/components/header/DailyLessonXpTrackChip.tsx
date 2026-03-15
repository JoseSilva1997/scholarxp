// DailyLessonXpTrackChip renders the standalone daily lesson XP pacing rule so students can see the anti-grind track without quest context.
import { useState, useRef, useEffect } from 'react';
import { BsInfoCircle, BsLightningChargeFill } from 'react-icons/bs';
import type { DailyLessonXpTrackResponse, DailyLessonXpTrackStep } from '@scholarxp/api-contracts';
import { useDailyLessonXpTrackQuery } from '@/hooks/queries/useRewardsQueries';
import styles from './DailyLessonXpTrackChip.module.css';

type DailyLessonXpTrackChipProps = {
  userId: number;
};

const DEFAULT_TRACK: DailyLessonXpTrackResponse = {
  dayKeyUtc: '',
  completedLessonsToday: 0,
  nextRewardXp: 100,
  resetsAtUtc: '',
  steps: [
    { key: 'first_completion', rewardXp: 100, state: 'active' },
    { key: 'second_completion', rewardXp: 25, state: 'upcoming' },
    { key: 'practice', rewardXp: 0, state: 'upcoming' },
  ],
};

function resolveStepLabel(step: DailyLessonXpTrackStep): string {
  if (step.key === 'practice') {
    return 'Practice';
  }

  return `+${step.rewardXp}`;
}

function buildAccessibleSummary(track: DailyLessonXpTrackResponse): string {
  if (track.nextRewardXp > 0) {
    return `Daily lesson XP track. ${track.completedLessonsToday} lesson completions recorded today. Your next completed lesson grants ${track.nextRewardXp} account XP.`;
  }

  return `Daily lesson XP track. ${track.completedLessonsToday} lesson completions recorded today. Today's extra lesson account XP has been exhausted, so additional lessons are for practice only.`;
}

export default function DailyLessonXpTrackChip({
  userId,
}: DailyLessonXpTrackChipProps) {
  const dailyLessonXpTrackQuery = useDailyLessonXpTrackQuery(true, userId);
  const track = dailyLessonXpTrackQuery.data ?? DEFAULT_TRACK;
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const targetNode = event.target;
      if (!(targetNode instanceof Node)) {
        return;
      }
      if (wrapperRef.current?.contains(targetNode)) {
        return;
      }
      setIsPopoverOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isPopoverOpen]);

  const renderContents = () => (
    <>
      <span className={styles.screenReaderLabel}>
        {buildAccessibleSummary(track)}
      </span>
      {/* Header row: eyebrow label on left, info icon on right above the track */}
      <div className={styles.headerRow}>
        <div className={styles.identity}>
          <BsLightningChargeFill className={styles.icon} aria-hidden="true" />
          <span className={styles.eyebrow}>Lesson XP</span>
        </div>
        <div
          className={styles.infoWrapper}
          tabIndex={0}
          role="note"
          aria-label="Daily lesson XP help"
          data-testid="daily-lesson-xp-help"
        >
          <BsInfoCircle className={styles.infoIcon} aria-hidden="true" />
          <div className={styles.infoBubble} role="tooltip">
            <p className={styles.infoHeading}>How lesson XP works</p>
            <p className={styles.infoText}>
              Your first newly completed lesson today grants +100 account XP.
            </p>
            <p className={styles.infoText}>
              Your second grants +25, then the track shifts to practice-only.
            </p>
            <p className={styles.infoText}>
              Spacing out lessons gives you more time to reflect and absorb, 
              and helps you build a sustainable habit.
            </p>
            <p className={styles.infoText}>
              The track resets at midnight UTC.
            </p>
          </div>
        </div>
      </div>
      {/* Track below the header row */}
      <div className={styles.track} aria-hidden="true">
        {track.steps.map((step) => (
          <span
            key={step.key}
            data-testid={`daily-lesson-xp-step-${step.key}`}
            className={`${styles.step} ${
              step.state === 'earned'
                ? styles.stepEarned
                : step.state === 'active'
                  ? styles.stepActive
                  : styles.stepUpcoming
            } ${step.key === 'practice' ? styles.stepPractice : ''}`.trim()}
          >
            {step.key !== 'practice' && (
              <BsLightningChargeFill className={styles.stepIcon} aria-hidden="true" />
            )}
            <span className={styles.stepLabel}>{resolveStepLabel(step)}</span>
          </span>
        ))}
      </div>
    </>
  );

  return (
    <div className={styles.chipGroup} data-testid="daily-lesson-xp-track-group" ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.mobileTrigger} ${isPopoverOpen ? styles.mobileTriggerActive : ''}`}
        aria-label={buildAccessibleSummary(track)}
        aria-expanded={isPopoverOpen}
        onClick={() => setIsPopoverOpen(!isPopoverOpen)}
      >
        <BsLightningChargeFill className={styles.iconTrigger} aria-hidden="true" />
      </button>

      <div
        className={`${styles.chipContent} ${isPopoverOpen ? styles.popoverOpen : ''}`}
        role="group"
        aria-label={buildAccessibleSummary(track)}
        data-testid="daily-lesson-xp-track-chip"
      >
        {renderContents()}
      </div>
    </div>
  );
}
