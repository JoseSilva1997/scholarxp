// Verifies non-plain proficiency badge variants render their level and small-size branch.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EliteBadge from '@/Rewards/components/ProficiencyBadge/variants/EliteBadge';
import LegendBadge from '@/Rewards/components/ProficiencyBadge/variants/LegendBadge';
import MasterBadge from '@/Rewards/components/ProficiencyBadge/variants/MasterBadge';
import OrnateBadge from '@/Rewards/components/ProficiencyBadge/variants/OrnateBadge';

describe('proficiency badge variants', () => {
  it('renders ornate, elite, master, and legend badge levels', () => {
    render(
      <>
        <OrnateBadge level={5} small={false} />
        <OrnateBadge level={6} small />
        <EliteBadge level={29} small={false} />
        <EliteBadge level={30} small />
        <MasterBadge level={55} small />
        <MasterBadge level={56} small={false} />
        <LegendBadge level={80} small={false} />
        <LegendBadge level={81} small />
      </>,
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('29')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('56')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('81')).toBeInTheDocument();
  });
});
