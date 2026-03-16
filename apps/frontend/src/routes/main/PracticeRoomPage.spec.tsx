// Tests PracticeRoomPage core-only branches including loading, error states, and submission interactions.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import type { PracticeQuestionUnit } from '@scholarxp/api-contracts';
import PracticeRoomPage from './PracticeRoomPage';
import { getQuestionUnitStatusClass } from './practice-room-status';

function createMockQuestionUnit(
  overrides?: Partial<PracticeQuestionUnit>,
): PracticeQuestionUnit {
  const base: PracticeQuestionUnit = {
    questionUnitId: 1,
    position: 1,
    hasCorrectAttempt: null,
    coreQuestion: {
      questionId: 1,
      questionContent: {
        id: 1,
        questionStem: 'Question?',
        type: 'mcq',
        questionData: {
          options: [{ optionText: 'A' }, { optionText: 'B' }],
          correctOptionIndex: 0,
        } as unknown as PracticeQuestionUnit['coreQuestion']['questionContent']['questionData'],
        hint: null,
        difficultyScore: 1,
      },
      lastAttempt: null,
    },
  };

  return {
    ...base,
    ...overrides,
  };
}

let routeParams: { moduleId?: string; unitId?: string } = {
  moduleId: '1',
  unitId: '1',
};

const mocks = vi.hoisted(() => ({
  selectQuestionUnit: vi.fn(),
  selectOption: vi.fn(),
  unlockHintForContent: vi.fn(),
  goToPreviousQuestionUnit: vi.fn(),
  goToNextQuestionUnit: vi.fn(),
  submitActiveQuestionAttempt: vi.fn(),
  dismissLessonCompleteModal: vi.fn(),
}));

type MockPageState = {
  parsedModuleId: number | null;
  parsedUnitId: number | null;
  room: { moduleUnitTitle: string; questions: PracticeQuestionUnit[] } | null;
  moduleProgress: { level: number; currentExp: number; expPercent: number } | null;
  moduleExpGainIndicator: { base: number; firstAttemptBonus: number; streakBonus: number; total: number; awardId?: number } | null;
  showLevelUp: boolean;
  isLessonCompleteModalOpen: boolean;
  isLoading: boolean;
  pageError: string | null;
  submitErrorMessage: string | null;
  isSubmittingAttempt: boolean;
  isRoomReadOnly: boolean;
  canSubmitAttempt: boolean;
  selectedQuestionUnitIndex: number;
  activeQuestionUnit: PracticeQuestionUnit | null;
  activeQuestion: { question: PracticeQuestionUnit['coreQuestion']['questionContent'] } | null;
  activeQuestionOptions: Array<{ optionText: string }>;
  questionUnitNav: { canGoPrevious: boolean; canGoNext: boolean };
  selectedOptionIndex: number | null;
  hasActiveOptionOverride: boolean;
  rewardIndicators: {
    activeQuestion: {
      baseQuestionExpStatus: 'available' | 'already_earned';
      firstAttemptBonusStatus: 'available' | 'already_earned' | 'lost';
    } | null;
    byQuestionUnitId: Record<number, unknown>;
    streak: {
      isEligibleForStreakRewards: boolean;
      claimedTiers: number[];
    };
  };
  currentStreak: number;
  highestStreak: number;
  isStreakInitialized: boolean;
  lastAttemptResult: 'first-try-correct' | 'incorrect' | null;
  firstTryBonusStatus: 'available' | 'earned' | 'lost';
  isActiveHintUnlocked: boolean;
};

let pageState: MockPageState = {
  parsedModuleId: 1,
  parsedUnitId: 1,
  room: null,
  moduleProgress: null,
  moduleExpGainIndicator: null,
  showLevelUp: false,
  isLessonCompleteModalOpen: false,
  isLoading: true,
  pageError: null,
  submitErrorMessage: null,
  isSubmittingAttempt: false,
  isRoomReadOnly: false,
  canSubmitAttempt: false,
  selectedQuestionUnitIndex: 0,
  activeQuestionUnit: null,
  activeQuestion: null,
  activeQuestionOptions: [],
  questionUnitNav: { canGoPrevious: false, canGoNext: false },
  selectedOptionIndex: null,
  hasActiveOptionOverride: false,
  rewardIndicators: {
    activeQuestion: null,
    byQuestionUnitId: {},
    streak: { isEligibleForStreakRewards: false, claimedTiers: [] },
  },
  currentStreak: 0,
  highestStreak: 0,
  isStreakInitialized: false,
  lastAttemptResult: null,
  firstTryBonusStatus: 'available',
  isActiveHintUnlocked: false,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => routeParams,
  };
});

