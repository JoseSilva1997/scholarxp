// Verifies QuestsPage placeholder content renders so the route remains test-covered until quest UI is implemented.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import QuestsPage from './QuestsPage';

describe('QuestsPage route', () => {
  it('renders heading and placeholder copy', () => {
    render(<QuestsPage />);

    expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument();
    expect(
      screen.getByText('Daily practice will live here. We will plug in quest selection and progress soon.'),
    ).toBeInTheDocument();
  });
});
