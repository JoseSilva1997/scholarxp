// Verifies retry mode disables the first-try indicator so review screens don't imply lesson bonuses are still earnable.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FirstTryAccuracyIndicator from '@/Practice-Room/components/FirstTryAccuracyIndicator';

describe('FirstTryAccuracyIndicator', () => {
  it('renders a disabled label during retry review', () => {
    render(<FirstTryAccuracyIndicator status="available" disabled />);

    expect(
      screen.getByLabelText(
        'First-try bonus indicator disabled during retry review',
      ),
    ).toBeInTheDocument();
  });
});