vi.mock('../../hooks/page-state/practice-room/usePracticeRoomPageState', () => ({
  usePracticeRoomPageState: () => ({
    ...pageState,
    selectQuestionUnit: mocks.selectQuestionUnit,
    selectOption: mocks.selectOption,
    unlockHintForContent: mocks.unlockHintForContent,
    goToPreviousQuestionUnit: mocks.goToPreviousQuestionUnit,
    goToNextQuestionUnit: mocks.goToNextQuestionUnit,
    submitActiveQuestionAttempt: mocks.submitActiveQuestionAttempt,
    dismissLessonCompleteModal: mocks.dismissLessonCompleteModal,
  }),
}));

vi.mock('../../components/MainSection', () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <section className={className}>{children}</section>
  ),
}));

describe('PracticeRoomPage route (core-only)', () => {
  beforeEach(() => {
    routeParams = { moduleId: '1', unitId: '1' };
    pageState = {
      parsedModuleId: 1,
      parsedUnitId: 1,
      room: null,
      moduleProgress: null,
      moduleExpGainIndicator: null,
      showLevelUp: false,
      isLessonCompleteModalOpen: false,
      isLoading: true,
      pageError: null,
      submitErrorMessage: null,
      isSubmittingAttempt: false,
      isRoomReadOnly: false,
      canSubmitAttempt: false,
      selectedQuestionUnitIndex: 0,
      activeQuestionUnit: null,
      activeQuestion: null,
      activeQuestionOptions: [],
      questionUnitNav: { canGoPrevious: false, canGoNext: false },
      selectedOptionIndex: null,
      hasActiveOptionOverride: false,
      rewardIndicators: {
        activeQuestion: null,
        byQuestionUnitId: {},
        streak: { isEligibleForStreakRewards: false, claimedTiers: [] },
      },
      currentStreak: 0,
      highestStreak: 0,
      isStreakInitialized: false,
      lastAttemptResult: null,
      firstTryBonusStatus: 'available',
      isActiveHintUnlocked: false,
    };
    vi.clearAllMocks();
  });

  it('renders module exp gain indicator when present', () => {
    pageState.isLoading = false;
    pageState.moduleProgress = { level: 2, currentExp: 120, expPercent: 12 };
    pageState.moduleExpGainIndicator = { base: 50, firstAttemptBonus: 0, streakBonus: 0, total: 50 };
    pageState.room = { moduleUnitTitle: 'Unit 1', questions: [] };

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('+50 xp')).toBeInTheDocument();
    expect(screen.getByText('120 xp')).toBeInTheDocument();
  });

  it('renders loading and error branches', () => {
    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Loading practice room…')).toBeInTheDocument();

    pageState.isLoading = false;
    pageState.pageError = 'Failed to load';
    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Failed to load');
  });

  it('renders core question content and triggers selection/submission handlers', () => {
    const question = createMockQuestionUnit();
    pageState.isLoading = false;
    pageState.room = { moduleUnitTitle: 'Unit 1', questions: [question] };
    pageState.activeQuestionUnit = question;
    pageState.activeQuestion = { question: question.coreQuestion.questionContent };
    pageState.activeQuestionOptions = [{ optionText: 'A' }, { optionText: 'B' }];
    pageState.canSubmitAttempt = true;

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Unit 1')).toBeInTheDocument();
    expect(screen.getByText('Question?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Question 1' }));
    expect(mocks.selectQuestionUnit).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
    expect(mocks.submitActiveQuestionAttempt).toHaveBeenCalled();
  });

  it('disables option and submit actions when room is read-only', () => {
    const question = createMockQuestionUnit();
    pageState.isLoading = false;
    pageState.isRoomReadOnly = true;
    pageState.canSubmitAttempt = false;
    pageState.room = { moduleUnitTitle: 'Unit 1', questions: [question] };
    pageState.activeQuestionUnit = question;
    pageState.activeQuestion = { question: question.coreQuestion.questionContent };
    pageState.activeQuestionOptions = [{ optionText: 'A' }, { optionText: 'B' }];

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'A A' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeDisabled();
  });

  it('keeps prior-correct questions interactive during active practice sessions', () => {
    const question = createMockQuestionUnit({
      coreQuestion: {
        ...createMockQuestionUnit().coreQuestion,
        lastAttempt: { studentAnswer: { selectedOptionIndex: 0 }, isCorrect: true },
      },
    });
    pageState.isLoading = false;
    pageState.canSubmitAttempt = true;
    pageState.room = { moduleUnitTitle: 'Unit 1', questions: [question] };
    pageState.activeQuestionUnit = question;
    pageState.activeQuestion = { question: question.coreQuestion.questionContent };
    pageState.activeQuestionOptions = [{ optionText: 'A' }, { optionText: 'B' }];

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'A A' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeEnabled();
  });

  it('surfaces solved-question streak ineligibility through the base XP indicator copy', () => {
    const question = createMockQuestionUnit({
      hasCorrectAttempt: null,
      coreQuestion: {
        ...createMockQuestionUnit().coreQuestion,
        lastAttempt: { studentAnswer: { selectedOptionIndex: 1 }, isCorrect: false },
      },
    });
    pageState.isLoading = false;
    pageState.moduleProgress = { level: 1, currentExp: 0, expPercent: 0 };
    pageState.room = { moduleUnitTitle: 'Unit 1', questions: [question] };
    pageState.activeQuestionUnit = question;
    pageState.activeQuestion = { question: question.coreQuestion.questionContent };
    pageState.activeQuestionOptions = [{ optionText: 'A' }, { optionText: 'B' }];
    pageState.rewardIndicators.streak.isEligibleForStreakRewards = true;
    pageState.rewardIndicators.activeQuestion = {
      baseQuestionExpStatus: 'already_earned',
      firstAttemptBonusStatus: 'lost',
    };

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByLabelText('Base XP: already earned (cannot contribute to streak)'),
    ).toBeInTheDocument();
  });

  it('keeps only the submit action visible after previous attempts', () => {
    const question = createMockQuestionUnit();
    pageState.isLoading = false;
    pageState.room = { moduleUnitTitle: 'Unit 1', questions: [question] };
    pageState.activeQuestionUnit = question;
    pageState.activeQuestion = { question: question.coreQuestion.questionContent };
    pageState.activeQuestionOptions = [{ optionText: 'A' }, { optionText: 'B' }];

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /Try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Submit$/i })).toBeInTheDocument();
  });

  it('shows incorrect feedback for persisted incorrect attempts on revisit', () => {
    const question = createMockQuestionUnit({
      coreQuestion: {
        ...createMockQuestionUnit().coreQuestion,
        lastAttempt: { studentAnswer: { selectedOptionIndex: 1 }, isCorrect: false },
      },
    });
    pageState.isLoading = false;
    pageState.room = { moduleUnitTitle: 'Unit 1', questions: [question] };
    pageState.activeQuestionUnit = question;
    pageState.activeQuestion = { question: question.coreQuestion.questionContent };
    pageState.activeQuestionOptions = [{ optionText: 'A' }, { optionText: 'B' }];
    pageState.selectedOptionIndex = 1;
    pageState.hasActiveOptionOverride = false;

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Incorrect')).toBeInTheDocument();
  });

  it('hides persisted feedback after the learner starts a new selection', () => {
    const question = createMockQuestionUnit({
      coreQuestion: {
        ...createMockQuestionUnit().coreQuestion,
        lastAttempt: { studentAnswer: { selectedOptionIndex: 1 }, isCorrect: false },
      },
    });
    pageState.isLoading = false;
    pageState.room = { moduleUnitTitle: 'Unit 1', questions: [question] };
    pageState.activeQuestionUnit = question;
    pageState.activeQuestion = { question: question.coreQuestion.questionContent };
    pageState.activeQuestionOptions = [{ optionText: 'A' }, { optionText: 'B' }];
    pageState.selectedOptionIndex = 0;
    pageState.hasActiveOptionOverride = true;

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Incorrect')).not.toBeInTheDocument();
  });

  it('shows not found for invalid parsed params', () => {
    pageState.parsedModuleId = null;

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Practice room not found.')).toBeInTheDocument();
  });

  it('renders the lesson-complete modal when completion is pending', () => {
    pageState.isLoading = false;
    pageState.isLessonCompleteModalOpen = true;
    pageState.room = { moduleUnitTitle: 'Unit 1', questions: [] };

    render(
      <MemoryRouter>
        <PracticeRoomPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('Unit 1 lesson complete!');
    expect(screen.getByText('Lesson complete')).toBeInTheDocument();
  });
});

describe('getQuestionUnitStatusClass (core-only)', () => {
  const css = {
    navBarCorrect: 'correct',
    navBarIncorrect: 'incorrect',
    navBarMuted: 'muted',
    navBarCurrent: 'current',
  } as Record<string, string>;

  it('returns correct when hasCorrectAttempt is true', () => {
    const result = getQuestionUnitStatusClass(
      { questionUnit: createMockQuestionUnit({ hasCorrectAttempt: true }), isCurrent: false },
      css,
    );
    expect(result).toBe('correct');
  });

  it('returns incorrect when core attempt exists but solved is false', () => {
    const result = getQuestionUnitStatusClass(
      {
        questionUnit: createMockQuestionUnit({
          hasCorrectAttempt: null,
          coreQuestion: {
            ...createMockQuestionUnit().coreQuestion,
            lastAttempt: { studentAnswer: { selectedOptionIndex: 0 }, isCorrect: false },
          },
        }),
        isCurrent: false,
      },
      css,
    );
    expect(result).toBe('incorrect');
  });
});
