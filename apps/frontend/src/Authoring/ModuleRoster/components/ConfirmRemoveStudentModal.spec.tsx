// Verifies remove-student modal renders destructive copy and protects actions while submitting.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmRemoveStudentModal from '@/Authoring/ModuleRoster/components/ConfirmRemoveStudentModal';

describe('ConfirmRemoveStudentModal', () => {
  it('renders nothing while closed', () => {
    render(
      <ConfirmRemoveStudentModal
        isOpen={false}
        studentName="Ada"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal content and calls confirm/cancel actions', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmRemoveStudentModal
        isOpen
        studentName="Ada"
        errorMessage="Could not remove student."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Remove student' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not remove student.');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove student' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables actions while removal is submitting', () => {
    render(
      <ConfirmRemoveStudentModal
        isOpen
        studentName="Ada"
        isSubmitting
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Removing…' })).toBeDisabled();
  });
});
