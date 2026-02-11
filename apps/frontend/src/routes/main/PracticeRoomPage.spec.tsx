// Tests PracticeRoomPage route branches including loading, error states, and question navigation.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PracticeRoomQuestionUnit } from '@scholarxp/api-contracts';
import PracticeRoomPage, { getQuestionUnitStatusClass } from './PracticeRoomPage';

// Helper to create minimal mock PracticeRoomQuestionUnit for testing
function createMockQuestionUnit(
  overrides?: Partial<PracticeRoomQuestionUnit>,
): PracticeRoomQuestionUnit {
  const base: PracticeRoomQuestionUnit = {
    questionUnitId: 1,
    position: 0,
    hasCorrectAttempt: false,
    coreQuestion: {
      questionId: 1,
      questionContent: {
        id: 1,
        questionStem: 'Question?',
        type: 'mcq',
        questionData: {
          options: [{ optionText: 'A' }, { optionText: 'B' }],
          correctOptionIndex: 0,
        } as any,
        hint: null,
        difficultyScore: 1,
      },
      lastAttempt: null,
    },
    variants: [],
  };

  const merged = { ...base, ...overrides };

  // Handle nested overrides for coreQuestion
  if (overrides?.coreQuestion) {
    merged.coreQuestion = {
      ...base.coreQuestion,
      ...overrides.coreQuestion,
      questionContent: {
        ...base.coreQuestion.questionContent,
        ...(overrides.coreQuestion.questionContent || {}),
      },
    };
  }

  return merged as PracticeRoomQuestionUnit;
}

// Route params tracking
let routeParams: { moduleId?: string; unitId?: string } = { moduleId: '1', unitId: '1' };

// Mock page state
const mocks = vi.hoisted(() => ({
  selectQuestionUnit: vi.fn(),
  selectOption: vi.fn(),
  unlockHintForContent: vi.fn(),
  goToPreviousQuestionVersion: vi.fn(),
  goToNextQuestionVersion: vi.fn(),
  goToPreviousQuestionUnit: vi.fn(),
  goToNextQuestionUnit: vi.fn(),
}));

let pageState: {
  parsedModuleId: number | null;
  parsedUnitId: number | null;
  room: {
    moduleUnitTitle: string;
    questions: PracticeRoomQuestionUnit[];
  } | null;
  moduleProgress: { level: number; currentExp: number; expPercent: number } | null;
  isLoading: boolean;
  pageError: string | null;
  selectedQuestionUnitIndex: number;
  activeQuestionUnit: PracticeRoomQuestionUnit | null;
  activeQuestion: { kind: 'core' | 'variant'; question: any } | null;
  activeQuestionOptions: Array<{ optionText: string }>;
  trackNav: { activeLabel: string; canGoPrevious: boolean; canGoNext: boolean };
  questionUnitNav: { canGoPrevious: boolean; canGoNext: boolean };
  selectedOptionIndex: number | null;
  isActiveHintUnlocked: boolean;
} = {
  parsedModuleId: 1,
  parsedUnitId: 1,
  room: null,
  moduleProgress: null,
  isLoading: true,
  pageError: null,
  selectedQuestionUnitIndex: 0,
  activeQuestionUnit: null,
  activeQuestion: null,
  activeQuestionOptions: [],
  trackNav: { activeLabel: 'Core', canGoPrevious: false, canGoNext: false },
  questionUnitNav: { canGoPrevious: false, canGoNext: false },
  selectedOptionIndex: null,
  isActiveHintUnlocked: false,
};

// Setup mocks before each test
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => routeParams,
  };
});

vi.mock('../../hooks/page-state/usePracticeRoomPageState', () => ({
  usePracticeRoomPageState: () => ({
    ...pageState,
    selectQuestionUnit: mocks.selectQuestionUnit,
    selectOption: mocks.selectOption,
    unlockHintForContent: mocks.unlockHintForContent,
    goToPreviousQuestionVersion: mocks.goToPreviousQuestionVersion,
    goToNextQuestionVersion: mocks.goToNextQuestionVersion,
    goToPreviousQuestionUnit: mocks.goToPreviousQuestionUnit,
    goToNextQuestionUnit: mocks.goToNextQuestionUnit,
  }),
}));

vi.mock('../../components/MainSection', () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <section className={className}>{children}</section>
  ),
}));

