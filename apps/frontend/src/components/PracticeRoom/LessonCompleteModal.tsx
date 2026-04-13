// Celebrates the first-time lesson completion with a short blocking animation
// so XP feedback can be intentionally revealed only after the learner continues.
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useCompletionMedal } from '@/rewards/useCompletionMedal';
import styles from './LessonCompleteModal.module.css';

type LessonCompleteModalProps = {
  isOpen: boolean;
  unitTitle?: string;
  onDismiss: () => void;
};

const DISMISS_READY_DELAY_MS = 1800;

export default function LessonCompleteModal({
  isOpen,
  unitTitle,
  onDismiss,
}: LessonCompleteModalProps) {
  const { src: medalImage, scale: medalScale } = useCompletionMedal();
  const [isDismissReady, setIsDismissReady] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // The CTA waits until the core drop/rays/stamp sequence has finished so the
    // celebration remains readable instead of being skipped instantly.
    const timeoutId = window.setTimeout(() => {
      setIsDismissReady(true);
    }, DISMISS_READY_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="lesson-complete-title">
      <div className={styles.modal}>
        <div className={styles.scene} aria-hidden="true">
          <motion.div
            className={styles.rays}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          />
          <motion.img
            src={medalImage}
            alt=""
            className={styles.medal}
            initial={{ y: -220, scale: 0.88 * medalScale, rotate: -8, opacity: 0 }}
            animate={{ y: 0, scale: medalScale, rotate: 0, opacity: 1 }}
            transition={{
              y: { duration: 0.75, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.75, ease: 'easeOut' },
              rotate: { duration: 0.75, ease: 'easeOut' },
              opacity: { duration: 0.2 },
            }}
          />

          <motion.div
            className={styles.stamp}
            initial={{ opacity: 0, scale: 1.6, rotate: -14 }}
            animate={{ opacity: 1, scale: 1, rotate: -6 }}
            transition={{ delay: 1.05, duration: 0.32, ease: 'easeOut' }}
          >
            Lesson complete
          </motion.div>
        </div>

        <div className={styles.copyBlock}>
          <h2 id="lesson-complete-title" className={styles.title}>
            {`${unitTitle}`} lesson complete!
          </h2>
        </div>

        <button
          type="button"
          className={styles.dismissButton}
          onClick={onDismiss}
          disabled={!isDismissReady}
        >
          {isDismissReady ? 'Continue' : 'Finishing…'}
        </button>
      </div>
    </div>
  );
}
