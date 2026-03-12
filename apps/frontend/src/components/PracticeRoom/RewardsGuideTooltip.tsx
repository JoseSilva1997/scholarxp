// Displays a circular info icon in the practice-room header. On hover (or
// focus) a speech-bubble tooltip appears explaining how the reward indicators
// work. Implemented with pure CSS :hover + :focus-within so no JS state is
// needed and keyboard users can still access it via Tab/focus.
import { FaCircleInfo } from 'react-icons/fa6';
import styles from './RewardsGuideTooltip.module.css';

export default function RewardsGuideTooltip() {
  return (
    // tabIndex so keyboard users can focus the container and see the tooltip.
    <div className={styles.wrapper} tabIndex={0} role="note" aria-label="Rewards guide">
      <FaCircleInfo className={styles.icon} aria-hidden="true" />
      {/* Speech bubble — shown via CSS :hover/:focus-within on the wrapper.
          role="tooltip" lets screen readers announce the content on focus. */}
      <div className={styles.bubble} role="tooltip">
        {/* Tail is a pure-CSS triangle rendered via ::before on .bubble */}
        <p className={styles.heading}>How rewards work</p>
        <ul className={styles.list}>
          <li>
            <strong>⚡ Base XP</strong> — earned the first time you answer a
            question correctly. As long as ⚡ is available, a correct answer on
            this question can still count toward your streak.
          </li>
          <li>
            <strong>🎯 First-try bonus</strong> — Earned by getting the question
            right on the first try without a hint. You lose it if you answer
            wrong or unlock a hint before submitting.
          </li>
          <li>
            <strong>🔥 Session streak</strong> — tracks your consecutive
            first-attempt wins this session. Pips light up at 30%, 50%, and
            100% of questions for XP bonuses (minimum 3-question streak to start earning). 
            Streak resets to 0 on any wrong answer.
          </li>
        </ul>
      </div>
    </div>
  );
}