describe('PracticeRoomPage route', () => {
  beforeEach(() => {
    routeParams = { moduleId: '1', unitId: '1' };
    pageState = {
      parsedModuleId: 1,
      parsedUnitId: 1,
      room: null,
      moduleProgress: null,
      isLoading: true,
      pageError: null,
      selectedQuestionUnitIndex: 0,
      activeQuestionUnit: null,
      activeQuestion: null,
      activeQuestionOptions: [],
      trackNav: { activeLabel: 'Core', canGoPrevious: false, canGoNext: false },
      questionUnitNav: { canGoPrevious: false, canGoNext: false },
      selectedOptionIndex: null,
      isActiveHintUnlocked: false,
    };
    vi.clearAllMocks();
  });

  // Branch: Invalid route params (missing or non-numeric module/unit ID)
  describe('invalid route parameters', () => {
    it('renders not-found when moduleId is missing', () => {
      routeParams = { moduleId: undefined, unitId: '1' };
      pageState.parsedModuleId = null;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('Practice room not found.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Back to module/ })).toHaveAttribute(
        'href',
        '/main/modules/undefined',
      );
    });

    it('renders not-found when unitId is missing', () => {
      routeParams = { moduleId: '1', unitId: undefined };
      pageState.parsedUnitId = null;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('Practice room not found.')).toBeInTheDocument();
    });

    it('renders not-found when both are missing', () => {
      routeParams = { moduleId: undefined, unitId: undefined };
      pageState.parsedModuleId = null;
      pageState.parsedUnitId = null;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('Practice room not found.')).toBeInTheDocument();
    });
  });

  // Branch: Loading state
  it('renders loading message when data is loading', () => {
    pageState.isLoading = true;

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading practice room…')).toBeInTheDocument();
  });

  // Branch: Error state
  it('renders error message when page error occurs', () => {
    pageState.isLoading = false;
    pageState.pageError = 'Failed to load practice room';

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load practice room');
  });

  // Branch: No room data
  it('renders nothing when room is null and no error', () => {
    pageState.isLoading = false;
    pageState.pageError = null;
    pageState.room = null;

    const { container } = render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    // Should render back link and main section but no content
    expect(screen.getByRole('link', { name: /Back to module/ })).toBeInTheDocument();
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  // Branch: Module progress exists
  describe('module progress rendering', () => {
    beforeEach(() => {
      pageState.isLoading = false;
      pageState.room = {
        moduleUnitTitle: 'Unit 1',
        questions: [],
      };
    });

    it('renders module progress when available', () => {
      pageState.moduleProgress = { level: 5, currentExp: 150, expPercent: 60 };

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('Level 5')).toBeInTheDocument();
      expect(screen.getByText('150 xp')).toBeInTheDocument();
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '60');
    });

    it('renders no progress section when moduleProgress is null', () => {
      pageState.moduleProgress = null;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.queryByText(/Level/)).not.toBeInTheDocument();
    });
  });

  // Branch: Room exists with questions but none selected
  describe('practice room with questions', () => {
    beforeEach(() => {
      pageState.isLoading = false;
      pageState.pageError = null;
      pageState.moduleProgress = { level: 3, currentExp: 100, expPercent: 50 };
      pageState.room = {
        moduleUnitTitle: 'Biology Unit 1',
        questions: [
          createMockQuestionUnit({
            questionUnitId: 101,
            position: 0,
            coreQuestion: {
              questionId: 1,
              questionContent: {
                id: 1,
                questionStem: 'Q1',
                type: 'mcq',
                questionData: {} as any,
                hint: null,
                difficultyScore: 1,
              },
              lastAttempt: null,
            },
          }),
          createMockQuestionUnit({
            questionUnitId: 102,
            position: 1,
            coreQuestion: {
              questionId: 2,
              questionContent: {
                id: 2,
                questionStem: 'Q2',
                type: 'true-false',
                questionData: {} as any,
                hint: null,
                difficultyScore: 1,
              },
              lastAttempt: null,
            },
            hasCorrectAttempt: true,
          }),
        ],
      };
    });

    it('renders header with title and question counter', () => {
      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByRole('heading', { name: 'Biology Unit 1' })).toBeInTheDocument();
      expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    });

    it('renders question navigation beads for each question', () => {
      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const beads = screen.getAllByRole('button', { name: /Question \d/ });
      expect(beads).toHaveLength(2);
    });

    it('calls selectQuestionUnit when a different question bead is clicked', () => {
      pageState.selectedQuestionUnitIndex = 0;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const questionBeads = screen.getAllByRole('button', { name: /Question \d/ });
      fireEvent.click(questionBeads[1]);

      expect(mocks.selectQuestionUnit).toHaveBeenCalledWith(1);
    });

    it('renders question counter correctly when question is selected', () => {
      pageState.selectedQuestionUnitIndex = 1;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('Question 2 of 2')).toBeInTheDocument();
    });
  });

  // Branch: No active question (no question unit or no question)
  it('renders no-questions message when activeQuestionUnit is null', () => {
    pageState.isLoading = false;
    pageState.room = { moduleUnitTitle: 'Test', questions: [] };
    pageState.activeQuestionUnit = null;
    pageState.activeQuestion = null;

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('No practice questions are available for this unit yet.'),
    ).toBeInTheDocument();
  });

  // Branch: Active question rendering with mcq type
  describe('active question with mcq type', () => {
    beforeEach(() => {
      pageState.isLoading = false;
      pageState.room = {
        moduleUnitTitle: 'Test Unit',
        questions: [
          createMockQuestionUnit({
            questionUnitId: 101,
            position: 0,
            coreQuestion: {
              questionId: 1,
              questionContent: {
                id: 1,
                questionStem: 'What is 2+2?',
                type: 'mcq',
                questionData: {} as any,
                hint: null,
                difficultyScore: 1,
              },
              lastAttempt: null,
            },
          }),
        ],
      };
      pageState.selectedQuestionUnitIndex = 0;
      pageState.activeQuestionUnit = pageState.room.questions[0];
      pageState.activeQuestion = {
        kind: 'core',
        question: {
          id: 1,
          questionStem: 'What is 2+2?',
          type: 'mcq',
        },
      };
      pageState.activeQuestionOptions = [
        { optionText: '3' },
        { optionText: '4' },
        { optionText: '5' },
      ];
      pageState.selectedOptionIndex = null;
      pageState.trackNav = { activeLabel: 'Core', canGoPrevious: false, canGoNext: false };
      pageState.questionUnitNav = { canGoPrevious: false, canGoNext: false };
    });

    it('renders question stem and options', () => {
      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    });

    it('calls selectOption when an option is clicked', () => {
      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole('button', { name: '4' }));

      expect(mocks.selectOption).toHaveBeenCalledWith(1, 1);
    });

    it('marks selected option with aria-pressed', () => {
      pageState.selectedOptionIndex = 1;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('disables previous version button when canGoPrevious is false', () => {
      pageState.trackNav.canGoPrevious = false;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const prevButton = screen.getAllByRole('button', { name: /Previous/ })[0];
      expect(prevButton).toBeDisabled();
    });

    it('enables previous version button when canGoPrevious is true', () => {
      pageState.trackNav.canGoPrevious = true;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const prevButton = screen.getAllByRole('button', { name: /Previous/ })[0];
      expect(prevButton).not.toBeDisabled();
    });

    it('calls goToPreviousQuestionVersion when enabled', () => {
      pageState.trackNav.canGoPrevious = true;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const prevButton = screen.getAllByRole('button', { name: /Previous question or variant/ })[0];
      fireEvent.click(prevButton);

      expect(mocks.goToPreviousQuestionVersion).toHaveBeenCalled();
    });

    it('disables next version button when canGoNext is false', () => {
      pageState.trackNav.canGoNext = false;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const nextButton = screen.getAllByRole('button', { name: /Next/ })[0];
      expect(nextButton).toBeDisabled();
    });

    it('enables next version button when canGoNext is true', () => {
      pageState.trackNav.canGoNext = true;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const nextButton = screen.getAllByRole('button', { name: /Next question or variant/ })[0];
      expect(nextButton).not.toBeDisabled();
    });

    it('calls goToNextQuestionVersion when enabled', () => {
      pageState.trackNav.canGoNext = true;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const nextButton = screen.getAllByRole('button', { name: /Next question or variant/ })[0];
      fireEvent.click(nextButton);

      expect(mocks.goToNextQuestionVersion).toHaveBeenCalled();
    });
  });

  // Branch: Active question with true-false type (different class styling)
  describe('active question with true-false type', () => {
    beforeEach(() => {
      pageState.isLoading = false;
      pageState.room = {
        moduleUnitTitle: 'Test Unit',
        questions: [
          createMockQuestionUnit({
            questionUnitId: 101,
            position: 0,
            coreQuestion: {
              questionId: 1,
              questionContent: {
                id: 1,
                questionStem: 'Is the sky blue?',
                type: 'true-false',
                questionData: {} as any,
                hint: null,
                difficultyScore: 1,
              },
              lastAttempt: null,
            },
          }),
        ],
      };
      pageState.selectedQuestionUnitIndex = 0;
      pageState.activeQuestionUnit = pageState.room.questions[0];
      pageState.activeQuestion = {
        kind: 'core',
        question: {
          id: 1,
          questionStem: 'Is the sky blue?',
          type: 'true-false',
        },
      };
      pageState.activeQuestionOptions = [
        { optionText: 'True' },
        { optionText: 'False' },
      ];
      pageState.trackNav = { activeLabel: 'Core', canGoPrevious: false, canGoNext: false };
    });

    it('renders true-false options', () => {
      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByRole('button', { name: 'True' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'False' })).toBeInTheDocument();
    });
  });

  // Branch: Hint section handling
  describe('hint section', () => {
    beforeEach(() => {
      pageState.isLoading = false;
      pageState.room = {
        moduleUnitTitle: 'Test Unit',
        questions: [
          createMockQuestionUnit({
            questionUnitId: 101,
            position: 0,
            coreQuestion: {
              questionId: 1,
              questionContent: {
                id: 1,
                questionStem: 'What is photosynthesis?',
                type: 'mcq',
                questionData: {} as any,
                hint: 'It involves sunlight and plants.',
                difficultyScore: 1,
              },
              lastAttempt: null,
            },
          }),
        ],
      };
      pageState.selectedQuestionUnitIndex = 0;
      pageState.activeQuestionUnit = pageState.room.questions[0];
      pageState.activeQuestion = {
        kind: 'core',
        question: {
          id: 1,
          questionStem: 'What is photosynthesis?',
          type: 'mcq',
          hint: 'It involves sunlight and plants.',
        },
      };
      pageState.activeQuestionOptions = [{ optionText: 'Option 1' }];
      pageState.trackNav = { activeLabel: 'Core', canGoPrevious: false, canGoNext: false };
      pageState.isActiveHintUnlocked = false;
    });

    it('renders hint toggle when question has hint', () => {
      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('Unlock hint')).toBeInTheDocument();
    });

    it('hides hint text when hint is locked', () => {
      pageState.isActiveHintUnlocked = false;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.queryByText('It involves sunlight and plants.')).not.toBeInTheDocument();
    });

    it('shows hint text when hint is unlocked', () => {
      pageState.isActiveHintUnlocked = true;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('It involves sunlight and plants.')).toBeInTheDocument();
      expect(screen.getByText('Hint unlocked')).toBeInTheDocument();
    });

    it('calls unlockHintForContent when hint toggle is clicked while locked', () => {
      pageState.isActiveHintUnlocked = false;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByText('Unlock hint'));

      expect(mocks.unlockHintForContent).toHaveBeenCalledWith(1);
    });

    it('does not call unlockHintForContent when hint is already unlocked', () => {
      pageState.isActiveHintUnlocked = true;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByText('Hint unlocked'));

      expect(mocks.unlockHintForContent).not.toHaveBeenCalled();
    });

    it('unlocks hint on keydown Enter when locked', () => {
      pageState.isActiveHintUnlocked = false;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const hintToggle = screen.getByText('Unlock hint').closest('[role="button"]');
      fireEvent.keyDown(hintToggle!, { key: 'Enter' });

      expect(mocks.unlockHintForContent).toHaveBeenCalledWith(1);
    });

    it('unlocks hint on keydown Space when locked', () => {
      pageState.isActiveHintUnlocked = false;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const hintToggle = screen.getByText('Unlock hint').closest('[role="button"]');
      fireEvent.keyDown(hintToggle!, { key: ' ' });

      expect(mocks.unlockHintForContent).toHaveBeenCalledWith(1);
    });

    it('does not unlock hint on keydown when already unlocked', () => {
      pageState.isActiveHintUnlocked = true;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const hintToggle = screen.getByText('Hint unlocked').closest('[role="button"]');
      fireEvent.keyDown(hintToggle!, { key: 'Enter' });

      expect(mocks.unlockHintForContent).not.toHaveBeenCalled();
    });

    it('ignores non-Enter/Space keydown when locked', () => {
      pageState.isActiveHintUnlocked = false;

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const hintToggle = screen.getByText('Unlock hint').closest('[role="button"]');
      fireEvent.keyDown(hintToggle!, { key: 'a' });

      expect(mocks.unlockHintForContent).not.toHaveBeenCalled();
    });
  });

  // Branch: Question without hint
  it('does not render hint section when question has no hint', () => {
    pageState.isLoading = false;
    pageState.room = {
      moduleUnitTitle: 'Test Unit',
      questions: [
        createMockQuestionUnit({
          questionUnitId: 101,
          position: 0,
          coreQuestion: {
            questionId: 1,
            questionContent: {
              id: 1,
              questionStem: 'What is 2+2?',
              type: 'mcq',
              questionData: {} as any,
              hint: null,
              difficultyScore: 1,
            },
            lastAttempt: null,
          },
        }),
      ],
    };
    pageState.selectedQuestionUnitIndex = 0;
    pageState.activeQuestionUnit = pageState.room.questions[0];
    pageState.activeQuestion = {
      kind: 'core',
      question: {
        id: 1,
        questionStem: 'What is 2+2?',
        type: 'mcq',
      },
    };
    pageState.activeQuestionOptions = [{ optionText: 'Option 1' }];
    pageState.trackNav = { activeLabel: 'Core', canGoPrevious: false, canGoNext: false };

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/Unlock hint|Hint unlocked/)).not.toBeInTheDocument();
  });

  // Branch: Question unit navigation (previous/next buttons)
  describe('question unit navigation', () => {
    beforeEach(() => {
      pageState.isLoading = false;
      pageState.room = {
        moduleUnitTitle: 'Test Unit',
        questions: [
          createMockQuestionUnit({
            questionUnitId: 101,
            position: 0,
            coreQuestion: {
              questionId: 1,
              questionContent: {
                id: 1,
                questionStem: 'Q1',
                type: 'mcq',
                questionData: {} as any,
                hint: null,
                difficultyScore: 1,
              },
              lastAttempt: null,
            },
          }),
          createMockQuestionUnit({
            questionUnitId: 102,
            position: 1,
            coreQuestion: {
              questionId: 2,
              questionContent: {
                id: 2,
                questionStem: 'Q2',
                type: 'mcq',
                questionData: {} as any,
                hint: null,
                difficultyScore: 1,
              },
              lastAttempt: null,
            },
          }),
        ],
      };
      pageState.selectedQuestionUnitIndex = 0;
      pageState.activeQuestionUnit = pageState.room.questions[0];
      pageState.activeQuestion = {
        kind: 'core',
        question: {
          id: 1,
          questionStem: 'Q1',
          type: 'mcq',
        },
      };
      pageState.activeQuestionOptions = [{ optionText: 'A' }];
      pageState.trackNav = { activeLabel: 'Core', canGoPrevious: false, canGoNext: false };
      pageState.questionUnitNav = { canGoPrevious: false, canGoNext: true };
    });

    it('disables previous unit button at start', () => {
      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const buttons = screen.getAllByRole('button', { name: /Previous/ });
      const prevUnitButton = buttons.find((btn) => btn.textContent?.includes('Previous'));
      expect(prevUnitButton).toBeDisabled();
    });

    it('enables next unit button when not at end', () => {
      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const buttons = screen.getAllByRole('button', { name: /Next/ });
      const nextUnitButton = buttons.find((btn) => btn.textContent?.includes('Next'));
      expect(nextUnitButton).not.toBeDisabled();
    });

    it('calls goToPreviousQuestionUnit when previous button enabled', () => {
      pageState.questionUnitNav = { canGoPrevious: true, canGoNext: true };

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const buttons = screen.getAllByRole('button', { name: /Previous question/ });
      const prevBtn = buttons.find((btn) => btn.textContent?.includes('Previous'));
      fireEvent.click(prevBtn!);

      expect(mocks.goToPreviousQuestionUnit).toHaveBeenCalled();
    });

    it('calls goToNextQuestionUnit when next button enabled', () => {
      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const buttons = screen.getAllByRole('button', { name: /Next question/ });
      const nextBtn = buttons.find((btn) => btn.textContent?.includes('Next'));
      fireEvent.click(nextBtn!);

      expect(mocks.goToNextQuestionUnit).toHaveBeenCalled();
    });

    it('disables next button at end', () => {
      pageState.selectedQuestionUnitIndex = 1;
      pageState.activeQuestionUnit = pageState.room!.questions[1];
      pageState.activeQuestion = {
        kind: 'core',
        question: {
          id: 2,
          questionStem: 'Q2',
          type: 'mcq',
        },
      };
      pageState.questionUnitNav = { canGoPrevious: true, canGoNext: false };

      render(
        <MemoryRouter>
          <PracticeRoomPage />
        </MemoryRouter>,
      );

      const buttons = screen.getAllByRole('button', { name: /Next/ });
      const nextUnitButton = buttons.find((btn) => btn.textContent?.includes('Next'));
      expect(nextUnitButton).toBeDisabled();
    });
  });

  // Branch: Variant label display
  it('displays variant label correctly', () => {
    pageState.isLoading = false;
    pageState.room = {
      moduleUnitTitle: 'Test Unit',
      questions: [createMockQuestionUnit({ questionUnitId: 101, position: 0 })],
    };
    pageState.selectedQuestionUnitIndex = 0;
    pageState.activeQuestionUnit = pageState.room.questions[0];
    pageState.activeQuestion = {
      kind: 'variant',
      question: { id: 1, questionStem: 'Q', type: 'mcq' },
    };
    pageState.activeQuestionOptions = [{ optionText: 'A' }];
    pageState.trackNav = { activeLabel: 'Variant 2', canGoPrevious: true, canGoNext: true };

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Variant 2')).toBeInTheDocument();
  });

  // Branch: Back link to module
  it('renders back link to module', () => {
    pageState.isLoading = false;
    pageState.room = { moduleUnitTitle: 'Test', questions: [] };

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Back to module/ })).toHaveAttribute(
      'href',
      '/main/modules/1',
    );
  });

  // Branch: Question counter math.max/min clamping
  it('clamps question counter when selectedQuestionUnitIndex is beyond array length', () => {
    pageState.isLoading = false;
    pageState.room = {
      moduleUnitTitle: 'Test Unit',
      questions: [
        createMockQuestionUnit({
          questionUnitId: 101,
          position: 0,
          coreQuestion: {
            questionId: 1,
            questionContent: {
              id: 1,
              questionStem: 'Q1',
              type: 'mcq',
              questionData: {} as any,
              hint: null,
              difficultyScore: 1,
            },
            lastAttempt: null,
          },
        }),
      ],
    };
    pageState.selectedQuestionUnitIndex = 5; // Beyond length
    pageState.activeQuestionUnit = pageState.room.questions[0];
    pageState.activeQuestion = {
      kind: 'core',
      question: { id: 1, questionStem: 'Q1', type: 'mcq', questionData: {}, hint: null, difficultyScore: 1 },
    };
    pageState.activeQuestionOptions = [{ optionText: 'A' }];
    pageState.trackNav = { activeLabel: 'Core', canGoPrevious: false, canGoNext: false };

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    // Should show 1 of 1 despite selectedQuestionUnitIndex being 5
    expect(screen.getByText('Question 1 of 1')).toBeInTheDocument();
  });
});

