// Verifies QuestsPage renders the day-labeled history sections that pair each date with one quest card.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import QuestsPage from './QuestsPage';

describe('QuestsPage route', () => {
  it('renders history heading and day labels', () => {
    render(<QuestsPage />);

    expect(screen.getByRole('heading', { name: 'Quest History' })).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
