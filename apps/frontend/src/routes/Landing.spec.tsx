// Verifies landing route content renders key product messaging and feature highlights.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Landing from './Landing';

describe('Landing route', () => {
  it('renders hero and feature highlight cards', () => {
    render(<Landing />);

    expect(
      screen.getByRole('heading', {
        name: 'Keep students practicing—without piling on more work.',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('Daily bite-sized practice')).toBeInTheDocument();
    expect(screen.getByText('XP without the grind')).toBeInTheDocument();
    expect(screen.getByText('LTI-native by design')).toBeInTheDocument();
  });
});
