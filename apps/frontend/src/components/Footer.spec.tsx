// Verifies Footer renders product identity and legal links for the public shell.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Footer from './Footer';

describe('Footer', () => {
  it('renders brand and legal links', () => {
    render(<Footer />);

    expect(screen.getByText('ScholarXP™')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the privacy policy' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View terms of service' })).toBeInTheDocument();
  });
});
