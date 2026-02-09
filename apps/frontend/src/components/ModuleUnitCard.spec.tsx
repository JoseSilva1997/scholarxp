// Verifies module unit card interactions for status publish flow, edit navigation, and group expansion.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModuleUnitCard from './ModuleUnitCard';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('./Modals/ConfirmPublishModal', () => ({
  default: ({ isOpen, onConfirm, onCancel, title }: { isOpen: boolean; onConfirm: () => void; onCancel: () => void; title: string }) =>
    isOpen ? (
      <div>
        <span>{title}</span>
        <button onClick={onConfirm}>confirm-modal</button>
        <button onClick={onCancel}>cancel-modal</button>
      </div>
    ) : null,
}));

describe('ModuleUnitCard', () => {
  const unit = {
    id: '12',
    title: 'Unit A',
    status: 'draft' as const,
    questionCount: 2,
    questionGroups: [{ id: 'g1', title: 'Group 1', questions: ['Q1'] }],
  };

  beforeEach(() => {
    navigateMock.mockReset();
    window.history.pushState({}, '', '/main/modules/9');
  });

  it('opens publish modal and calls onChangeStatus on confirm', async () => {
    const onChangeStatus = vi.fn().mockResolvedValue(undefined);
    render(<ModuleUnitCard unit={unit} onChangeStatus={onChangeStatus} />);

    fireEvent.click(screen.getByLabelText('Module unit status: draft'));
    fireEvent.click(screen.getByText('confirm-modal'));

    await waitFor(() => {
      expect(onChangeStatus).toHaveBeenCalledWith('12', 'locked');
    });
  });

  it('opens edit warning modal and navigates to editor on confirm', () => {
    render(<ModuleUnitCard unit={unit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));
    fireEvent.click(screen.getByText('confirm-modal'));

    expect(navigateMock).toHaveBeenCalledWith('/main/modules/9/12/editor');
  });

  it('toggles question group panel visibility', () => {
    render(<ModuleUnitCard unit={unit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));
    expect(screen.getByText('Q1')).toBeInTheDocument();
  });
});
