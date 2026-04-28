// Verifies scholar background renders a large hidden icon wallpaper.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScholarBackground from '@/Rewards/RewardsPage/components/ScholarBackground';

describe('ScholarBackground', () => {
  it('renders the decorative wallpaper as hidden content', () => {
    const { container } = render(<ScholarBackground />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('span')).toHaveLength(1000);
  });
});
