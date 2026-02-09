// Verifies MainSection shell wraps content and forwards optional class names.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MainSection from './MainSection';

describe('MainSection', () => {
  it('renders children inside section container', () => {
    render(
      <MainSection>
        <div>inner-content</div>
      </MainSection>,
    );

    expect(screen.getByText('inner-content')).toBeInTheDocument();
  });

  it('applies custom class name', () => {
    const { container } = render(<MainSection className="custom">x</MainSection>);
    expect(container.querySelector('section')?.className).toContain('custom');
  });
});
