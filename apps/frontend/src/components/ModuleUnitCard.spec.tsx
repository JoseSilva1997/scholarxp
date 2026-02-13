// Verifies module unit card interactions for status publish flow, edit navigation, and group expansion.
// Tests branch coverage for status buttons, publish flow, edit warnings, and question group display.
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

// Track all ConfirmPublishModal instances separately by capturing title
const mockModalInstances: Record<string, any>[] = [];
vi.mock('./Modals/ConfirmPublishModal', () => ({
  default: (props: any) => {
    // Store this instance's props indexed by title to differentiate between publish and edit modals
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

describe('ModuleUnitCard', () => {
  const baseUnit = {
    id: '12',
    title: 'Unit A',
    status: 'draft' as const,
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
  // Status Button: Click behavior based on unit.status
  // ============================================================================
  describe('Status button - draft status', () => {
    it('opens publish modal for draft status when onChangeStatus provided', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} onChangeStatus={onChangeStatus} />);

      fireEvent.click(screen.getByLabelText('Module unit status: draft'));

      // Check that publish modal opened with draft-specific copy
      await waitFor(() => {
        expect(screen.getByText('Ready to publish lesson?')).toBeInTheDocument();
      });
    });

    it('does not open publish modal for draft status when onChangeStatus is undefined', () => {
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByLabelText('Module unit status: draft'));

      // Modal should not open if no onChangeStatus callback
      expect(screen.queryByText('Ready to publish lesson?')).not.toBeInTheDocument();
    });

    it('publishes draft to locked status on confirm (draft -> locked transition)', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} onChangeStatus={onChangeStatus} />);

      fireEvent.click(screen.getByLabelText('Module unit status: draft'));
      
      // Wait for modal to appear then click confirm
      await waitFor(() => {
        expect(screen.getByText('Ready to publish lesson?')).toBeInTheDocument();
      });
      
      const confirmButton = screen.getAllByText('Publish')[0];
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(onChangeStatus).toHaveBeenCalledWith('12', 'locked');
      });
    });

    it('shows draft-specific publish modal copy', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} onChangeStatus={onChangeStatus} />);

      fireEvent.click(screen.getByLabelText('Module unit status: draft'));

      await waitFor(() => {
        expect(screen.getByText('Ready to publish lesson?')).toBeInTheDocument();
      });
      
      // Check for key text fragments that may be split across elements
      expect(screen.getByText(/still edit/)).toBeInTheDocument();
      expect(screen.getByText('Publish')).toBeInTheDocument();
    });
  });

  describe('Status button - locked status', () => {
    it('opens publish modal for locked status when onChangeStatus provided', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      const unit = { ...baseUnit, status: 'locked' as const };
      render(<ModuleUnitCard unit={unit} onChangeStatus={onChangeStatus} />);

      fireEvent.click(screen.getByLabelText('Module unit status: locked'));

      await waitFor(() => {
        expect(screen.getByText('Go live?')).toBeInTheDocument();
      });
    });

    it('publishes locked to live status on confirm (locked -> live transition)', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      const unit = { ...baseUnit, status: 'locked' as const };
      render(<ModuleUnitCard unit={unit} onChangeStatus={onChangeStatus} />);

      fireEvent.click(screen.getByLabelText('Module unit status: locked'));

      await waitFor(() => {
        expect(screen.getByText('Go live?')).toBeInTheDocument();
      });

      const confirmButton = screen.getAllByText('Go live')[0];
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(onChangeStatus).toHaveBeenCalledWith('12', 'live');
      });
    });

    it('shows locked-specific publish modal copy', async () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      const unit = { ...baseUnit, status: 'locked' as const };
      render(<ModuleUnitCard unit={unit} onChangeStatus={onChangeStatus} />);

      fireEvent.click(screen.getByLabelText('Module unit status: locked'));

      await waitFor(() => {
        expect(screen.getByText('Go live?')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/practice available/)).toBeInTheDocument();
      expect(screen.getByText('Go live')).toBeInTheDocument();
    });
  });

  describe('Status button - live and archived statuses', () => {
    it('does not open publish modal for live status', () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      const unit = { ...baseUnit, status: 'live' as const };
      render(<ModuleUnitCard unit={unit} onChangeStatus={onChangeStatus} />);

      fireEvent.click(screen.getByLabelText('Module unit status: live'));

      // Modal should not open for live (not in draft || locked condition)
      expect(screen.queryByText('Go live?')).not.toBeInTheDocument();
      expect(screen.queryByText('Ready to publish lesson?')).not.toBeInTheDocument();
    });

    it('does not open publish modal for archived status', () => {
      const onChangeStatus = vi.fn().mockResolvedValue(undefined);
      const unit = { ...baseUnit, status: 'archived' as const };
      render(<ModuleUnitCard unit={unit} onChangeStatus={onChangeStatus} />);

      fireEvent.click(screen.getByLabelText('Module unit status: archived'));

      expect(screen.queryByText('Go live?')).not.toBeInTheDocument();
      expect(screen.queryByText('Ready to publish lesson?')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edit Warning Modal: Copy varies by unit.status
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

    it('shows locked-specific warning when editing locked lesson', async () => {
      const unit = { ...baseUnit, status: 'locked' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      await waitFor(() => {
        expect(screen.getByText('Edit locked lesson?')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/update content/)).toBeInTheDocument();
    });

    it('shows draft-specific warning when editing draft lesson', async () => {
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      await waitFor(() => {
        expect(screen.getByText('Edit draft lesson?')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/about to edit/)).toBeInTheDocument();
    });

    it('shows archived-specific warning (default case)', async () => {
      const unit = { ...baseUnit, status: 'archived' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      await waitFor(() => {
        expect(screen.getByText('Edit draft lesson?')).toBeInTheDocument();
      });
    });

    it('navigates to editor on edit warning confirm', async () => {
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      await waitFor(() => {
        expect(screen.getByText('Edit draft lesson?')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Edit draft lesson', { selector: 'button' });
      fireEvent.click(confirmButton);

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/9/12/editor');
    });

    it('opens edit warning and navigates to specific question when question is clicked', async () => {
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));
      fireEvent.click(screen.getByRole('button', { name: 'Edit Q1' }));

      await waitFor(() => {
        expect(screen.getByText('Edit draft lesson?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit draft lesson', { selector: 'button' }));

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/9/12/editor?questionId=101');
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

    it('closes edit warning modal on cancel', async () => {
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      await waitFor(() => {
        expect(screen.getByText('Edit draft lesson?')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('cancel');
      fireEvent.click(cancelButton);

      // Modal should close
      expect(screen.queryByText('Edit draft lesson?')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Question Count Display: Singular vs Plural
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
  // Question Groups Panel: Expansion and Group Display
  // ============================================================================
  describe('Question groups panel - expansion toggle', () => {
    it('toggles panel visibility (expand)', () => {
      const unit = baseUnit;
      render(<ModuleUnitCard unit={unit} />);

      // Initially collapsed
      expect(screen.getByRole('button', { name: 'Expand question groups' })).toHaveAttribute('aria-expanded', 'false');

      // Expand
      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));

      expect(screen.getByRole('button', { name: 'Collapse question groups' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('toggles panel visibility (collapse)', () => {
      const unit = baseUnit;
      render(<ModuleUnitCard unit={unit} />);

      // Expand
      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));

      // Collapse
      fireEvent.click(screen.getByRole('button', { name: 'Collapse question groups' }));

      expect(screen.getByRole('button', { name: 'Expand question groups' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('sets aria-hidden=true when panel is collapsed', () => {
      const unit = baseUnit;
      const { container } = render(<ModuleUnitCard unit={unit} />);

      const panel = container.querySelector(`[id="unit-panel-${unit.id}"]`);
      expect(panel).toHaveAttribute('aria-hidden', 'true');
    });

    it('sets aria-hidden=false when panel is expanded', () => {
      const unit = baseUnit;
      const { container } = render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));

      const panel = container.querySelector(`[id="unit-panel-${unit.id}"]`);
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
        questionGroups: [{ id: 'g1', title: 'Group 1' }], // questions undefined
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
          { id: 'g3', title: 'Group 3' }, // undefined questions
        ],
      };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand question groups' }));

      expect(screen.getByText('Q1')).toBeInTheDocument();
      expect(screen.getAllByText('No questions yet')).toHaveLength(2);
    });
  });

  // ============================================================================
  // Module ID extraction from URL
  // ============================================================================
  describe('Module ID extraction', () => {
    it('extracts moduleId from URL path /main/modules/{id}', async () => {
      window.history.pushState({}, '', '/main/modules/42');
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      await waitFor(() => {
        expect(screen.getByText('Edit draft lesson?')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Edit draft lesson', { selector: 'button' });
      fireEvent.click(confirmButton);

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/42/12/editor');
    });

    it('extracts moduleId from nested URL path', async () => {
      window.history.pushState({}, '', '/main/modules/999/some/other/path');
      const unit = { ...baseUnit, status: 'draft' as const };
      render(<ModuleUnitCard unit={unit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit module unit' }));

      await waitFor(() => {
        expect(screen.getByText('Edit draft lesson?')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Edit draft lesson', { selector: 'button' });
      fireEvent.click(confirmButton);

      expect(navigateMock).toHaveBeenCalledWith('/main/modules/999/12/editor');
    });
  });

  // ============================================================================
  // Edit button always enabled (no conditions)
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
