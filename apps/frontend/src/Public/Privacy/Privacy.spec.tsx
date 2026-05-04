// Verifies the static privacy page exposes the policy headings users need.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Privacy from '@/Public/Privacy/Privacy';

describe('Privacy', () => {
  it('renders policy title, update date, and core sections', () => {
    render(<Privacy />);

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText('Last updated: April 04, 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Information We Collect' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Choices' })).toBeInTheDocument();
  });
});