// Tests for the getQuestionUnitStatusClass helper function
describe('getQuestionUnitStatusClass', () => {
  const mockCss = {
    navBarCurrent: 'current',
    navBarCorrect: 'correct',
    navBarIncorrect: 'incorrect',
    navBarMuted: 'muted',
  };

  // Branch: isCurrent is true
  it('returns navBarCurrent when question unit is current', () => {
    const questionUnit = createMockQuestionUnit({ questionUnitId: 1, position: 0 });

    const result = getQuestionUnitStatusClass({ questionUnit, isCurrent: true }, mockCss);
    expect(result).toBe('current');
  });

  // Branch: hasCorrectAttempt is true
  it('returns navBarCorrect when question unit has correct attempt', () => {
    const questionUnit = createMockQuestionUnit({
      questionUnitId: 1,
      position: 0,
      hasCorrectAttempt: true,
    });

    const result = getQuestionUnitStatusClass({ questionUnit, isCurrent: false }, mockCss);
    expect(result).toBe('correct');
  });

  // Branch: core question has lastAttempt
  it('returns navBarIncorrect when core question has incorrect attempt', () => {
    const questionUnit = createMockQuestionUnit({
      questionUnitId: 1,
      position: 0,
      coreQuestion: {
        questionId: 1,
        questionContent: {
          id: 1,
          questionStem: 'Q',
          type: 'mcq',
          questionData: {} as any,
          hint: null,
          difficultyScore: 1,
        },
        lastAttempt: {
          studentAnswer: { selectedOptionIndex: 0 } as any,
          isCorrect: false,
          attemptedAt: new Date().toISOString(),
        },
      },
    });

    const result = getQuestionUnitStatusClass({ questionUnit, isCurrent: false }, mockCss);
    expect(result).toBe('incorrect');
  });

  // Branch: variant has lastAttempt
  it('returns navBarIncorrect when variant has incorrect attempt', () => {
    const questionUnit = createMockQuestionUnit({
      questionUnitId: 1,
      position: 0,
      variants: [
        {
          questionId: 2,
          questionContent: {
            id: 2,
            questionStem: 'Q',
            type: 'mcq',
            questionData: {} as any,
            hint: null,
            difficultyScore: 1,
          },
          lastAttempt: {
            studentAnswer: { selectedOptionIndex: 0 } as any,
            isCorrect: false,
            attemptedAt: new Date().toISOString(),
          },
        },
      ],
    });

    const result = getQuestionUnitStatusClass({ questionUnit, isCurrent: false }, mockCss);
    expect(result).toBe('incorrect');
  });

  // Branch: no attempts at all (muted state)
  it('returns navBarMuted when question unit has no attempts', () => {
    const questionUnit = createMockQuestionUnit({ questionUnitId: 1, position: 0 });

    const result = getQuestionUnitStatusClass({ questionUnit, isCurrent: false }, mockCss);
    expect(result).toBe('muted');
  });

  // Branch: isCurrent takes precedence over other states
  it('prioritizes isCurrent even when hasCorrectAttempt is true', () => {
    const questionUnit = createMockQuestionUnit({
      questionUnitId: 1,
      position: 0,
      hasCorrectAttempt: true,
    });

    const result = getQuestionUnitStatusClass({ questionUnit, isCurrent: true }, mockCss);
    expect(result).toBe('current');
  });

  // Branch: multiple variants with no attempts returns muted
  it('returns navBarMuted when multiple variants exist but have no attempts', () => {
    const questionUnit = createMockQuestionUnit({
      questionUnitId: 1,
      position: 0,
      variants: [
        {
          questionId: 2,
          questionContent: {
            id: 2,
            questionStem: 'Q',
            type: 'mcq',
            questionData: {} as any,
            hint: null,
            difficultyScore: 1,
          },
          lastAttempt: null,
        },
        {
          questionId: 3,
          questionContent: {
            id: 3,
            questionStem: 'Q',
            type: 'mcq',
            questionData: {} as any,
            hint: null,
            difficultyScore: 1,
          },
          lastAttempt: null,
        },
      ],
    });

    const result = getQuestionUnitStatusClass({ questionUnit, isCurrent: false }, mockCss);
    expect(result).toBe('muted');
  });

  // Branch: checking .some() for variant attempt detection
  it('returns navBarIncorrect when first variant has no attempt but second has', () => {
    const questionUnit = createMockQuestionUnit({
      questionUnitId: 1,
      position: 0,
      variants: [
        {
          questionId: 2,
          questionContent: {
            id: 2,
            questionStem: 'Q',
            type: 'mcq',
            questionData: {} as any,
            hint: null,
            difficultyScore: 1,
          },
          lastAttempt: null,
        },
        {
          questionId: 3,
          questionContent: {
            id: 3,
            questionStem: 'Q',
            type: 'mcq',
            questionData: {} as any,
            hint: null,
            difficultyScore: 1,
          },
          lastAttempt: {
            studentAnswer: { selectedOptionIndex: 0 } as any,
            isCorrect: false,
            attemptedAt: new Date().toISOString(),
          },
        },
      ],
    });

    const result = getQuestionUnitStatusClass({ questionUnit, isCurrent: false }, mockCss);
    expect(result).toBe('incorrect');
  });
});
