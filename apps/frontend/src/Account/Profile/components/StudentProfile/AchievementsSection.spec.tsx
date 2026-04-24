// Verifies achievement cards explain their unlock requirements without forcing the section to render all detail copy inline.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StudentProfileResponse } from '@scholarxp/api-contracts';
import AchievementsSection from '@/Account/Profile/components/StudentProfile/AchievementsSection';

const baseProfile: StudentProfileResponse = {
  accountLevel: 3,
  totalAccountXP: 320,
  xpToNextLevel: 80,
  accountProgress: {
    id: 4,
    totalExp: 320,
    level: 3,
    currentLevelExp: 20,
    nextLevelExpRequired: 100,
    xpToNextLevel: 80,
    progressPercent: 20,
    equippedCosmetics: {},
  },
  masterQuestStreak: 2,
  todayQuestProgress: { completed: 1, total: 3 },
  dailyLessonXPTrack: null,
  modules: [],
  questHistorySummary: {
    totalCompleted: 8,
    perfectDays: 0,
  },
};

describe('AchievementsSection', () => {
  it('opens a modal that explains the requirement for locked achievements', async () => {
    render(<AchievementsSection profile={baseProfile} />);

    fireEvent.click(screen.getByRole('button', { name: 'View details for 25 Quests' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Complete 25 daily quests.')).toBeInTheDocument();
    expect(screen.getByText('8 of 25 daily quests completed.')).toBeInTheDocument();
    expect(screen.getByText('17 more daily quests needed.')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('closes the modal on Escape and shows completed copy for earned achievements', async () => {
    render(
      <AchievementsSection
        profile={{
          ...baseProfile,
          questHistorySummary: {
            totalCompleted: 14,
            perfectDays: 1,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View details for Quest Rookie' }));

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('14 of 10 daily quests completed.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
