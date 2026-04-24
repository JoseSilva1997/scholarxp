// Verifies confirm-publish modal control flow and submit state copy.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmPublishModal from '@/Authoring/SingleModule/components/ConfirmPublishModal';

describe('ConfirmPublishModal', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <ConfirmPublishModal isOpen={false} title="T" body="B" confirmLabel="Go" onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('disables controls and shows submitting label while pending', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmPublishModal isOpen title="T" body="B" confirmLabel="Go" onCancel={onCancel} onConfirm={onConfirm} isSubmitting />,
    );

    expect(screen.getByRole('button', { name: 'Go…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go…' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
