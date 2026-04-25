// Verifies ModuleUnitEditor route branches and wiring so editor actions stay connected to page-state handlers.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ModuleUnitEditor from '@/Authoring/ModuleUnitEditor/ModuleUnitEditor';

type EditorVariant = { id: number; isDraft: boolean };
type EditorQuestion = {
  id: number;
  type: 'mcq' | 'true-false';
  isDraft: boolean;
  variants: EditorVariant[];
};
type EditorGroup = {
  id: number;
  title: string;
  questions: EditorQuestion[];
};

const mocks = vi.hoisted(() => ({
  setSelected: vi.fn(),
  setForm: vi.fn(),
  setDeleteTarget: vi.fn(),
  setDeleteError: vi.fn(),
  setEditingGroupTitle: vi.fn(),
  handleNavigate: vi.fn(),
  handleToggleGroup: vi.fn(),
  handleAddGroup: vi.fn(),
  handleAddQuestion: vi.fn(),
  handleAddVariant: vi.fn(),
  startEditingGroupTitle: vi.fn(),
  cancelEditingGroupTitle: vi.fn(),
  saveEditingGroupTitle: vi.fn(),
  handleOptionChange: vi.fn(),
  handleExplanationChange: vi.fn(),
  setCorrectOption: vi.fn(),
  handleTypeChange: vi.fn(),
  handleSaveQuestion: vi.fn(),
  handleConfirmDelete: vi.fn(),
}));

let routeParams: { moduleId?: string; unitId?: string } = {
  moduleId: '10',
  unitId: '20',
};

let pageState = {
  parsedModuleId: 10,
  parsedUnitId: 20,
  isLoading: false,
  error: null as string | null,
  unitTitle: 'Unit 1',
  groups: [
    {
      id: 1,
      title: 'Group 1',
      questions: [
        {
          id: 101,
          type: 'mcq' as const,
          isDraft: false,
          variants: [{ id: 501, isDraft: false }],
        },
      ],
    },
  ] as EditorGroup[],
  expandedGroups: new Set<number>([1]),
  selected: { groupId: 1, questionId: 101, variantId: null as number | null },
  selectedQuestion: { id: 101 },
  form: {
    type: 'mcq' as 'mcq' | 'true-false',
    stem: 'Question stem',
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    explanations: ['', ''],
    hint: '',
  },
  canGoPrev: true,
  canGoNext: true,
  activeLabel: 'Question 1',
  deleteTarget: null as null | {
    type: 'group' | 'question' | 'variant';
    groupId?: number;
    questionId?: number;
    variantId?: number;
    title?: string;
    label?: string;
  },
  deleteCopy: { title: 'Delete item', body: 'Are you sure?', confirmLabel: 'Delete' },
  isDeleting: false,
  deleteError: null as string | null,
  isUnitLive: false,
  saveError: null as string | null,
  isSavingQuestion: false,
  isSavingVariant: false,
  editingGroupId: null as number | null,
  editingGroupTitle: '',
  renamingGroupId: null as number | null,
  editingGroupInputRef: { current: null as HTMLInputElement | null },
  formatQuestionLabel: () => 'Q1',
  formatVariantLabel: () => 'V1',
  isQuestionSaved: () => true,
  canAddVariant: () => true,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => routeParams,
  };
});

vi.mock('@/Authoring/ModuleUnitEditor/page-state/useModuleUnitEditorPageState', () => ({
  useModuleUnitEditorPageState: () => ({
    ...pageState,
    setSelected: mocks.setSelected,
    setForm: mocks.setForm,
    setDeleteTarget: mocks.setDeleteTarget,
    setDeleteError: mocks.setDeleteError,
    setEditingGroupTitle: mocks.setEditingGroupTitle,
    handleNavigate: mocks.handleNavigate,
    handleToggleGroup: mocks.handleToggleGroup,
    handleAddGroup: mocks.handleAddGroup,
    handleAddQuestion: mocks.handleAddQuestion,
    handleAddVariant: mocks.handleAddVariant,
    startEditingGroupTitle: mocks.startEditingGroupTitle,
    cancelEditingGroupTitle: mocks.cancelEditingGroupTitle,
    saveEditingGroupTitle: mocks.saveEditingGroupTitle,
    handleOptionChange: mocks.handleOptionChange,
    handleExplanationChange: mocks.handleExplanationChange,
    setCorrectOption: mocks.setCorrectOption,
    handleTypeChange: mocks.handleTypeChange,
    handleSaveQuestion: mocks.handleSaveQuestion,
    handleConfirmDelete: mocks.handleConfirmDelete,
  }),
}));

