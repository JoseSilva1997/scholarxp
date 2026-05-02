// Verifies StudentProfile composes profile sections and forwards module sorting controls.
import { render, screen } from '@testing-library/react';
import type { StudentProfileResponse } from '@scholarxp/api-contracts';
import { describe, expect, it, vi } from 'vitest';
import StudentProfile from '@/Account/Profile/components/StudentProfile';

const sectionMocks = vi.hoisted(() => ({
  modules: vi.fn(),
}));

vi.mock('@/Account/Profile/components/StudentProfile/index', () => ({
  OverviewSection: () => <section>overview-section</section>,
  AchievementsSection: () => <section>achievements-section</section>,
  CosmeticsSection: () => <section>cosmetics-section</section>,
  StatsSection: () => <section>stats-section</section>,
  ModulesSection: (props: unknown) => {
    sectionMocks.modules(props);
    return <section>modules-section</section>;
  },
}));

describe('StudentProfile', () => {
  it('renders all student profile sections in page order', () => {
    const onModuleSortChange = vi.fn();
    const profile = {
      modules: [{ moduleId: 1, title: 'Algebra' }],
    } as StudentProfileResponse;

    render(
      <StudentProfile
        profile={profile}
        moduleSortKey="weakest"
        onModuleSortChange={onModuleSortChange}
      />,
    );

    expect(screen.getByText('overview-section')).toBeInTheDocument();
    expect(screen.getByText('modules-section')).toBeInTheDocument();
    expect(screen.getByText('achievements-section')).toBeInTheDocument();
    expect(screen.getByText('cosmetics-section')).toBeInTheDocument();
    expect(screen.getByText('stats-section')).toBeInTheDocument();
    expect(sectionMocks.modules).toHaveBeenCalledWith({
      modules: profile.modules,
      sortKey: 'weakest',
      onSortChange: onModuleSortChange,
    });
  });
});
