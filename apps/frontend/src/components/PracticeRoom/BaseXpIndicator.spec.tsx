// Verifies retry mode disables the base-XP indicator so review screens don't imply lesson XP is still in play.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BaseXpIndicator from './BaseXpIndicator';

describe('BaseXpIndicator', () => {
  it('renders a disabled label during retry review', () => {
    render(<BaseXpIndicator status="available" disabled />);

    expect(
      screen.getByLabelText('Base XP indicator disabled during retry review'),
    ).toBeInTheDocument();
  });
});
