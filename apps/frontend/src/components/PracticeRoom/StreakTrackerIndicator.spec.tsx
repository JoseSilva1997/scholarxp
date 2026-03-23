// Verifies StreakIndicator renders the correct accessible label, badge, and pip
// states for each tier boundary, and that the dormant state has no count badge.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StreakIndicator from './StreakTrackerIndicator';

describe('StreakIndicator', () => {
  describe('units with fewer than 4 questions (streak mechanic suppressed)', () => {
    it('stays dormant for any streak when totalQuestions < 4', () => {
      // Mirrors the backend totalQuestions < 4 guard — no tier should activate.
      for (const totalQuestions of [0, 1, 2, 3]) {
        const { unmount } = render(
          <StreakIndicator currentStreak={10} highestStreak={0} totalQuestions={totalQuestions} isStreakInitialized={true} />,
        );
        // Dormant label has no "— N in a row" suffix and no visible badge.
        expect(screen.getByLabelText('No streak yet')).toBeInTheDocument();
        expect(screen.queryByText('10')).not.toBeInTheDocument();
        unmount();
      }
    });

    it('shows no badge or pips on ineligible units even at streak 0', () => {
      render(<StreakIndicator currentStreak={0} highestStreak={0} totalQuestions={2} isStreakInitialized={true} />);
      // Ineligible units never render a badge or pips.
      expect(screen.getByLabelText('No streak yet')).toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pip-tier1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pip-tier2')).not.toBeInTheDocument();
    });
  });

  describe('tier 0 — eligible unit but streak not yet reached threshold', () => {
    it('shows the building label with badge even when below the first bonus threshold', () => {
      // 10-question unit: tier-1 threshold = 3. Streak of 2 is below it,
      // but badge still renders so students can see progress building toward the bonus.
      render(<StreakIndicator currentStreak={2} highestStreak={0} totalQuestions={10} isStreakInitialized={true} />);
      expect(screen.getByLabelText('Streak: building — 2 in a row')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows badge with 0 on eligible units before any streak is built', () => {
      render(<StreakIndicator currentStreak={0} highestStreak={0} totalQuestions={10} isStreakInitialized={true} />);
      expect(screen.getByLabelText('No streak yet — 0 in a row')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('tier 1 — warm (≥ 30 % of total questions)', () => {
    it('shows "Streak: warm" label and streak count badge', () => {
      // 10-question unit: tier-1 at 3, tier-2 at 5.
      render(<StreakIndicator currentStreak={3} highestStreak={0} totalQuestions={10} isStreakInitialized={true} />);
      expect(screen.getByLabelText('Streak: warm — 3 in a row')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('remains tier 1 while streak stays between 30 % and 50 % thresholds', () => {
      render(<StreakIndicator currentStreak={4} highestStreak={0} totalQuestions={10} isStreakInitialized={true} />);
      expect(screen.getByLabelText('Streak: warm — 4 in a row')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('tier 2 — hot (≥ 50 % of total questions)', () => {
    it('shows "Streak: hot" label and streak count badge', () => {
      // 10-question unit: tier-2 at ceil(10*0.5) = 5.
      render(<StreakIndicator currentStreak={5} highestStreak={0} totalQuestions={10} isStreakInitialized={true} />);
      expect(screen.getByLabelText('Streak: hot — 5 in a row')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('tier 3 — blaze (100 % of total questions)', () => {
    it('shows "Streak: blazing" label and streak count badge on a perfect run', () => {
      render(<StreakIndicator currentStreak={10} highestStreak={0} totalQuestions={10} isStreakInitialized={true} />);
      expect(screen.getByLabelText('Streak: blazing — 10 in a row')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  describe('threshold clamping on small eligible units', () => {
    it('hits tier 2 directly at streak=3 on a 4-question unit (30% and 50% both clamp to 3)', () => {
      // 4-question: Math.max(3, ceil(4*0.3)=2)=3 and Math.max(3, ceil(4*0.5)=2)=3 → both collapse.
      render(<StreakIndicator currentStreak={3} highestStreak={0} totalQuestions={4} isStreakInitialized={true} />);
      expect(screen.getByLabelText('Streak: hot — 3 in a row')).toBeInTheDocument();
    });

    it('reaches tier 3 at a perfect streak on a 4-question unit', () => {
      render(<StreakIndicator currentStreak={4} highestStreak={0} totalQuestions={4} isStreakInitialized={true} />);
      expect(screen.getByLabelText('Streak: blazing — 4 in a row')).toBeInTheDocument();
    });
  });

  describe('pip states — bonus tier indicators', () => {
    // Helper: returns [pip1, pip2] elements.
    const getPips = () => [
      screen.getByTestId('pip-tier1'),
      screen.getByTestId('pip-tier2'),
    ];

    it('both pips are inactive before the first threshold is reached', () => {
      // currentStreak=2, tier1=3 → neither pip active.
      render(<StreakIndicator currentStreak={2} highestStreak={0} totalQuestions={10} isStreakInitialized={true} />);
      const [pip1, pip2] = getPips();
      expect(pip1.className).toContain('pipInactive');
      expect(pip2.className).toContain('pipInactive');
    });

    it('pip1 is active (first-time bonus) when currentStreak reaches tier-1 threshold and highest has not been there yet', () => {
      // 10-question unit: tier1=3. currentStreak=3, highestStreak=0 → pip1 active.
      render(<StreakIndicator currentStreak={3} highestStreak={0} totalQuestions={10} isStreakInitialized={true} />);
      const [pip1, pip2] = getPips();
      expect(pip1.className).toContain('pipActive');
      expect(pip2.className).toContain('pipInactive');
    });

    it('pip1 becomes claimed and pip2 becomes active when tier-2 threshold is first reached', () => {
      // highestStreak=3 means tier-1 bonus already claimed; currentStreak=5 hits tier-2.
      render(<StreakIndicator currentStreak={5} highestStreak={3} totalQuestions={10} isStreakInitialized={true} />);
      const [pip1, pip2] = getPips();
      expect(pip1.className).toContain('pipClaimed');
      expect(pip2.className).toContain('pipActive');
    });

    it('both pips are claimed once both bonuses have been collected', () => {
      // highestStreak=5 covers both tier1 (3) and tier2 (5).
      render(<StreakIndicator currentStreak={5} highestStreak={5} totalQuestions={10} isStreakInitialized={true} />);
      const [pip1, pip2] = getPips();
      expect(pip1.className).toContain('pipClaimed');
      expect(pip2.className).toContain('pipClaimed');
    });

    it('pip1 is claimed and pip2 is inactive when streak is lost after earning tier-1', () => {
      // Student earned tier-1 (highestStreak=3) then lost their streak (currentStreak=1).
      // pip1 claimed, pip2 inactive — reaching 50% again would give pip2 a bonus.
      render(<StreakIndicator currentStreak={1} highestStreak={3} totalQuestions={10} isStreakInitialized={true} />);
      const [pip1, pip2] = getPips();
      expect(pip1.className).toContain('pipClaimed');
      expect(pip2.className).toContain('pipInactive');
    });

    it('pip1 is claimed with no bonus and pip2 is active when tier-2 is first reached after losing and rebuilding streak', () => {
      // Student already earned tier-1, lost streak, rebuilt past tier-2 for the first time.
      // highestStreak=3 (tier-1 claimed), currentStreak=5 (tier-2 first reach).
      render(<StreakIndicator currentStreak={5} highestStreak={3} totalQuestions={10} isStreakInitialized={true} />);
      const [pip1, pip2] = getPips();
      expect(pip1.className).toContain('pipClaimed');
      expect(pip2.className).toContain('pipActive');
    });

    it('no pips are rendered on ineligible units (totalQuestions < 4)', () => {
      render(<StreakIndicator currentStreak={5} highestStreak={0} totalQuestions={3} isStreakInitialized={true} />);
      expect(screen.queryByTestId('pip-tier1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pip-tier2')).not.toBeInTheDocument();
    });
  });

  describe('variant="daily-practice"', () => {
    it('always shows badge regardless of totalQuestions count', () => {
      // Daily practice sessions can have any number of questions; the streak
      // mechanic is never suppressed based on set size.
      for (const totalQuestions of [0, 1, 2, 3]) {
        const { unmount } = render(
          <StreakIndicator
            currentStreak={5}
            highestStreak={0}
            totalQuestions={totalQuestions}
            isStreakInitialized={true}
            variant="daily-practice"
          />,
        );
        expect(screen.getByText('5')).toBeInTheDocument();
        unmount();
      }
    });

    it('never renders pip threshold indicators', () => {
      // No XP bonuses fire in daily practice so pips would be misleading.
      render(
        <StreakIndicator
          currentStreak={10}
          highestStreak={5}
          totalQuestions={10}
          isStreakInitialized={true}
          variant="daily-practice"
        />,
      );
      expect(screen.queryByTestId('pip-tier1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pip-tier2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pip-tier3')).not.toBeInTheDocument();
    });

    it('shows tier 0 (no streak) when currentStreak is 0', () => {
      render(
        <StreakIndicator
          currentStreak={0}
          highestStreak={0}
          totalQuestions={5}
          isStreakInitialized={true}
          variant="daily-practice"
        />,
      );
      expect(screen.getByLabelText('No streak yet — 0 in a row')).toBeInTheDocument();
    });

    it('uses absolute thresholds: streak of 1 reaches tier 1', () => {
      render(
        <StreakIndicator
          currentStreak={1}
          highestStreak={0}
          totalQuestions={5}
          isStreakInitialized={true}
          variant="daily-practice"
        />,
      );
      expect(screen.getByLabelText('Streak: building — 1 in a row')).toBeInTheDocument();
    });

    it('uses absolute thresholds: streak of 3 reaches tier 2 (warm)', () => {
      render(
        <StreakIndicator
          currentStreak={3}
          highestStreak={0}
          totalQuestions={5}
          isStreakInitialized={true}
          variant="daily-practice"
        />,
      );
      expect(screen.getByLabelText('Streak: warm — 3 in a row')).toBeInTheDocument();
    });

    it('uses absolute thresholds: streak of 6 reaches tier 3 (hot)', () => {
      render(
        <StreakIndicator
          currentStreak={6}
          highestStreak={0}
          totalQuestions={10}
          isStreakInitialized={true}
          variant="daily-practice"
        />,
      );
      expect(screen.getByLabelText('Streak: hot — 6 in a row')).toBeInTheDocument();
    });

    it('uses absolute thresholds: streak of 10 reaches tier 4 (blazing)', () => {
      render(
        <StreakIndicator
          currentStreak={10}
          highestStreak={0}
          totalQuestions={5}
          isStreakInitialized={true}
          variant="daily-practice"
        />,
      );
      expect(screen.getByLabelText('Streak: blazing — 10 in a row')).toBeInTheDocument();
    });
  });
});
