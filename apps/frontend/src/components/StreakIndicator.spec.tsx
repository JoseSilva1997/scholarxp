// Verifies StreakIndicator renders the correct accessible label and badge
// for each tier boundary, and that the dormant state has no count badge.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StreakIndicator from './StreakIndicator';

describe('StreakIndicator', () => {
  describe('units with fewer than 4 questions (streak mechanic suppressed)', () => {
    it('stays dormant for any streak when totalQuestions < 4', () => {
      // Mirrors the backend totalQuestions < 4 guard — no tier should activate.
      for (const totalQuestions of [0, 1, 2, 3]) {
        const { unmount } = render(
          <StreakIndicator currentStreak={10} totalQuestions={totalQuestions} />,
        );
        // Dormant label has no "— N in a row" suffix and no visible badge.
        expect(screen.getByLabelText('No streak yet')).toBeInTheDocument();
        expect(screen.queryByText('10')).not.toBeInTheDocument();
        unmount();
      }
    });

    it('shows no badge on ineligible units even at streak 0', () => {
      render(<StreakIndicator currentStreak={0} totalQuestions={2} />);
      // Ineligible units never render a badge — no count suffix on the label.
      expect(screen.getByLabelText('No streak yet')).toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('tier 0 — eligible unit but streak not yet reached threshold', () => {
    it('shows dormant label WITH badge even when below tier-1 threshold', () => {
      // 10-question unit: tier-1 threshold = 3. Streak of 2 is below it,
      // but badge still renders so students can see progress building toward the bonus.
      render(<StreakIndicator currentStreak={2} totalQuestions={10} />);
      expect(screen.getByLabelText('No streak yet — 2 in a row')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows badge with 0 on eligible units before any streak is built', () => {
      render(<StreakIndicator currentStreak={0} totalQuestions={10} />);
      expect(screen.getByLabelText('No streak yet — 0 in a row')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('tier 1 — warm (≥ 30 % of total questions)', () => {
    it('shows "Streak: warm" label and streak count badge', () => {
      // 10-question unit: tier-1 at 3, tier-2 at 5.
      render(<StreakIndicator currentStreak={3} totalQuestions={10} />);
      expect(screen.getByLabelText('Streak: warm — 3 in a row')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('remains tier 1 while streak stays between 30 % and 50 % thresholds', () => {
      render(<StreakIndicator currentStreak={4} totalQuestions={10} />);
      expect(screen.getByLabelText('Streak: warm — 4 in a row')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('tier 2 — hot (≥ 50 % of total questions)', () => {
    it('shows "Streak: hot" label and streak count badge', () => {
      // 10-question unit: tier-2 at ceil(10*0.5) = 5.
      render(<StreakIndicator currentStreak={5} totalQuestions={10} />);
      expect(screen.getByLabelText('Streak: hot — 5 in a row')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('tier 3 — blaze (100 % of total questions)', () => {
    it('shows "Streak: blazing" label and streak count badge on a perfect run', () => {
      render(<StreakIndicator currentStreak={10} totalQuestions={10} />);
      expect(screen.getByLabelText('Streak: blazing — 10 in a row')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  describe('threshold clamping on small eligible units', () => {
    it('hits tier 2 directly at streak=3 on a 4-question unit (30% and 50% both clamp to 3)', () => {
      // 4-question: Math.max(3, ceil(4*0.3)=2)=3 and Math.max(3, ceil(4*0.5)=2)=3 → both collapse.
      render(<StreakIndicator currentStreak={3} totalQuestions={4} />);
      expect(screen.getByLabelText('Streak: hot — 3 in a row')).toBeInTheDocument();
    });

    it('reaches tier 3 at a perfect streak on a 4-question unit', () => {
      render(<StreakIndicator currentStreak={4} totalQuestions={4} />);
      expect(screen.getByLabelText('Streak: blazing — 4 in a row')).toBeInTheDocument();
    });
  });
});
