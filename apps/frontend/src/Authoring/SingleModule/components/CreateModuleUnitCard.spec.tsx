// Verifies CreateModuleUnitCard CTA wiring so hosts can trigger unit creation from card UI.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreateModuleUnitCard from '@/Authoring/SingleModule/components/CreateModuleUnitCard';

describe('CreateModuleUnitCard', () => {
  it('calls onClick when create button is pressed', () => {
    const onClick = vi.fn();
    render(<CreateModuleUnitCard onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a lesson' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('shows saving copy and disables button while saving', () => {
    render(<CreateModuleUnitCard isSaving />);

    expect(screen.getByText('Creating…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a lesson' })).toBeDisabled();
  });
});
