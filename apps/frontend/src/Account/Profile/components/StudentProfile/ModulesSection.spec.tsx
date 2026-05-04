// Verifies the practice badge copy and guidance shown on student module cards.
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StudentProfileModule } from '@scholarxp/api-contracts';
import { renderWithProviders } from '@/shared/test/utils';
import ModulesSection from '@/Account/Profile/components/StudentProfile/ModulesSection';

const modules: StudentProfileModule[] = [
  {
    moduleId: 7,
    title: 'Molecular Biology',
    proficiencyLevel: 3,
    moduleXP: 450,
    moduleXPMax: 1000,
    completedLessons: 2,
    totalLessons: 4,
    dailyPracticeStatus: 'available',
  },
];

describe('ModulesSection', () => {
  it('renders the practice level badge with clarifying help text', () => {
    renderWithProviders(
      <ModulesSection
        modules={modules}
        sortKey="strongest"
        onSortChange={vi.fn()}
      />,
    );

    const badge = screen.getByText('Practice Lv.3');

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute(
      'title',
      'Practice level reflects cumulative module XP, not a fixed mastery rating.',
    );
  });
});
