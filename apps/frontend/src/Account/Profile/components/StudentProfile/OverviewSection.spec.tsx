// Verifies student profile overview renders progress, quests, and missing track states.
import { render, screen } from '@testing-library/react';
import type { StudentProfileResponse } from '@scholarxp/api-contracts';
import { describe, expect, it } from 'vitest';
import OverviewSection from '@/Account/Profile/components/StudentProfile/OverviewSection';

function buildProfile(overrides: Partial<StudentProfileResponse> = {}): StudentProfileResponse {
  return {
    accountLevel: 7,
    totalAccountXP: 12345,
    xpToNextLevel: 90,
    accountProgress: {
      id: 1,
      totalExp: 12345,
      level: 7,
      currentLevelExp: 210,
      nextLevelExpRequired: 300,
      xpToNextLevel: 90,
      progressPercent: 70,
      equippedCosmetics: {},
    },
    masterQuestStreak: 5,
    todayQuestProgress: { completed: 2, total: 4 },
    dailyLessonXPTrack: {
      dayKeyUtc: '2026-04-28',
      completedLessonsToday: 1,
      nextRewardXp: 25,
      resetsAtUtc: '2026-04-29T00:00:00.000Z',
      steps: [
        { key: 'first_completion', rewardXp: 100, state: 'earned' },
        { key: 'second_completion', rewardXp: 25, state: 'active' },
      ],
    },
    modules: [],
    questHistorySummary: { totalCompleted: 10, perfectDays: 2 },
    ...overrides,
  };
}

describe('OverviewSection', () => {
  it('renders account, quest, and daily track progress', () => {
    render(<OverviewSection profile={buildProfile()} />);

    expect(screen.getByText('Account Level')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();
    expect(screen.getByText('2/4')).toBeInTheDocument();
    expect(screen.getByTitle('100 XP - earned')).toBeInTheDocument();
    expect(screen.getByTitle('25 XP - active')).toBeInTheDocument();
  });

  it('handles zero denominators and missing daily track without crashing', () => {
    render(
      <OverviewSection
        profile={buildProfile({
          accountProgress: {
            ...buildProfile().accountProgress,
            currentLevelExp: 0,
            nextLevelExpRequired: 0,
          },
          todayQuestProgress: { completed: 0, total: 0 },
          dailyLessonXPTrack: null,
        })}
      />,
    );

    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.getByText('No track today')).toBeInTheDocument();
  });
});
