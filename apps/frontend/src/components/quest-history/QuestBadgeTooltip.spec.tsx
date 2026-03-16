// Verifies quest tooltip content and status rendering so reward/state messaging remains accurate.
import { render, screen } from '@testing-library/react';
import { QuestTypeValues, type QuestView } from '@scholarxp/api-contracts';
import { describe, expect, it } from 'vitest';
import QuestBadgeTooltip from './QuestBadgeTooltip';

const baseQuest: QuestView = {
  id: 1,
  moduleId: 1,
  moduleUnitId: null,
  moduleTitle: 'Biology 101',
  moduleUnitTitle: null,
  type: QuestTypeValues.completeDailyPractice,
  tier: 'daily',
  expGranted: 20,
  isCompleted: false,
  progressCurrent: 0,
  progressTarget: 1,
  description: 'Complete today practice.',
  questDateUtc: '2999-01-01',
  generatedAt: '2026-02-19T00:00:00.000Z',
  completedAt: null,
};

describe('QuestBadgeTooltip', () => {
  it('shows available status and earn copy for active incomplete quests', () => {
    render(<QuestBadgeTooltip quest={baseQuest} />);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Module:')).toBeInTheDocument();
    expect(screen.getByText('Info:')).toBeInTheDocument();
    expect(screen.getByText('Reward:')).toBeInTheDocument();
    expect(screen.getByText('Earn 20 XP')).toBeInTheDocument();
  });

  it('shows completed status and received reward copy when quest is completed', () => {
    render(
      <QuestBadgeTooltip
        quest={{
          ...baseQuest,
          isCompleted: true,
          completedAt: '2026-02-19T00:00:00.000Z',
        }}
      />,
    );

    expect(screen.getByText('Quest Completed')).toBeInTheDocument();
    expect(screen.getByText('Received 20 XP')).toBeInTheDocument();
  });

  it('shows missed status and lesson row for past complete_new_unit quests', () => {
    render(
      <QuestBadgeTooltip
        quest={{
          ...baseQuest,
          type: QuestTypeValues.completeNewUnit,
          moduleUnitId: 12,
          moduleUnitTitle: 'Cell Structure',
          questDateUtc: '2000-01-01',
        }}
      />,
    );

    expect(screen.getByText('Quest Missed')).toBeInTheDocument();
    expect(screen.getByText('Lesson:')).toBeInTheDocument();
    expect(screen.getByText('Cell Structure')).toBeInTheDocument();
    expect(screen.getByText('Missed 20 XP')).toBeInTheDocument();
  });
});
