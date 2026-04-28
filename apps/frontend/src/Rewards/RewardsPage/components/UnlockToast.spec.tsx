// Verifies unlock toast summarizes unlocked items and supports dismiss/view actions.
import { fireEvent, render, screen } from '@testing-library/react';
import type { HTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UnlockToast from '@/Rewards/RewardsPage/components/UnlockToast';

const navigateMock = vi.fn();

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

const item = {
  id: 'aurora',
  name: 'Aurora',
  description: 'Green',
  rarity: 'rare',
  slot: 'theme',
  unlocksAtLevel: 10,
} as const;

describe('UnlockToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing without unlocked items', () => {
    const { container } = render(<UnlockToast items={[]} onDismiss={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it('dismisses or navigates to rewards after showing unlocked item names', () => {
    const onDismiss = vi.fn();
    render(<UnlockToast items={[item, { ...item, id: 'ember', name: 'Ember' }]} onDismiss={onDismiss} />);

    expect(screen.getByText('2 Cosmetics Unlocked!')).toBeInTheDocument();
    expect(screen.getByText('Aurora, Ember')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(navigateMock).toHaveBeenCalledWith('/main/rewards');
  });
});
