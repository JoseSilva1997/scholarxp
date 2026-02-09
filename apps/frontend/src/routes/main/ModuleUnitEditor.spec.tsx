// Verifies ModuleUnitEditor route branches and wiring so editor actions stay connected to page-state handlers.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ModuleUnitEditor from './ModuleUnitEditor';

type EditorVariant = { id: number; isDraft: boolean };
type EditorQuestion = {
  id: number;
  type: 'mcq' | 'true_false';
  isDraft: boolean;
  variants: EditorVariant[];
};
type EditorGroup = {
  id: number;
  title: string;
  questions: EditorQuestion[];
};

const mocks = vi.hoisted(() => ({
  setVariantInstructions: vi.fn(),
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
  variantInstructions: 'Keep same concept',
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
    type: 'mcq' as const,
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
  deleteTarget: null as null | { type: string },
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

vi.mock('../../hooks/page-state/useModuleUnitEditorPageState', () => ({
  useModuleUnitEditorPageState: () => ({
    ...pageState,
    setVariantInstructions: mocks.setVariantInstructions,
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

vi.mock('../../components/MainSection', () => ({
  default: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

vi.mock('../../components/Modals/ConfirmDeleteModal', () => ({
  default: ({ isOpen, onCancel, onConfirm }: { isOpen: boolean; onCancel: () => void; onConfirm: () => void }) => (
    <div>
      <span>delete-open:{String(isOpen)}</span>
      <button onClick={onCancel}>cancel-delete</button>
      <button onClick={onConfirm}>confirm-delete</button>
    </div>
  ),
}));

vi.mock('../../components/question-types/QuestionTypeRegistry', () => ({
  QUESTION_TYPE_CONFIGS: {
    mcq: {
      type: 'mcq',
      label: 'Multiple Choice',
      component: ({ options }: { options: Array<{ id: string; text: string }> }) => (
        <div>question-form-options:{options.length}</div>
      ),
    },
    true_false: {
      type: 'true_false',
      label: 'True/False',
      component: () => <div>question-form-true-false</div>,
    },
  },
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
      variantInstructions: 'Keep same concept',
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

  it('wires key editor actions to page-state handlers', () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    render(
      <MemoryRouter>
        <ModuleUnitEditor />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('Rename group Group 1'));
    expect(mocks.startEditingGroupTitle).toHaveBeenCalledWith(1, 'Group 1');

    fireEvent.click(screen.getByRole('button', { name: 'Add variant' }));
    expect(mocks.handleAddVariant).toHaveBeenCalledWith(1, 101);

    fireEvent.click(screen.getByRole('button', { name: /Add Question/i }));
    expect(mocks.handleAddQuestion).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: /Add Group/i }));
    expect(mocks.handleAddGroup).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous question or variant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next question or variant' }));
    expect(mocks.handleNavigate).toHaveBeenCalledWith(-1);
    expect(mocks.handleNavigate).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: 'Multiple Choice' }));
    expect(mocks.handleTypeChange).toHaveBeenCalledWith('mcq');

    fireEvent.change(screen.getByPlaceholderText('Enter the question text here...'), {
      target: { value: 'Updated stem' },
    });
    expect(mocks.setForm).toHaveBeenCalled();

    fireEvent.change(
      screen.getByPlaceholderText(
        'Describe how variants should change context, numbers, or wording while keeping concepts aligned.',
      ),
      { target: { value: 'New instructions' } },
    );
    expect(mocks.setVariantInstructions).toHaveBeenCalledWith('New instructions');

    fireEvent.click(screen.getByRole('button', { name: 'Save Question' }));
    expect(mocks.handleSaveQuestion).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Generate Variant/i }));
    expect(alertMock).toHaveBeenCalledWith('Coming Soon! 😎');

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
});