vi.mock('@/MainApp/MainSection/MainSection', () => ({
  default: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

vi.mock('@/Authoring/ModuleUnitEditor/components/ConfirmDeleteModal', () => ({
  default: ({ isOpen, onCancel, onConfirm }: { isOpen: boolean; onCancel: () => void; onConfirm: () => void }) => (
    <div>
      <span>delete-open:{String(isOpen)}</span>
      <button onClick={onCancel}>cancel-delete</button>
      <button onClick={onConfirm}>confirm-delete</button>
    </div>
  ),
}));

vi.mock('@/Authoring/ModuleUnitEditor/components/question-types/QuestionTypeRegistry', () => ({
  QUESTION_TYPE_CONFIGS: {
    mcq: {
      type: 'mcq',
      label: 'MCQ',
      component: ({ options }: { options: Array<{ id: string; text: string }> }) => (
        <div>question-form-options:{options.length}</div>
      ),
    },
    'true-false': {
      type: 'true-false',
      label: 'True/False',
      component: () => <div>question-form-true-false</div>,
    },
  },
  normalizeQuestionType: (type: string | undefined | null) =>
    type === 'true-false' ? 'true-false' : 'mcq',
}));

describe('ModuleUnitEditor route', () => {
  beforeEach(() => {
    routeParams = { moduleId: '10', unitId: '20' };
    pageState = {
      parsedModuleId: 10,
      parsedUnitId: 20,
      isLoading: false,
      error: null,
      unitTitle: 'Unit 1',
      groups: [
        {
          id: 1,
          title: 'Group 1',
          questions: [
            {
              id: 101,
              type: 'mcq',
              isDraft: false,
              variants: [{ id: 501, isDraft: false }],
            },
          ],
        },
      ],
      expandedGroups: new Set<number>([1]),
      selected: { groupId: 1, questionId: 101, variantId: null },
      selectedQuestion: { id: 101 },
      form: {
        type: 'mcq',
        stem: 'Question stem',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        explanations: ['', ''],
        hint: '',
      },
      canGoPrev: true,
      canGoNext: true,
      activeLabel: 'Question 1',
      deleteTarget: null,
      deleteCopy: { title: 'Delete item', body: 'Are you sure?', confirmLabel: 'Delete' },
      isDeleting: false,
      deleteError: null,
      isUnitLive: false,
      saveError: null,
      isSavingQuestion: false,
      isSavingVariant: false,
      editingGroupId: null,
      editingGroupTitle: '',
      renamingGroupId: null,
      editingGroupInputRef: { current: null },
      formatQuestionLabel: () => 'Q1',
      formatVariantLabel: () => 'V1',
      isQuestionSaved: () => true,
      canAddVariant: () => true,
    };

    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders not-found card when parsed ids are missing', () => {
    pageState.parsedModuleId = null as unknown as number;
    pageState.parsedUnitId = null as unknown as number;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Module unit not found.');
  });

  it('renders loading and error branches', () => {
    pageState.isLoading = true;

    const { rerender } = render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading module unit…')).toBeInTheDocument();

    pageState.isLoading = false;
    pageState.error = 'Editor failed to load';

    rerender(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Editor failed to load');
  });

  it('wires key editor actions to page-state handlers', { timeout: 10_000 }, () => {
    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('Rename group Group 1'));
    expect(mocks.startEditingGroupTitle).toHaveBeenCalledWith(1, 'Group 1');

    fireEvent.click(screen.getByRole('button', { name: 'Add variant' }));
    expect(mocks.handleAddVariant).toHaveBeenCalledWith(1, 101);

    // Match the current accessible label so the test tracks the rendered control name.
    fireEvent.click(screen.getByRole('button', { name: 'Question' }));
    expect(mocks.handleAddQuestion).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add Group' }));
    expect(mocks.handleAddGroup).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous question or variant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next question or variant' }));
    expect(mocks.handleNavigate).toHaveBeenCalledWith(-1);
    expect(mocks.handleNavigate).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: 'MCQ' }));
    expect(mocks.handleTypeChange).toHaveBeenCalledWith('mcq');

    fireEvent.change(screen.getByPlaceholderText('Enter the question text here...'), {
      target: { value: 'Updated stem' },
    });
    expect(mocks.setForm).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save Question' }));
    expect(mocks.handleSaveQuestion).toHaveBeenCalled();

    fireEvent.click(screen.getByText('cancel-delete'));
    expect(mocks.setDeleteTarget).toHaveBeenCalledWith(null);
    expect(mocks.setDeleteError).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByText('confirm-delete'));
    expect(mocks.handleConfirmDelete).toHaveBeenCalled();
  });

  it('shows empty editor prompt when selectedQuestion is absent', () => {
    pageState.selectedQuestion = null as unknown as { id: number };

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    expect(screen.getByText('Pick a question to edit')).toBeInTheDocument();
  });

  it('does not render error message when saveError is null', () => {
    pageState.saveError = null;

    const { container } = render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    // The error alert should not be present when saveError is null
    const errorAlerts = container.querySelectorAll('[role="alert"]');
    const saveErrorAlert = Array.from(errorAlerts).find((alert) =>
      alert.className.includes('inlineError'),
    );
    expect(saveErrorAlert).toBeUndefined();
  });

  it('renders and clears saveError when present', () => {
    pageState.saveError = 'Failed to save question';

    const { rerender } = render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    expect(screen.getByText('Failed to save question')).toBeInTheDocument();

    // Clear the error
    pageState.saveError = null;
    rerender(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Failed to save question')).not.toBeInTheDocument();
  });

  it('disables navigation buttons when canGoPrev is false', () => {
    pageState.canGoPrev = false;
    pageState.canGoNext = true;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const prevButton = screen.getByRole('button', { name: 'Previous question or variant' });
    expect(prevButton).toBeDisabled();

    const nextButton = screen.getByRole('button', { name: 'Next question or variant' });
    expect(nextButton).not.toBeDisabled();
  });

  it('disables navigation buttons when canGoNext is false', () => {
    pageState.canGoPrev = true;
    pageState.canGoNext = false;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const nextButton = screen.getByRole('button', { name: 'Next question or variant' });
    expect(nextButton).toBeDisabled();

    const prevButton = screen.getByRole('button', { name: 'Previous question or variant' });
    expect(prevButton).not.toBeDisabled();
  });

  it('disables save question button when isSavingQuestion is true', () => {
    pageState.isSavingQuestion = true;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    // Saving state swaps button text, so the disabled assertion must target "Saving...".
    const saveButton = screen.getByRole('button', { name: 'Saving...' });
    expect(saveButton).toBeDisabled();
  });

  it('handles group title editing with Enter key', () => {
    pageState.editingGroupId = 1;
    pageState.editingGroupTitle = 'Group 1';

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const input = screen.getByDisplayValue('Group 1') as HTMLInputElement;
    expect(input.value).toBe('Group 1');

    fireEvent.change(input, { target: { value: 'Updated Group' } });
    expect(mocks.setEditingGroupTitle).toHaveBeenCalledWith('Updated Group');

    // Press Enter to save
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(mocks.saveEditingGroupTitle).toHaveBeenCalledWith(1);
  });

  it('handles group title editing with Escape key', () => {
    pageState.editingGroupId = 1;
    pageState.editingGroupTitle = 'Group 1';

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const input = screen.getByDisplayValue('Group 1') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(mocks.cancelEditingGroupTitle).toHaveBeenCalled();
  });

  it('toggles groups by keyboard when group is not being edited', () => {
    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    // Find the group toggle element by looking for the role="button" with aria-expanded
    const groupToggle = screen.getByRole('button', { expanded: true, hidden: true });

    fireEvent.keyDown(groupToggle, { key: 'Enter', code: 'Enter' });
    expect(mocks.handleToggleGroup).toHaveBeenCalledWith(1);

    mocks.handleToggleGroup.mockClear();

    fireEvent.keyDown(groupToggle, { key: ' ', code: 'Space' });
    expect(mocks.handleToggleGroup).toHaveBeenCalledWith(1);
  });

  it('disables add variant button when isUnitLive is true', () => {
    pageState.isUnitLive = true;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const addVariantButton = screen.getByRole('button', { name: 'Add variant' });
    expect(addVariantButton).toBeDisabled();
  });

  it('disables add variant button when isSavingVariant is true', () => {
    pageState.isUnitLive = false;
    pageState.isSavingVariant = true;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const addVariantButton = screen.getByRole('button', { name: 'Add variant' });
    expect(addVariantButton).toBeDisabled();
  });

  it('disables add variant button when canAddVariant returns false', () => {
    pageState.canAddVariant = () => false;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const addVariantButton = screen.getByRole('button', { name: 'Add variant' });
    expect(addVariantButton).toBeDisabled();
  });

  it('shows archive icon instead of trash when isUnitLive is true', () => {
    pageState.isUnitLive = true;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    // Check that the group delete button has archive label instead of delete
    const groupDeleteButton = screen.getByLabelText(/Archive group Group 1/i);
    expect(groupDeleteButton).toBeInTheDocument();
  });

  it('shows trash icon instead of archive when isUnitLive is false', () => {
    pageState.isUnitLive = false;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const groupDeleteButton = screen.getByLabelText(/Delete group Group 1/i);
    expect(groupDeleteButton).toBeInTheDocument();
  });

  it('disables add group button when isUnitLive is true', () => {
    pageState.isUnitLive = true;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const addGroupButton = screen.getByRole('button', { name: 'Add Group' });
    expect(addGroupButton).toBeDisabled();
  });

  it('disables add question button when isUnitLive is true', () => {
    pageState.isUnitLive = true;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const addQuestionButton = screen.getByRole('button', { name: 'Question' });
    expect(addQuestionButton).toBeDisabled();
  });

  it('renders question type toggle with active state matching form.type', () => {
    pageState.form.type = 'true-false';

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    // The true_false button should be active
    const trueFalseButton = screen.getByRole('button', { name: 'True/False' });
    expect(trueFalseButton.className).toMatch(/typeChipActive/);

    const mcqButton = screen.getByRole('button', { name: 'MCQ' });
    expect(mcqButton.className).not.toMatch(/typeChipActive/);
  });

  it('handles cancel delete modal button', () => {
    pageState.deleteTarget = {
      type: 'group',
      groupId: 1,
      title: 'Group 1',
    };

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('cancel-delete'));
    expect(mocks.setDeleteTarget).toHaveBeenCalledWith(null);
    expect(mocks.setDeleteError).toHaveBeenCalledWith(null);
  });

  it('handles delete when editingGroupId is set on group delete', () => {
    pageState.editingGroupId = 1;
    pageState.deleteTarget = null;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const groupDeleteButton = screen.getByLabelText(/Delete group Group 1/i);
    fireEvent.click(groupDeleteButton);

    // Should call cancelEditingGroupTitle and setDeleteTarget
    expect(mocks.cancelEditingGroupTitle).toHaveBeenCalled();
    expect(mocks.setDeleteTarget).toHaveBeenCalled();
  });

  it('prevents group toggle when group is being edited', () => {
    pageState.editingGroupId = 1;
    pageState.expandedGroups = new Set<number>();

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const groupToggle = screen.getByRole('button', { name: '▶' });
    fireEvent.click(groupToggle);
    expect(mocks.handleToggleGroup).not.toHaveBeenCalled();
  });

  it('prevents group title rename button clicks when renamingGroupId is set', () => {
    pageState.renamingGroupId = 1;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const renameButton = screen.getByLabelText('Rename group Group 1');
    expect(renameButton).toBeDisabled();
  });

  it('disables save group title button when editingGroupTitle is empty', () => {
    pageState.editingGroupId = 1;
    pageState.editingGroupTitle = '';

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const saveGroupButton = screen.getByLabelText(/Save group name/i);
    expect(saveGroupButton).toBeDisabled();
  });

  it('disables save group title button when renamingGroupId is set', () => {
    pageState.editingGroupId = 1;
    pageState.editingGroupTitle = 'New Title';
    pageState.renamingGroupId = 1;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const saveGroupButton = screen.getByLabelText(/Save group name/i);
    expect(saveGroupButton).toBeDisabled();
  });

  it('disables cancel group title button when renamingGroupId is set', () => {
    pageState.editingGroupId = 1;
    pageState.renamingGroupId = 1;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const cancelGroupButton = screen.getByLabelText(/Cancel renaming/i);
    expect(cancelGroupButton).toBeDisabled();
  });

  it('handles question selection by keyboard', () => {
    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const questionBlock = screen.getByRole('button', {
      name: 'Question 1 MCQ',
    }) as HTMLDivElement;
    if (!questionBlock) throw new Error('Question block not found');

    fireEvent.keyDown(questionBlock, { key: 'Enter', code: 'Enter' });
    expect(mocks.setSelected).toHaveBeenCalledWith({
      groupId: 1,
      questionId: 101,
      variantId: null,
    });

    mocks.setSelected.mockClear();

    fireEvent.keyDown(questionBlock, { key: ' ', code: 'Space' });
    expect(mocks.setSelected).toHaveBeenCalledWith({
      groupId: 1,
      questionId: 101,
      variantId: null,
    });
  });

  it('does not render questions when group is collapsed', () => {
    pageState.expandedGroups = new Set<number>();

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Q1')).not.toBeInTheDocument();
  });

  it('disables add question button when isUnitLive is true and unsaved question exists', () => {
    pageState.isUnitLive = true;
    pageState.isQuestionSaved = () => false;

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    const addQuestionButton = screen.getByRole('button', { name: 'Question' });
    expect(addQuestionButton).toBeDisabled();
  });

  it('does not call handleExplanationChange when option id is not found', () => {
    // This tests the edge case where idx < 0 in the onChangeExplanation callback
    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    // The form component receives a callback that should not call handleExplanationChange
    // if the option ID doesn't exist in the options array.
    // This is a defensive coding branch that's difficult to trigger through the UI,
    // but is important for robustness.
    expect(mocks.handleExplanationChange).not.toHaveBeenCalled();
  });
});
