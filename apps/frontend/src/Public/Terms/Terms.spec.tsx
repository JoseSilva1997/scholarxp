// Verifies the static terms page exposes license and noncommercial-use sections.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Terms from '@/Public/Terms/Terms';

describe('Terms', () => {
  it('renders terms title, update date, and license sections', () => {
    render(<Terms />);

    expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByText('Last updated: April 04, 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Permitted Use' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No Warranty' })).toBeInTheDocument();
  });
});
