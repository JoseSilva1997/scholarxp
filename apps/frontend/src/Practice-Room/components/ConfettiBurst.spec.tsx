// Verifies confetti burst renders deterministic particles and removes them after the animation window.
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConfettiBurst from '@/Practice-Room/components/ConfettiBurst';

describe('ConfettiBurst', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders particles and auto-removes after animation completes', () => {
    const { container } = render(<ConfettiBurst />);

    expect(container.querySelectorAll('span')).toHaveLength(18);

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.queryByText('', { selector: 'span' })).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });
});
