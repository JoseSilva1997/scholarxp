// Verifies rewards page renders timeline state inside the app content shell.
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import RewardsPage from '@/Rewards/RewardsPage/RewardsPage';
import { useRewardsTimelineState } from '@/Rewards/RewardsPage/page-state/useRewardsTimelineState';

vi.mock('@/MainApp/MainSection/MainSection', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/Rewards/RewardsPage/components/RewardsTimeline', () => ({
  default: ({ level }: { level: number }) => <section>timeline-{level}</section>,
}));

vi.mock('@/Rewards/RewardsPage/page-state/useRewardsTimelineState', () => ({
  useRewardsTimelineState: vi.fn(),
}));

describe('RewardsPage', () => {
  it('renders page heading and forwards timeline state', () => {
    vi.mocked(useRewardsTimelineState).mockReturnValue({
      level: 42,
      timelineItems: [],
    });

    render(<RewardsPage />);

    expect(screen.getByRole('heading', { name: 'Rewards' })).toBeInTheDocument();
    expect(screen.getByText('timeline-42')).toBeInTheDocument();
  });
});
