// Verifies module unit card interactions for status dropdown flow, edit navigation, and group expansion.
// Tests branch coverage for status select, publish-step confirmations, edit warnings, and question group display.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModuleUnitCard from '@/Authoring/SingleModule/components/ModuleUnitCard';

const navigateMock = vi.fn();
type MockConfirmPublishModalProps = {
  isOpen?: boolean;
  title?: string;
  body?: string;
  errorMessage?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  confirmLabel?: string;
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const mockModalInstances: MockConfirmPublishModalProps[] = [];
vi.mock('@/Authoring/SingleModule/components/ConfirmPublishModal', () => ({
  default: (props: MockConfirmPublishModalProps) => {
    mockModalInstances.push({ ...props });
    return props.isOpen ? (
      <div data-testid={`modal-${props.title?.slice(0, 10) || 'unknown'}`}>
        <span>{props.title}</span>
        <p>{props.body}</p>
        {props.errorMessage && <span data-testid="error-message">{props.errorMessage}</span>}
        <button onClick={props.onConfirm} disabled={props.isSubmitting}>
          {props.confirmLabel}
        </button>
        <button onClick={props.onCancel}>cancel</button>
      </div>
    ) : null;
  },
}));

// Opens the status dropdown for the rendered card.
function openStatusMenu() {
  fireEvent.click(screen.getByRole('button', { name: /lesson status:/i }));
}

describe('ModuleUnitCard', () => {
  const baseUnit = {
    id: '12',
    title: 'Unit A',
    status: 'draft' as const,
    isCompleted: false,
    questionCount: 2,
    questionGroups: [
      {
        id: 'g1',
        title: 'Group 1',
        questions: [
          { id: '101', title: 'Q1' },
          { id: '102', title: 'Q2' },
        ],
      },
    ],
  };

  beforeEach(() => {
    navigateMock.mockReset();
    mockModalInstances.length = 0;
    window.history.pushState({}, '', '/main/modules/9');
  });

  // ============================================================================
  // Status dropdown: trigger renders with current status
  // ============================================================================
  describe('Status dropdown trigger', () => {
    it('shows current status label on the trigger button', () => {
      render(<ModuleUnitCard unit={baseUnit} />);
      expect(screen.getByRole('button', { name: 'Lesson status: draft' })).toBeInTheDocument();
    });

    it('opens the status menu when trigger is clicked', () => {
      render(<ModuleUnitCard unit={baseUnit} onChangeStatus={vi.fn()} />);
      openStatusMenu();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('disables trigger when onChangeStatus is not provided', () => {
      render(<ModuleUnitCard unit={baseUnit} />);
      expect(screen.getByRole('button', { name: /lesson status/i })).toBeDisabled();
    });

    it('disables trigger for archived status', () => {
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'archived' }} onChangeStatus={vi.fn()} />);
      expect(screen.getByRole('button', { name: /lesson status/i })).toBeDisabled();
    });
  });

  // ============================================================================
  // Status dropdown: draft transitions
  // ============================================================================
  describe('Status dropdown - draft transitions', () => {
    it('opens the Publish to Locked modal when selecting Locked from Draft', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'draft' }} onChangeStatus={onChangeStatus} />);

      openStatusMenu();
      fireEvent.click(screen.getByRole('button', { name: /locked/i }));

      await waitFor(() => {
        expect(screen.getByText('Ready to publish lesson?')).toBeInTheDocument();
      });
    });

    it('calls onChangeStatus with locked after confirming Publish to Locked', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'draft' }} onChangeStatus={onChangeStatus} />);

      openStatusMenu();
      fireEvent.click(screen.getByRole('button', { name: /locked/i }));

      await waitFor(() => {
        expect(screen.getByText('Ready to publish lesson?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Publish to Locked', { selector: 'button' }));

      await waitFor(() => {
        expect(onChangeStatus).toHaveBeenCalledWith('12', 'locked');
      });
    });

    it('marks Draft as current and disables it in the menu', () => {
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'draft' }} onChangeStatus={vi.fn()} />);
      openStatusMenu();
      // The Draft option should be the disabled current selection.
      const draftOption = screen.getByRole('button', { name: /^draft$/i });
      expect(draftOption).toBeDisabled();
    });

    it('disables Live option from Draft (skipping Locked is not allowed)', () => {
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'draft' }} onChangeStatus={vi.fn()} />);
      openStatusMenu();
      const liveOption = screen.getByRole('button', { name: /^live$/i });
      expect(liveOption).toBeDisabled();
    });
  });

  // ============================================================================
  // Status dropdown: locked transitions
  // ============================================================================
  describe('Status dropdown - locked transitions', () => {
    it('opens the Go Live modal when selecting Live from Locked', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'locked' }} onChangeStatus={onChangeStatus} />);

      openStatusMenu();
      fireEvent.click(screen.getByRole('button', { name: /^live$/i }));

      await waitFor(() => {
        expect(screen.getByText('Go live?')).toBeInTheDocument();
      });
    });

    it('calls onChangeStatus with live on Go Live modal confirm', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'locked' }} onChangeStatus={onChangeStatus} />);

      openStatusMenu();
      fireEvent.click(screen.getByRole('button', { name: /^live$/i }));

      await waitFor(() => {
        expect(screen.getByText('Go live?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Go Live', { selector: 'button' }));

      await waitFor(() => {
        expect(onChangeStatus).toHaveBeenCalledWith('12', 'live');
      });
    });

    it('calls onChangeStatus directly when rolling back Locked → Draft', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'locked' }} onChangeStatus={onChangeStatus} />);

      openStatusMenu();

      fireEvent.click(screen.getByRole('button', { name: /^draft$/i }));

      await waitFor(() => {
        expect(onChangeStatus).toHaveBeenCalledWith('12', 'draft');
      });
    });
  });

  // ============================================================================
  // Status dropdown: live transitions
  // ============================================================================
  describe('Status dropdown - live transitions', () => {
    it('disables Locked from Live for the MVP so published lessons cannot be unpublished', () => {
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'live' }} onChangeStatus={vi.fn()} />);
      openStatusMenu();
      const lockedOption = screen.getByRole('button', { name: /^locked$/i });
      expect(lockedOption).toBeDisabled();
    });

    it('disables Draft option from Live (large rollback not supported)', () => {
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'live' }} onChangeStatus={vi.fn()} />);
      openStatusMenu();
      const draftOption = screen.getByRole('button', { name: /^draft$/i });
      expect(draftOption).toBeDisabled();
    });
  });

  // ============================================================================
  // Title editing
  // ============================================================================
  describe('Title editing', () => {
    it('shows edit icon when onUpdateTitle is provided', () => {
      const onUpdateTitle = vi.fn();
      render(<ModuleUnitCard unit={baseUnit} onUpdateTitle={onUpdateTitle} />);
      expect(screen.getByLabelText('Edit title')).toBeInTheDocument();
    });

    it('enters edit mode when clicking edit icon', async () => {
      const onUpdateTitle = vi.fn();
      render(<ModuleUnitCard unit={baseUnit} onUpdateTitle={onUpdateTitle} />);

      fireEvent.click(screen.getByLabelText('Edit title'));

      expect(screen.getByDisplayValue('Unit A')).toBeInTheDocument();
      expect(screen.getByLabelText('Save title')).toBeInTheDocument();
      expect(screen.getByLabelText('Cancel editing')).toBeInTheDocument();
    });

    it('cancels editing when clicking cancel icon', () => {
      const onUpdateTitle = vi.fn();
      render(<ModuleUnitCard unit={baseUnit} onUpdateTitle={onUpdateTitle} />);

      fireEvent.click(screen.getByLabelText('Edit title'));
      fireEvent.change(screen.getByDisplayValue('Unit A'), { target: { value: 'New Title' } });
      fireEvent.click(screen.getByLabelText('Cancel editing'));

      expect(screen.getByText('Unit A')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('New Title')).not.toBeInTheDocument();
    });

    it('saves title when clicking save icon', async () => {
      const onUpdateTitle = vi.fn().mockResolvedValue(undefined);
      render(<ModuleUnitCard unit={baseUnit} onUpdateTitle={onUpdateTitle} />);

      fireEvent.click(screen.getByLabelText('Edit title'));
      fireEvent.change(screen.getByDisplayValue('Unit A'), { target: { value: 'Updated Title' } });
      fireEvent.click(screen.getByLabelText('Save title'));

      await waitFor(() => {
        expect(onUpdateTitle).toHaveBeenCalledWith('12', 'Updated Title');
      });
      expect(screen.queryByLabelText('Save title')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edit Warning Modal
  // ============================================================================
  describe('Edit warning modal - lifecycle-specific copy', () => {
    it('shows live-specific warning when editing live lesson', async () => {
      const unit = { ...baseUnit, status: 'live' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      await waitFor(() => {
        expect(screen.getByText('Edit live lesson?')).toBeInTheDocument();
      });

      expect(screen.getByText(/lesson is live/)).toBeInTheDocument();
    });

    it('navigates directly when editing locked lesson', () => {
      const unit = { ...baseUnit, status: 'locked' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/9/12/editor');
      expect(screen.queryByText('Edit live lesson?')).not.toBeInTheDocument();
    });

    it('navigates directly when editing draft lesson', () => {
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/9/12/editor');
      expect(screen.queryByText('Edit live lesson?')).not.toBeInTheDocument();
    });

    it('navigates directly when editing archived lesson', () => {
      const unit = { ...baseUnit, status: 'archived' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/9/12/editor');
      expect(screen.queryByText('Edit live lesson?')).not.toBeInTheDocument();
    });

    it('navigates to editor on live-edit warning confirm', async () => {
      const unit = { ...baseUnit, status: 'live' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      await waitFor(() => {
        expect(screen.getByText('Edit live lesson?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit live lesson', { selector: 'button' }));

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/9/12/editor');
    });

    it('navigates directly to specific question for non-live units', () => {
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));
      fireEvent.click(screen.getByRole('button', { name: 'Edit Q1' }));

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/9/12/editor?questionId=101');
      expect(screen.queryByText('Edit live lesson?')).not.toBeInTheDocument();
    });

    it('shows live warning when question is clicked for a live lesson', async () => {
      const unit = { ...baseUnit, status: 'live' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));
      fireEvent.click(screen.getByRole('button', { name: 'Edit Q1' }));

      await waitFor(() => {
        expect(screen.getByText('Edit live lesson?')).toBeInTheDocument();
      });
    });

    it('closes edit warning modal on cancel for live lessons', async () => {
      const unit = { ...baseUnit, status: 'live' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      await waitFor(() => {
        expect(screen.getByText('Edit live lesson?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('cancel'));

      expect(screen.queryByText('Edit live lesson?')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Question Count Display
  // ============================================================================
  describe('Question count display', () => {
    it('shows singular "Question" when count is 1', () => {
      const unit = { ...baseUnit, questionCount: 1 };
      render(<ModuleUnitCard unit={unit} />);
      expect(screen.getByText('1 Question')).toBeInTheDocument();
    });

    it('shows plural "Questions" when count is 0', () => {
      const unit = { ...baseUnit, questionCount: 0 };
      render(<ModuleUnitCard unit={unit} />);
      expect(screen.getByText('0 Questions')).toBeInTheDocument();
    });

    it('shows plural "Questions" when count is 2', () => {
      const unit = { ...baseUnit, questionCount: 2 };
      render(<ModuleUnitCard unit={unit} />);
      expect(screen.getByText('2 Questions')).toBeInTheDocument();
    });

    it('shows plural "Questions" when count is > 1', () => {
      const unit = { ...baseUnit, questionCount: 100 };
      render(<ModuleUnitCard unit={unit} />);
      expect(screen.getByText('100 Questions')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Question Groups Panel
  // ============================================================================
  describe('Question groups panel - expansion toggle', () => {
    it('toggles panel visibility (expand)', () => {
      render(<ModuleUnitCard unit={baseUnit} />);

      expect(screen.getByRole('button', { name: 'Expand question groups' })).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));
      expect(screen.getByRole('button', { name: 'Collapse question groups' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('toggles panel visibility (collapse)', () => {
      render(<ModuleUnitCard unit={baseUnit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));
      fireEvent.click(screen.getByRole('button', { name: 'Collapse question groups' }));

      expect(screen.getByRole('button', { name: 'Expand question groups' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('sets aria-hidden=true when panel is collapsed', () => {
      const { container } = render(<ModuleUnitCard unit={baseUnit} />);
      const panel = container.querySelector(`[id="unit-panel-${baseUnit.id}"]`);
      expect(panel).toHaveAttribute('aria-hidden', 'true');
    });

    it('sets aria-hidden=false when panel is expanded', () => {
      const { container } = render(<ModuleUnitCard unit={baseUnit} />);
      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));
      const panel = container.querySelector(`[id="unit-panel-${baseUnit.id}"]`);
      expect(panel).toHaveAttribute('aria-hidden', 'false');
    });
  });

  describe('Question groups panel - group and question display', () => {
    it('displays all question groups with questions', () => {
      const unit = {
        ...baseUnit,
        questionGroups: [
          {
            id: 'g1',
            title: 'Group 1',
            questions: [
              { id: '101', title: 'Q1' },
              { id: '102', title: 'Q2' },
            ],
          },
          { id: 'g2', title: 'Group 2', questions: [{ id: '201', title: 'Q3' }] },
        ],
      };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));

      expect(screen.getByText('Group 1')).toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();
      expect(screen.getByText('Q1')).toBeInTheDocument();
      expect(screen.getByText('Q3')).toBeInTheDocument();
    });

    it('shows "No questions yet" when group has empty questions array', () => {
      const unit = {
        ...baseUnit,
        questionGroups: [{ id: 'g1', title: 'Group 1', questions: [] }],
      };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));

      expect(screen.getByText('No questions yet')).toBeInTheDocument();
    });

    it('shows "No questions yet" when group has undefined questions', () => {
      const unit = {
        ...baseUnit,
        questionGroups: [{ id: 'g1', title: 'Group 1' }],
      };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));

      expect(screen.getByText('No questions yet')).toBeInTheDocument();
    });

    it('handles multiple groups with mixed question states', () => {
      const unit = {
        ...baseUnit,
        questionGroups: [
          { id: 'g1', title: 'Group 1', questions: [{ id: '101', title: 'Q1' }] },
          { id: 'g2', title: 'Group 2', questions: [] },
          { id: 'g3', title: 'Group 3' },
        ],
      };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));

      expect(screen.getByText('Q1')).toBeInTheDocument();
      expect(screen.getAllByText('No questions yet')).toHaveLength(2);
    });
  });

  // ============================================================================
  // Module ID extraction
  // ============================================================================
  describe('Module ID extraction', () => {
    it('extracts moduleId from URL path /main/modules/{id}', () => {
      window.history.pushState({}, '', '/main/modules/42');
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'draft' }} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/42/12/editor');
    });

    it('extracts moduleId from nested URL path', () => {
      window.history.pushState({}, '', '/main/modules/999/some/other/path');
      render(<ModuleUnitCard unit={{ ...baseUnit, status: 'draft' }} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/999/12/editor');
    });
  });

  // ============================================================================
  // Edit button
  // ============================================================================
  describe('Edit button', () => {
    it('edit button is always visible and clickable regardless of status', () => {
      const statuses: Array<'draft' | 'locked' | 'live' | 'archived'> = ['draft', 'locked', 'live', 'archived'];

      statuses.forEach((status) => {
        const unit = { ...baseUnit, status };
        const { unmount } = render(<ModuleUnitCard unit={unit} />);

        const editButton = screen.getByRole('button', { name: 'Edit module unit' });
        expect(editButton).toBeInTheDocument();
        expect(editButton).toBeEnabled();

        unmount();
      });
    });
  });
});
