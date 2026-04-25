// Verifies Footer renders product identity and legal links for the public shell.
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/shared/test/utils';
import Footer from '@/MainApp/Footer/Footer';

describe('Footer', () => {
  it('renders brand and legal links', () => {
    renderWithProviders(<Footer />);

    expect(screen.getByText('ScholarXP™')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the privacy policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('link', { name: 'View terms of service' })).toHaveAttribute('href', '/terms');
  });
});
